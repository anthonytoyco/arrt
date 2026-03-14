# Feature Person 1 — Business Risk: API Data Fetching

## Your job

Build the data layer for the business risk feature.
When a user submits their business description, your code fetches live data from
OpenSanctions and UCDP, then hands the raw results to Feature Person 2's LLM service.

---

## The route you own

`POST /api/risk/business`

Request body:
```json
{
  "business_description": "I sell artisan bread",
  "countries": ["RU", "UA"]
}
```

`countries` is optional — if omitted, the LLM will infer relevant ones from the description.

---

## Step 1 — Add response types to `src/models/risk.rs` (new file)

```rust
use serde::{Deserialize, Serialize};

#[derive(Deserialize)]
pub struct BusinessRiskRequest {
    pub business_description: String,
    pub countries: Option<Vec<String>>,
}

#[derive(Serialize)]
pub struct SanctionsHit {
    pub name: String,
    pub country: Option<String>,
    pub topics: Vec<String>,
    pub score: f64,
}

#[derive(Serialize)]
pub struct ConflictEvent {
    pub country: String,
    pub year: u32,
    pub deaths_total: u32,
    pub conflict_name: String,
}

#[derive(Serialize)]
pub struct BusinessRiskReport {
    pub business_description: String,
    pub overall_risk_level: String,
    pub sanctions_hits: Vec<SanctionsHit>,
    pub conflict_events: Vec<ConflictEvent>,
    pub recommendations: Vec<String>,
    pub ai_summary: String,
}
```

Register in `src/models/mod.rs`:
```rust
pub mod risk;
```

---

## Step 2 — Create `src/services/open_sanctions.rs`

OpenSanctions free API — no key needed for basic search.

```rust
use reqwest::Client;
use serde_json::Value;

use crate::models::risk::SanctionsHit;

pub async fn search(client: &Client, query: &str) -> Vec<SanctionsHit> {
    let url = format!(
        "https://api.opensanctions.org/search/default?q={}&limit=10",
        urlencoding::encode(query)
    );

    let resp = client
        .get(&url)
        .header("Accept", "application/json")
        .send()
        .await;

    match resp {
        Ok(r) => match r.json::<Value>().await {
            Ok(v) => parse_sanctions(v),
            Err(_) => vec![],
        },
        Err(_) => vec![],
    }
}

fn parse_sanctions(v: Value) -> Vec<SanctionsHit> {
    v["results"]
        .as_array()
        .unwrap_or(&vec![])
        .iter()
        .map(|r| SanctionsHit {
            name: r["caption"].as_str().unwrap_or("").to_string(),
            country: r["properties"]["country"][0]
                .as_str()
                .map(String::from),
            topics: r["topics"]
                .as_array()
                .unwrap_or(&vec![])
                .iter()
                .filter_map(|t| t.as_str().map(String::from))
                .collect(),
            score: r["score"].as_f64().unwrap_or(0.0),
        })
        .filter(|h| h.score > 0.5)
        .collect()
}
```

Add `urlencoding` to `Cargo.toml`:
```toml
urlencoding = "2"
```

---

## Step 3 — Create `src/services/ucdp.rs`

UCDP (Uppsala Conflict Data Program) — free, no key needed.

```rust
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

    let resp = match reqwest::Client::new().get(&url).send().await {
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
```

---

## Step 4 — Create `src/routes/risk.rs`

```rust
use axum::{extract::State, Json};

use crate::models::risk::{BusinessRiskRequest, BusinessRiskReport};
use crate::services::{llm, open_sanctions, ucdp};
use crate::state::AppState;

pub async fn business_risk(
    State(state): State<AppState>,
    Json(payload): Json<BusinessRiskRequest>,
) -> Json<BusinessRiskReport> {
    // Fetch from both APIs in parallel
    let countries = payload.countries.clone().unwrap_or_default();

    let (sanctions_hits, conflict_events) = tokio::join!(
        open_sanctions::search(&state.http, &payload.business_description),
        ucdp::get_conflicts(&state.http, &countries),
    );

    // Hand off to Feature Person 2's LLM service
    let report = llm::analyze_business_risk(
        &payload.business_description,
        &sanctions_hits,
        &conflict_events,
    )
    .await
    .unwrap_or_else(|_| BusinessRiskReport {
        business_description: payload.business_description.clone(),
        overall_risk_level: "UNKNOWN".to_string(),
        sanctions_hits,
        conflict_events,
        recommendations: vec![],
        ai_summary: "Analysis unavailable.".to_string(),
    });

    Json(report)
}
```

---

## Step 5 — Register

In `src/routes/mod.rs`:
```rust
pub mod risk;
```

In `src/main.rs`:
```rust
.route("/api/risk/business", post(routes::risk::business_risk))
```

---

## Done when

```bash
curl -s -X POST http://localhost:3001/api/risk/business \
  -H "Content-Type: application/json" \
  -d '{"business_description": "I export wheat", "countries": ["RU", "UA"]}' \
  | python3 -m json.tool
```

Returns a JSON report with `sanctions_hits` and `conflict_events` populated (even if `ai_summary` is placeholder).
Coordinate with Feature Person 2 on the `llm::analyze_business_risk` function signature before wiring it.
