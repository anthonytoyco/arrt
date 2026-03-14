# Backend Person 1 — Supabase + Data Layer

## Your job
Wire up the database and get transaction data flowing through the API.

---

## Step 1 — Add dependencies to `backend/arrt/Cargo.toml`

```toml
sqlx = { version = "0.8", features = ["runtime-tokio-rustls", "postgres", "uuid", "chrono", "macros"] }
dotenvy = "0.15"
uuid = { version = "1", features = ["v4", "serde"] }
chrono = { version = "0.4", features = ["serde"] }
```

---

## Step 2 — Create `.env` in `backend/arrt/`

```env
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.yspzpbrgnmyostbvmtyu.supabase.co:5432/postgres
RUST_LOG=info
PORT=3000
```

---

## Step 3 — Create `src/models/transaction.rs`

Map the CSV columns to a Rust struct:

```rust
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct Transaction {
    pub transaction_id: String,
    pub order_id: Option<String>,
    pub customer_id: Option<String>,
    pub customer_name: Option<String>,
    pub timestamp: Option<String>,
    pub amount: Option<f64>,
    pub currency: Option<String>,
    pub payment_method: Option<String>,
    pub card_last4: Option<String>,
    pub card_brand: Option<String>,
    pub transaction_status: Option<String>,
    pub merchant_id: Option<String>,
    pub store_id: Option<String>,
    pub refund_status: Option<String>,
    pub ip_address: Option<String>,
    pub ip_country: Option<String>,
    pub ip_is_vpn: Option<bool>,
    pub device_type: Option<String>,
    pub address_match: Option<bool>,
    pub cvv_match: Option<bool>,
    pub avs_result: Option<String>,
    pub card_present: Option<bool>,
    pub entry_mode: Option<String>,
    pub amount_subtotal: Option<f64>,
    pub tax: Option<f64>,
    pub discount_applied: Option<f64>,
}
```

> Only map columns you actually need. Add more as required.

---

## Step 4 — Create `src/state.rs`

```rust
use sqlx::PgPool;

#[derive(Clone)]
pub struct AppState {
    pub db: PgPool,
}
```

---

## Step 5 — Update `src/main.rs` to connect to Supabase

```rust
use axum::{routing::get, Router};
use sqlx::postgres::PgPoolOptions;
use std::{net::SocketAddr, sync::Arc};
use tower_http::cors::{Any, CorsLayer};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

mod models;
mod routes;
mod state;

use state::AppState;

#[tokio::main]
async fn main() {
    dotenvy::dotenv().ok();

    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::new(
            std::env::var("RUST_LOG").unwrap_or_else(|_| "info".into()),
        ))
        .with(tracing_subscriber::fmt::layer())
        .init();

    let database_url = std::env::var("DATABASE_URL").expect("DATABASE_URL must be set");

    let pool = PgPoolOptions::new()
        .max_connections(10)
        .connect(&database_url)
        .await
        .expect("Failed to connect to Supabase");

    let state = Arc::new(AppState { db: pool });

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        .route("/health", get(|| async { "ok" }))
        .route("/api/transactions", get(routes::transactions::list))
        .with_state(state)
        .layer(cors);

    let port: u16 = std::env::var("PORT")
        .unwrap_or_else(|_| "3000".to_string())
        .parse()
        .expect("PORT must be a number");

    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    tracing::info!("Listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
```

---

## Step 6 — Create `src/routes/transactions.rs`

```rust
use axum::{extract::State, Json};
use std::sync::Arc;
use crate::{models::transaction::Transaction, state::AppState};

pub async fn list(State(state): State<Arc<AppState>>) -> Json<Vec<Transaction>> {
    let rows = sqlx::query_as::<_, Transaction>(
        "SELECT * FROM transactions LIMIT 100"
    )
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    Json(rows)
}
```

---

## Done when

`curl http://localhost:3000/api/transactions` returns JSON rows from Supabase.

Hand off `AppState` and the `transactions` table to Backend Person 2.
