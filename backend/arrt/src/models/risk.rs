use serde::{Deserialize, Serialize};

#[derive(Deserialize)]
pub struct BusinessRiskRequest {
    pub business_description: String,
    pub countries: Option<Vec<String>>,
}

#[derive(Serialize, Clone)]
pub struct SanctionsHit {
    pub name: String,
    pub country: Option<String>,
    pub topics: Vec<String>,
    pub score: f64,
}

#[derive(Serialize, Clone)]
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
