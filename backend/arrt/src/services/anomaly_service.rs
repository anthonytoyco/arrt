use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use crate::models::fraud::{BenfordResponse, DigitAnalysis, DuplicateGroup, DuplicatesResponse, ScoringTx};

fn ai_base_url() -> String {
    std::env::var("AI_SERVICE_URL")
        .unwrap_or_else(|_| "http://localhost:8000".to_string())
}

fn ai_service_url() -> String {
    format!("{}/score", ai_base_url().trim_end_matches('/'))
}

#[derive(Serialize)]
struct AnomalyTx<'a> {
    transaction_id: &'a str,
    amount: Option<f64>,
    cvv_match: Option<bool>,
    ip_is_vpn: Option<bool>,
    address_match: Option<bool>,
    card_present: Option<bool>,
}

#[derive(Deserialize)]
struct AnomalyScore {
    transaction_id: String,
    anomaly_score: f64,
}

#[derive(Deserialize)]
struct AnomalyResponse {
    scores: Vec<AnomalyScore>,
}

/// Returns a map of transaction_id → anomaly_score (0.0–1.0, higher = more anomalous).
/// Returns empty map if the AI service is unavailable — never panics.
pub async fn get_anomaly_scores(
    client: &Client,
    transactions: &[ScoringTx],
) -> HashMap<String, f64> {
    let payload: Vec<AnomalyTx> = transactions
        .iter()
        .map(|tx| AnomalyTx {
            transaction_id: &tx.transaction_id,
            amount: tx.amount,
            cvv_match: tx.cvv_match,
            ip_is_vpn: tx.ip_is_vpn,
            address_match: tx.address_match,
            card_present: tx.card_present,
        })
        .collect();

    let result = client
        .post(ai_service_url())
        .json(&serde_json::json!({ "transactions": payload }))
        .send()
        .await;

    match result {
        Ok(res) => match res.json::<AnomalyResponse>().await {
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

// ── Benford's Law ─────────────────────────────────────────────────────────────

pub async fn get_benford_analysis(client: &Client, amounts: &[f64]) -> BenfordResponse {
    let url = format!("{}/benford", ai_base_url().trim_end_matches('/'));
    let result = client
        .post(&url)
        .json(&serde_json::json!({ "amounts": amounts }))
        .send()
        .await;

    match result {
        Ok(res) => match res.json::<serde_json::Value>().await {
            Ok(v) => parse_benford(v),
            Err(_) => benford_unavailable(),
        },
        Err(_) => benford_unavailable(),
    }
}

fn parse_benford(v: serde_json::Value) -> BenfordResponse {
    let sufficient = v["sufficient_data"].as_bool().unwrap_or(false);
    if !sufficient {
        return BenfordResponse {
            sufficient_data: false,
            total_transactions: v["total_transactions"].as_u64().unwrap_or(0) as usize,
            chi_square: None,
            is_suspicious: None,
            digit_analysis: vec![],
            flagged_digits: vec![],
            ai_explanation: None,
        };
    }
    let digit_analysis = v["digit_analysis"]
        .as_array()
        .unwrap_or(&vec![])
        .iter()
        .map(|d| DigitAnalysis {
            digit: d["digit"].as_u64().unwrap_or(0) as u8,
            expected_pct: d["expected_pct"].as_f64().unwrap_or(0.0),
            observed_pct: d["observed_pct"].as_f64().unwrap_or(0.0),
            deviation: d["deviation"].as_f64().unwrap_or(0.0),
            flagged: d["flagged"].as_bool().unwrap_or(false),
        })
        .collect();
    let flagged_digits = v["flagged_digits"]
        .as_array()
        .unwrap_or(&vec![])
        .iter()
        .filter_map(|d| d.as_u64().map(|n| n as u8))
        .collect();
    BenfordResponse {
        sufficient_data: true,
        total_transactions: v["total_transactions"].as_u64().unwrap_or(0) as usize,
        chi_square: v["chi_square"].as_f64(),
        is_suspicious: v["is_suspicious"].as_bool(),
        digit_analysis,
        flagged_digits,
        ai_explanation: None,
    }
}

fn benford_unavailable() -> BenfordResponse {
    BenfordResponse {
        sufficient_data: false,
        total_transactions: 0,
        chi_square: None,
        is_suspicious: None,
        digit_analysis: vec![],
        flagged_digits: vec![],
        ai_explanation: Some("AI service unavailable.".to_string()),
    }
}

// ── Duplicate Invoice Detection ───────────────────────────────────────────────

#[derive(Serialize)]
struct DuplicateTxPayload<'a> {
    transaction_id: &'a str,
    order_id: Option<&'a str>,
    customer_id: Option<&'a str>,
    amount: Option<f64>,
    timestamp: Option<&'a str>,
}

pub async fn get_duplicates(
    client: &Client,
    transactions: &[crate::models::transaction::Transaction],
) -> DuplicatesResponse {
    let url = format!("{}/duplicates", ai_base_url().trim_end_matches('/'));
    let payload: Vec<DuplicateTxPayload> = transactions
        .iter()
        .map(|tx| DuplicateTxPayload {
            transaction_id: &tx.transaction_id,
            order_id: tx.order_id.as_deref(),
            customer_id: tx.customer_id.as_deref(),
            amount: tx.amount,
            timestamp: tx.timestamp.as_deref(),
        })
        .collect();

    let result = client
        .post(&url)
        .json(&serde_json::json!({ "transactions": payload }))
        .send()
        .await;

    match result {
        Ok(res) => match res.json::<serde_json::Value>().await {
            Ok(v) => parse_duplicates(v),
            Err(_) => duplicates_unavailable(),
        },
        Err(_) => duplicates_unavailable(),
    }
}

fn parse_duplicates(v: serde_json::Value) -> DuplicatesResponse {
    let groups = v["duplicate_groups"]
        .as_array()
        .unwrap_or(&vec![])
        .iter()
        .map(|g| DuplicateGroup {
            r#type: g["type"].as_str().unwrap_or("").to_string(),
            customer_id: g["customer_id"].as_str().map(String::from),
            amount: g["amount"].as_f64(),
            date: g["date"].as_str().map(String::from),
            order_id: g["order_id"].as_str().map(String::from),
            transaction_ids: g["transaction_ids"]
                .as_array()
                .unwrap_or(&vec![])
                .iter()
                .filter_map(|id| id.as_str().map(String::from))
                .collect(),
            count: g["count"].as_u64().unwrap_or(0) as usize,
        })
        .collect::<Vec<_>>();

    DuplicatesResponse {
        total_duplicate_groups: groups.len(),
        duplicate_groups: groups,
        ai_explanation: None,
    }
}

fn duplicates_unavailable() -> DuplicatesResponse {
    DuplicatesResponse {
        total_duplicate_groups: 0,
        duplicate_groups: vec![],
        ai_explanation: Some("AI service unavailable.".to_string()),
    }
}
