use reqwest::Client;

use crate::models::risk::ConflictEvent;

pub async fn get_conflicts(client: &Client, countries: &[String]) -> Vec<ConflictEvent> {
    if countries.is_empty() {
        return vec![];
    }

    // UCDP uses country names not ISO codes — map common ones
    let country_str = countries.join(";");

    let url = format!(
        "https://ucdpapi.pcr.uu.se/api/gedevents/23.1?pagesize=50&country={}",
        urlencoding::encode(&country_str)
    );

    let resp = match client.get(&url).send().await {
        Ok(r) => r,
        Err(_) => return vec![],
    };

    let v: serde_json::Value = match resp.json().await {
        Ok(v) => v,
        Err(_) => return vec![],
    };

    v["Result"]
        .as_array()
        .unwrap_or(&vec![])
        .iter()
        .map(|e| ConflictEvent {
            country: e["country"].as_str().unwrap_or("").to_string(),
            year: e["year"].as_u64().unwrap_or(0) as u32,
            deaths_total: e["deaths_total"].as_u64().unwrap_or(0) as u32,
            conflict_name: e["conflict_name"].as_str().unwrap_or("").to_string(),
        })
        .collect()
}
