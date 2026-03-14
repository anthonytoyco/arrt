# Backend Person 2 — Fraud Scan Endpoint

## Your job
Build `POST /api/fraud/scan` — takes transaction IDs, runs fraud scoring, returns flagged results with risk levels.

Depends on: **Backend Person 1** finishing the Supabase connection + `AppState`.

---

## Step 1 — Add `reqwest` to `Cargo.toml` (for Gemini + AI sidecar calls)

```toml
reqwest = { version = "0.12", features = ["json"] }
```

---

## Step 2 — Create `src/models/fraud.rs`

Request and response shapes for the fraud scan endpoint:

```rust
use serde::{Deserialize, Serialize};

#[derive(Deserialize)]
pub struct ScanRequest {
    /// Pass specific IDs, or leave empty to scan all
    pub transaction_ids: Option<Vec<String>>,
}

#[derive(Serialize)]
pub struct FraudResult {
    pub transaction_id: String,
    pub customer_name: Option<String>,
    pub amount: Option<f64>,
    pub risk_score: u32,
    pub risk_level: String,       // "HIGH", "MEDIUM", "LOW"
    pub triggered_rules: Vec<String>,
    pub ai_explanation: Option<String>,
}

#[derive(Serialize)]
pub struct ScanResponse {
    pub total_scanned: usize,
    pub flagged: usize,
    pub results: Vec<FraudResult>,
}
```

---

## Step 3 — Create `src/routes/fraud.rs`

```rust
use axum::{extract::State, http::StatusCode, Json};
use std::sync::Arc;
use crate::{
    models::{fraud::{FraudResult, ScanRequest, ScanResponse}, transaction::Transaction},
    services::fraud_rules::score_transaction,
    services::gemini::explain_fraud,
    state::AppState,
};

pub async fn scan(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<ScanRequest>,
) -> Result<Json<ScanResponse>, StatusCode> {
    // Fetch transactions from DB
    let transactions: Vec<Transaction> = match payload.transaction_ids {
        Some(ids) => {
            sqlx::query_as::<_, Transaction>(
                "SELECT * FROM transactions WHERE transaction_id = ANY($1)"
            )
            .bind(&ids)
            .fetch_all(&state.db)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        }
        None => {
            sqlx::query_as::<_, Transaction>("SELECT * FROM transactions LIMIT 500")
                .fetch_all(&state.db)
                .await
                .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        }
    };

    let total_scanned = transactions.len();
    let mut results: Vec<FraudResult> = Vec::new();

    for tx in transactions {
        let (score, triggered_rules) = score_transaction(&tx);
        if score == 0 {
            continue; // skip clean transactions
        }

        let risk_level = match score {
            s if s >= 60 => "HIGH",
            s if s >= 30 => "MEDIUM",
            _ => "LOW",
        }
        .to_string();

        // Call AI for explanation (AI Person 2 builds this)
        let ai_explanation = explain_fraud(&triggered_rules, &tx.transaction_id, score).await.ok();

        results.push(FraudResult {
            transaction_id: tx.transaction_id.clone(),
            customer_name: tx.customer_name.clone(),
            amount: tx.amount,
            risk_score: score,
            risk_level,
            triggered_rules,
            ai_explanation,
        });
    }

    // Sort highest risk first
    results.sort_by(|a, b| b.risk_score.cmp(&a.risk_score));
    let flagged = results.len();

    Ok(Json(ScanResponse {
        total_scanned,
        flagged,
        results,
    }))
}
```

---

## Step 4 — Register the route in `main.rs`

Add this line in your router setup (coordinate with Backend Person 1):

```rust
.route("/api/fraud/scan", post(routes::fraud::scan))
```

And add `use axum::routing::post;` at the top.

---

## Done when

```bash
curl -X POST http://localhost:3000/api/fraud/scan \
  -H "Content-Type: application/json" \
  -d '{}'
```

Returns a `ScanResponse` JSON with flagged transactions, risk scores, triggered rules, and AI explanations.
