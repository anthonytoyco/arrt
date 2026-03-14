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
