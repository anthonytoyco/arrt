# Feature Person 2 — Business Risk: LLM Analysis + Report

## Your job

Build the LLM layer that takes a business description + raw API data
and generates a structured risk report with recommendations.

Wait for Feature Person 1 to confirm the `SanctionsHit` and `ConflictEvent`
struct shapes before finalising the prompt — they determine what data you'll have.

---

## The function you own

```rust
// src/services/llm.rs — add this function
pub async fn analyze_business_risk(
    business_description: &str,
    sanctions_hits: &[SanctionsHit],
    conflict_events: &[ConflictEvent],
) -> Result<BusinessRiskReport, Box<dyn std::error::Error>>
```

---

## Step 1 — Add imports to `src/services/llm.rs`

```rust
use crate::models::risk::{BusinessRiskReport, ConflictEvent, SanctionsHit};
```

---

## Step 2 — Build the prompt

```rust
fn build_risk_prompt(
    business: &str,
    sanctions: &[SanctionsHit],
    conflicts: &[ConflictEvent],
) -> String {
    let sanctions_text = if sanctions.is_empty() {
        "No sanctions hits found.".to_string()
    } else {
        sanctions
            .iter()
            .map(|s| format!("- {} (score: {:.2}, topics: {})", s.name, s.score, s.topics.join(", ")))
            .collect::<Vec<_>>()
            .join("\n")
    };

    let conflicts_text = if conflicts.is_empty() {
        "No active conflict events found for specified countries.".to_string()
    } else {
        conflicts
            .iter()
            .map(|c| format!("- {} ({}): {} deaths in {}", c.conflict_name, c.country, c.deaths_total, c.year))
            .collect::<Vec<_>>()
            .join("\n")
    };

    format!(
        "You are a geopolitical risk analyst. A business has submitted the following description: \"{}\"\n\n\
        SANCTIONS DATA:\n{}\n\n\
        CONFLICT DATA:\n{}\n\n\
        Based on this data, return ONLY a valid JSON object with this exact structure:\n\
        {{\n\
          \"overall_risk_level\": \"HIGH|MEDIUM|LOW\",\n\
          \"recommendations\": [\"rec 1\", \"rec 2\", \"rec 3\"],\n\
          \"ai_summary\": \"2-3 sentence executive summary of the risk and what the business should do\"\n\
        }}\n\
        No markdown. Return only the JSON.",
        business, sanctions_text, conflicts_text
    )
}
```

---

## Step 3 — Implement `analyze_business_risk`

```rust
pub async fn analyze_business_risk(
    business_description: &str,
    sanctions_hits: &[SanctionsHit],
    conflict_events: &[ConflictEvent],
) -> Result<BusinessRiskReport, Box<dyn std::error::Error>> {
    let client = Client::new();
    let prompt = build_risk_prompt(business_description, sanctions_hits, conflict_events);

    let resp = client
        .post(format!("{}/chat/completions", OPENAI_BASE_URL))
        .header("Authorization", "Bearer test")
        .header("Content-Type", "application/json")
        .json(&json!({
            "model": MODEL,
            "messages": [
                {
                    "role": "system",
                    "content": "You are a geopolitical risk analyst. Return only valid JSON."
                },
                { "role": "user", "content": prompt }
            ],
            "max_tokens": 600,
            "temperature": 0.2
        }))
        .send()
        .await?
        .json::<serde_json::Value>()
        .await?;

    let message = &resp["choices"][0]["message"];
    let text = message["content"]
        .as_str()
        .or_else(|| message["reasoning"].as_str())
        .unwrap_or("")
        .trim();

    let clean = text
        .trim_start_matches("```json")
        .trim_start_matches("```")
        .trim_end_matches("```")
        .trim();

    let parsed: serde_json::Value = serde_json::from_str(clean)?;

    Ok(BusinessRiskReport {
        business_description: business_description.to_string(),
        overall_risk_level: parsed["overall_risk_level"]
            .as_str()
            .unwrap_or("LOW")
            .to_string(),
        sanctions_hits: sanctions_hits.to_vec(),
        conflict_events: conflict_events.to_vec(),
        recommendations: parsed["recommendations"]
            .as_array()
            .unwrap_or(&vec![])
            .iter()
            .filter_map(|r| r.as_str().map(String::from))
            .collect(),
        ai_summary: parsed["ai_summary"].as_str().unwrap_or("").to_string(),
    })
}
```

> For `.to_vec()` to work, add `#[derive(Clone)]` to `SanctionsHit` and `ConflictEvent` in `models/risk.rs`.

---

## Step 4 — Test the prompt in isolation first

Before wiring into Rust, test your prompt directly against the LLM:

```bash
curl -s -X POST https://vjioo4r1vyvcozuj.us-east-2.aws.endpoints.huggingface.cloud/v1/chat/completions \
  -H "Authorization: Bearer test" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "openai/gpt-oss-120b",
    "messages": [
      {"role": "system", "content": "You are a geopolitical risk analyst. Return only valid JSON."},
      {"role": "user", "content": "Business: I export wheat. Sanctions: - Rosoboronexport (score: 0.95, topics: sanction, arms). Conflicts: - Russo-Ukrainian War (Ukraine): 12000 deaths in 2023. Return JSON with overall_risk_level, recommendations array, ai_summary."}
    ],
    "max_tokens": 600
  }' | python3 -m json.tool
```

Tune the prompt until the JSON is clean and recommendations are specific.

---

## Done when

```bash
curl -s -X POST http://localhost:3001/api/risk/business \
  -H "Content-Type: application/json" \
  -d '{"business_description": "I export wheat", "countries": ["RU", "UA"]}' \
  | python3 -m json.tool
```

Returns a full report with `overall_risk_level`, `recommendations`, and a populated `ai_summary`.
