# Backend Person 1 — Pagination, Filtering + Report Endpoint

## Your job

Two tasks:
1. Add pagination and filtering to `GET /api/transactions`
2. Build `POST /api/fraud/report` — lets users mark a transaction as confirmed fraud

---

## Part 1 — Pagination + Filtering for `GET /api/transactions`

Right now the endpoint returns all rows with `LIMIT 100`. Make it actually useful for the frontend.

### Step 1 — Update `src/routes/transactions.rs`

```rust
use axum::{extract::{Query, State}, Json};
use serde::Deserialize;

use crate::{models::transaction::Transaction, state::AppState};

#[derive(Deserialize)]
pub struct TransactionQuery {
    pub limit: Option<i64>,
    pub offset: Option<i64>,
    pub risk_level: Option<String>,    // "HIGH" | "MEDIUM" | "LOW"
    pub customer_id: Option<String>,
}

pub async fn list(
    State(state): State<AppState>,
    Query(params): Query<TransactionQuery>,
) -> Json<Vec<Transaction>> {
    let limit = params.limit.unwrap_or(50).min(200);
    let offset = params.offset.unwrap_or(0);

    let rows = sqlx::query_as::<_, Transaction>(
        "SELECT * FROM transactions ORDER BY timestamp DESC LIMIT $1 OFFSET $2"
    )
    .bind(limit)
    .bind(offset)
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    Json(rows)
}
```

Test with:
```bash
curl "http://localhost:3001/api/transactions?limit=10&offset=0"
curl "http://localhost:3001/api/transactions?limit=10&offset=10"
```

---

## Part 2 — `POST /api/fraud/report` endpoint

Lets a user confirm a transaction is fraudulent. Stores it in a `fraud_reports` table.
This creates a feedback loop — AI Person 1 can use this data to retrain the model later.

### Step 1 — Create the table (run once in Render DB)

```sql
CREATE TABLE IF NOT EXISTS fraud_reports (
    id SERIAL PRIMARY KEY,
    transaction_id TEXT NOT NULL,
    confirmed_fraud BOOLEAN NOT NULL,
    reported_by TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

Run this via the Render dashboard shell, or add it to a `migrations/` folder.

### Step 2 — Add request/response models to `src/models/fraud.rs`

```rust
#[derive(Deserialize)]
pub struct FraudReportRequest {
    pub transaction_id: String,
    pub confirmed_fraud: bool,
    pub reported_by: Option<String>,
    pub notes: Option<String>,
}

#[derive(Serialize)]
pub struct FraudReportResponse {
    pub success: bool,
    pub transaction_id: String,
    pub message: String,
}
```

### Step 3 — Create `src/routes/fraud_report.rs`

```rust
use axum::{extract::State, Json};

use crate::models::fraud::{FraudReportRequest, FraudReportResponse};
use crate::state::AppState;

pub async fn report(
    State(state): State<AppState>,
    Json(payload): Json<FraudReportRequest>,
) -> Json<FraudReportResponse> {
    let result = sqlx::query(
        "INSERT INTO fraud_reports (transaction_id, confirmed_fraud, reported_by, notes)
         VALUES ($1, $2, $3, $4)"
    )
    .bind(&payload.transaction_id)
    .bind(payload.confirmed_fraud)
    .bind(&payload.reported_by)
    .bind(&payload.notes)
    .execute(&state.db)
    .await;

    match result {
        Ok(_) => Json(FraudReportResponse {
            success: true,
            transaction_id: payload.transaction_id,
            message: "Report saved.".to_string(),
        }),
        Err(e) => {
            tracing::error!("Failed to save fraud report: {}", e);
            Json(FraudReportResponse {
                success: false,
                transaction_id: payload.transaction_id,
                message: "Failed to save report.".to_string(),
            })
        }
    }
}
```

### Step 4 — Register in `src/routes/mod.rs`

```rust
pub mod fraud;
pub mod fraud_report;
pub mod transactions;
```

### Step 5 — Register in `src/main.rs`

```rust
.route("/api/fraud/report", post(routes::fraud_report::report))
```

### Test

```bash
curl -X POST http://localhost:3001/api/fraud/report \
  -H "Content-Type: application/json" \
  -d '{
    "transaction_id": "TXN-002",
    "confirmed_fraud": true,
    "reported_by": "analyst@arrt.com",
    "notes": "Customer disputed, card issuer confirmed stolen"
  }'
```

Expected response:
```json
{ "success": true, "transaction_id": "TXN-002", "message": "Report saved." }
```

---

## Done when

- `GET /api/transactions?limit=10&offset=0` returns paginated results
- `POST /api/fraud/report` saves to DB and returns `{ "success": true }`
- `cargo build` passes with no errors
