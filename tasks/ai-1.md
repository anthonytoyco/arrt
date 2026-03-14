# AI Person 1 — Fraud Rules Engine + Anomaly Detection

## Your job

Build `src/services/fraud_rules.rs` — the scoring logic called from `routes/fraud.rs`.
Optionally add an Isolation Forest anomaly score on top via a Python sidecar.

---

## Status (completed)

- **Step 1 & 2:** `backend/arrt/src/services/fraud_rules.rs` and `mod.rs` exist; scoring uses section comments (Identity/Card Verification, Network/Device, etc.).
- **Route:** `routes/fraud.rs` calls `fraud_rules::score(&to_fraud_rules_tx(&tx))` and `fraud_rules::risk_level(risk_score)` — no inlined scoring. A small `to_fraud_rules_tx()` maps `models::fraud::Transaction` → `fraud_rules::Transaction`.
- **Step 3 (stretch):** `ml-sidecar/` added with FastAPI, Isolation Forest, Python 3.9–compatible types (`Optional`/`List`), `model_dump()`, and `run.sh`. Use `python3 -m uvicorn main:app --port 8000` or `./run.sh` to run.

---

## Step 1 — Create `src/services/fraud_rules.rs`

This module has a stub `Transaction` struct (used before `models::transaction::Transaction` is available), a `score()` function, and a `risk_level()` helper.

```rust
// Stub transaction — replaced with models::transaction::Transaction once Backend 1 is done.
// When swapping: delete this struct, change the import in routes/fraud.rs, nothing else changes.
pub struct Transaction {
    pub transaction_id: String,
    pub customer_name: Option<String>,
    pub amount: Option<f64>,
    pub cvv_match: Option<bool>,
    pub avs_result: Option<String>,
    pub address_match: Option<bool>,
    pub ip_is_vpn: Option<bool>,
    pub card_present: Option<bool>,
    pub entry_mode: Option<String>,
    pub refund_status: Option<String>,
}

pub fn score(tx: &Transaction) -> (u32, Vec<String>) {
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

    // --- High Amount Threshold ---
    if let Some(amt) = tx.amount {
        if amt > 5000.0 {
            score += 15;
            rules.push(format!("High transaction amount: ${:.2}", amt));
        }
    }

    (score, rules)
}

pub fn risk_level(score: u32) -> &'static str {
    match score {
        s if s >= 60 => "HIGH",
        s if s >= 30 => "MEDIUM",
        _ => "LOW",
    }
}
```

> **Implemented:** The route uses `fraud_rules::score()` (via a `to_fraud_rules_tx()` conversion from `models::fraud::Transaction`) and `fraud_rules::risk_level()` for classification. When you switch to `models::transaction::Transaction`, delete the stub and use that type in the route; the conversion helper can be removed if the type matches.

---

## Step 2 — Create `src/services/mod.rs`

```rust
pub mod fraud_rules;
pub mod gemini;
```

---

## Step 3 (Stretch) — Python Isolation Forest Sidecar

If you want anomaly scores on top of the rule scores, build a tiny Python sidecar. Create `ml-sidecar/` at the repo root (`requirements.txt`, `main.py`, `model.py`, and optionally `run.sh`).

### `ml-sidecar/requirements.txt`

```text
fastapi
uvicorn
scikit-learn
pandas
```

### `ml-sidecar/main.py`

Uses `Optional`/`List` and `model_dump()` for **Python 3.9** compatibility (no `X | None` or `list[T]` in type hints).

```python
from typing import List, Optional

from fastapi import FastAPI
from pydantic import BaseModel

from model import score_transactions

app = FastAPI()


class Transaction(BaseModel):
    transaction_id: str
    amount: Optional[float] = None
    customer_name: Optional[str] = None
    cvv_match: Optional[bool] = None
    address_match: Optional[bool] = None
    ip_is_vpn: Optional[bool] = None
    card_present: Optional[bool] = None


class ScoreRequest(BaseModel):
    transactions: List[Transaction]


@app.post("/score")
def score(req: ScoreRequest):
    results = score_transactions([t.model_dump() for t in req.transactions])
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
python3 -m uvicorn main:app --port 8000
```

Or use the helper script: `./run.sh` (uses `python -m uvicorn` so the `uvicorn` CLI does not need to be on PATH).

### Test the sidecar

- **Swagger UI:** http://localhost:8000/docs → try **POST /score**.
- **curl:** Send at least 5 transactions so Isolation Forest runs; only numeric fields (e.g. `amount`) affect the anomaly score.

```bash
curl -X POST http://localhost:8000/score \
  -H "Content-Type: application/json" \
  -d '{"transactions": [
    {"transaction_id": "tx-1", "amount": 100.50},
    {"transaction_id": "tx-2", "amount": 9999.99},
    {"transaction_id": "tx-3", "amount": 25.00},
    {"transaction_id": "tx-4", "amount": 500.00},
    {"transaction_id": "tx-5", "amount": 7500.00}
  ]}'
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

- `score(&tx)` returns correct scores for test cases
- `risk_level(score)` returns `"HIGH"` / `"MEDIUM"` / `"LOW"` correctly
- (Stretch) `POST http://localhost:8000/score` returns anomaly scores for a batch

Hand the anomaly score format to Backend Person 2 so they can merge it into `FraudResult`.
