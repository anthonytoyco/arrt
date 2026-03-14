# AI Person 1 — Fraud Rules Engine + Anomaly Detection

## Your job
Build `src/services/fraud_rules.rs` — the scoring logic that Backend Person 2 calls.
Optionally add an Isolation Forest anomaly score on top via a Python sidecar.

---

## Step 1 — Create `src/services/fraud_rules.rs`

This function takes a `Transaction` and returns `(score: u32, triggered_rules: Vec<String>)`.

```rust
use crate::models::transaction::Transaction;

pub fn score_transaction(tx: &Transaction) -> (u32, Vec<String>) {
    let mut score: u32 = 0;
    let mut rules: Vec<String> = Vec::new();

    // --- Identity / Card Verification ---
    if tx.cvv_match == Some(false) {
        score += 35;
        rules.push("CVV mismatch".to_string());
    }

    if let Some(ref avs) = tx.avs_result {
        if avs.to_lowercase().contains("no match") || avs.to_lowercase() == "n" {
            score += 25;
            rules.push("AVS address verification failed".to_string());
        }
    }

    if tx.address_match == Some(false) {
        score += 20;
        rules.push("Billing and shipping address mismatch".to_string());
    }

    // --- Network / Device ---
    if tx.ip_is_vpn == Some(true) {
        score += 30;
        rules.push("VPN or proxy detected".to_string());
    }

    // --- Card Present / Entry Mode ---
    if tx.card_present == Some(false) {
        if let Some(ref mode) = tx.entry_mode {
            if mode.to_lowercase().contains("key") {
                score += 20;
                rules.push("Card not present + manually keyed entry".to_string());
            }
        }
    }

    // --- Return Fraud ---
    if let Some(ref refund) = tx.refund_status {
        if refund.to_lowercase().contains("requested") || refund.to_lowercase().contains("completed") {
            score += 15;
            rules.push(format!("Refund status: {}", refund));
        }
    }

    // --- High Amount Threshold (tune to your data) ---
    if let Some(amt) = tx.amount {
        if amt > 5000.0 {
            score += 15;
            rules.push(format!("High transaction amount: ${:.2}", amt));
        }
    }

    (score, rules)
}
```

---

## Step 2 (Stretch) — Python Isolation Forest Sidecar

If you want anomaly scores on top of the rule scores, build a tiny Python sidecar. Create `ml-sidecar/` at the repo root.

### `ml-sidecar/requirements.txt`
```
fastapi
uvicorn
scikit-learn
pandas
```

### `ml-sidecar/main.py`
```python
from fastapi import FastAPI
from pydantic import BaseModel
from model import score_transactions

app = FastAPI()

class Transaction(BaseModel):
    transaction_id: str
    amount: float | None = None
    # add more numeric fields as needed

class ScoreRequest(BaseModel):
    transactions: list[Transaction]

@app.post("/score")
def score(req: ScoreRequest):
    results = score_transactions([t.dict() for t in req.transactions])
    return {"scores": results}
```

### `ml-sidecar/model.py`
```python
import pandas as pd
from sklearn.ensemble import IsolationForest

def score_transactions(transactions: list[dict]) -> list[dict]:
    df = pd.DataFrame(transactions)
    numeric = df.select_dtypes(include="number").fillna(0)

    if numeric.empty or len(numeric) < 5:
        return [{"transaction_id": t["transaction_id"], "anomaly_score": 0.0} for t in transactions]

    model = IsolationForest(contamination=0.05, random_state=42)
    raw_scores = model.fit(numeric).decision_function(numeric)

    # Normalize to 0–1 (higher = more anomalous)
    min_s, max_s = raw_scores.min(), raw_scores.max()
    normalized = [(max_s - s) / (max_s - min_s) if max_s != min_s else 0.0 for s in raw_scores]

    return [
        {"transaction_id": t["transaction_id"], "anomaly_score": round(score, 4)}
        for t, score in zip(transactions, normalized)
    ]
```

### Run it
```bash
cd ml-sidecar
pip install -r requirements.txt
uvicorn main:app --port 8000
```

---

## How the Rust backend calls the sidecar (Backend Person 2 adds this)

```rust
// POST http://localhost:8000/score
// Body: { "transactions": [...] }
// Response: { "scores": [{ "transaction_id": "...", "anomaly_score": 0.87 }] }
```

Anomaly score can be added to the rule score: `final_score = rule_score + (anomaly_score * 30) as u32`

---

## Done when

- `score_transaction(&tx)` returns correct scores for test cases
- (Stretch) `POST http://localhost:8000/score` returns anomaly scores for a batch

Hand the anomaly score format to Backend Person 2 so they can merge it into `FraudResult`.
