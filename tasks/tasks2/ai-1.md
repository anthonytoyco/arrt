# AI Person 1 — Advanced Fraud Rules + ML Sidecar Integration

## Your job

Two parts:
1. Add smarter fraud rules to `backend/arrt/src/services/fraud_rules.rs`
2. Integrate the Python Isolation Forest sidecar anomaly score into the Rust backend

---

## Part 1 — New fraud rules

Open `backend/arrt/src/services/fraud_rules.rs` and add these rules inside `score()`.

### Rule: Round amount (laundering signal)

Criminals often move round numbers. Flag amounts like $5000.00, $10000.00 exactly.

```rust
// --- Round Amount (structuring / laundering signal) ---
if let Some(amt) = tx.amount {
    let cents = (amt * 100.0).round() as u64;
    if cents % 100 == 0 && amt >= 1000.0 {
        score += 15;
        rules.push(format!("Suspiciously round amount: ${:.0}", amt));
    }
}
```

### Rule: High-risk IP country

```rust
// --- High-risk origin country ---
const HIGH_RISK_COUNTRIES: &[&str] = &["NG", "RU", "CN", "KP", "IR", "VE"];
if let Some(ref country) = tx.ip_country {
    if HIGH_RISK_COUNTRIES.contains(&country.to_uppercase().as_str()) {
        score += 20;
        rules.push(format!("Transaction from high-risk country: {}", country));
    }
}
```

> Check `src/models/fraud.rs` — add `ip_country: Option<String>` to the `Transaction`
> struct if it isn't there already. The DB column is `ip_country`.

### Rule: Mobile device + VPN combo

```rust
// --- Mobile + VPN (account takeover pattern) ---
if tx.ip_is_vpn == Some(true) {
    if let Some(ref device) = tx.device_type {
        if device.to_lowercase().contains("mobile") {
            score += 15;
            rules.push("Mobile device with VPN active".to_string());
        }
    }
}
```

> Add `device_type: Option<String>` to the fraud `Transaction` struct and
> `fraud_rules::score()` if not already there.

---

## Part 2 — ML Sidecar integration into Rust

The Python sidecar (`ml-sidecar/`) is already built. This task wires its anomaly scores
into the Rust backend so they appear in the fraud scan response.

### Step 1 — Add `anomaly_score` to `FraudResult` in `src/models/fraud.rs`

```rust
#[derive(Serialize)]
pub struct FraudResult {
    pub transaction_id: String,
    pub customer_name: Option<String>,
    pub amount: Option<f64>,
    pub risk_score: u32,
    pub risk_level: String,
    pub triggered_rules: Vec<String>,
    pub ai_explanation: Option<String>,
    pub anomaly_score: Option<f64>,  // ← add this
}
```

### Step 2 — Call the sidecar from `src/routes/fraud.rs`

After scoring all transactions, send them to the sidecar and merge the scores back:

```rust
// After the scoring loop, before building the response:
let anomaly_scores = call_ml_sidecar(&state.http, &transactions).await;

// Then when building each FraudResult, look up the anomaly score:
let anomaly_score = anomaly_scores
    .get(&tx.transaction_id)
    .copied();
```

### Step 3 — Create `src/services/ml_sidecar.rs`

```rust
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use crate::models::fraud::Transaction;

const SIDECAR_URL: &str = "http://localhost:8000/score";

#[derive(Serialize)]
struct SidecarTx<'a> {
    transaction_id: &'a str,
    amount: Option<f64>,
    cvv_match: Option<bool>,
    ip_is_vpn: Option<bool>,
    address_match: Option<bool>,
    card_present: Option<bool>,
}

#[derive(Deserialize)]
struct SidecarScore {
    transaction_id: String,
    anomaly_score: f64,
}

#[derive(Deserialize)]
struct SidecarResponse {
    scores: Vec<SidecarScore>,
}

/// Returns a map of transaction_id → anomaly_score (0.0–1.0, higher = more anomalous).
/// Returns empty map if the sidecar is not running — never panics.
pub async fn call_ml_sidecar(
    client: &Client,
    transactions: &[Transaction],
) -> HashMap<String, f64> {
    let payload: Vec<SidecarTx> = transactions
        .iter()
        .map(|tx| SidecarTx {
            transaction_id: &tx.transaction_id,
            amount: tx.amount,
            cvv_match: tx.cvv_match,
            ip_is_vpn: tx.ip_is_vpn,
            address_match: tx.address_match,
            card_present: tx.card_present,
        })
        .collect();

    let result = client
        .post(SIDECAR_URL)
        .json(&serde_json::json!({ "transactions": payload }))
        .send()
        .await;

    match result {
        Ok(res) => match res.json::<SidecarResponse>().await {
            Ok(data) => data
                .scores
                .into_iter()
                .map(|s| (s.transaction_id, s.anomaly_score))
                .collect(),
            Err(_) => HashMap::new(),
        },
        Err(_) => HashMap::new(),
    }
}
```

### Step 4 — Add `http: reqwest::Client` to `AppState`

In `src/state.rs`:

```rust
use sqlx::PgPool;

#[derive(Clone)]
pub struct AppState {
    pub db: PgPool,
    pub http: reqwest::Client,  // ← add
}
```

In `src/main.rs` where state is created:

```rust
let state = AppState {
    db: pool,
    http: reqwest::Client::new(),  // ← add
};
```

### Step 5 — Run the sidecar locally

```bash
cd ml-sidecar
pip install -r requirements.txt
python3 -m uvicorn main:app --port 8000
```

Then in a second terminal:
```bash
cd backend/arrt
cargo run
```

Test with:
```bash
curl -X POST http://localhost:3001/api/fraud/scan \
  -H "Content-Type: application/json" \
  -d '{}'
```

Each result should now include `"anomaly_score": 0.87` (or similar).

---

## Done when

- New rules fire correctly on the dummy data
- `POST /api/fraud/scan` results include `anomaly_score`
- If sidecar is not running, scan still works (anomaly_score is null)
