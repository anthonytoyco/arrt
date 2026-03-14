use reqwest::Client;
use serde_json::json;

const OPENAI_BASE_URL: &str =
    "https://vjioo4r1vyvcozuj.us-east-2.aws.endpoints.huggingface.cloud/v1";
const MODEL: &str = "openai/gpt-oss-120b";

pub async fn explain_fraud(
    triggered_rules: &[String],
    transaction_id: &str,
    risk_score: u32,
) -> Result<String, Box<dyn std::error::Error>> {
    let client = Client::new();
    let rules_text = triggered_rules.join(", ");
    let prompt = build_prompt(transaction_id, risk_score, &rules_text);

    let resp = client
        .post(format!("{}/chat/completions", OPENAI_BASE_URL))
        .header("Authorization", "Bearer test")
        .header("Content-Type", "application/json")
        .json(&json!({
            "model": MODEL,
            "messages": [
                {
                    "role": "system",
                    "content": "You are a compliance analyst specializing in financial fraud detection. Be concise and professional."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            "max_tokens": 600,
            "temperature": 0.3
        }))
        .send()
        .await?
        .json::<serde_json::Value>()
        .await?;

    tracing::info!("GPT-OSS response: {}", resp);

    // Reasoning models put final answer in "content"; fall back to "reasoning" if content is null
    let message = &resp["choices"][0]["message"];
    let text = message["content"]
        .as_str()
        .or_else(|| message["reasoning"].as_str())
        .unwrap_or("Unable to generate explanation.")
        .trim()
        .to_string();

    Ok(text)
}

fn build_prompt(transaction_id: &str, risk_score: u32, rules: &str) -> String {
    format!(
        "Transaction ID: {}. Risk score: {}/100. \
        Fraud signals: {}. \
        In exactly 2 short sentences: explain why it's suspicious, then state the action. \
        Under 100 words. No bullet points.",
        transaction_id, risk_score, rules
    )
}
