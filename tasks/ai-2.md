# AI Person 2 — Gemini Client + Prompt Engineering

## Your job

Build `src/services/gemini.rs` — the function called from `routes/fraud.rs` to get plain-English fraud explanations.
Own all prompt templates. Make the AI output sound impressive for the demo.

---

## Step 1 — Add your Gemini API key to `.env`

```env
GEMINI_API_KEY=your-key-from-aistudio.google.com
```

---

## Step 2 — Create `src/services/gemini.rs`

Rate limit protection is baked in (Gemini free tier is 15 RPM). The function enforces a ~4 second gap between calls.

```rust
use reqwest::Client;
use serde_json::json;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

static LAST_CALL: AtomicU64 = AtomicU64::new(0);

pub async fn explain_fraud(
    triggered_rules: &[String],
    transaction_id: &str,
    risk_score: u32,
) -> Result<String, Box<dyn std::error::Error>> {
    // Enforce ~4 second gap between calls (15 RPM = 1 per 4s)
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs();
    let last = LAST_CALL.load(Ordering::Relaxed);
    if now - last < 4 {
        tokio::time::sleep(tokio::time::Duration::from_secs(4 - (now - last))).await;
    }
    LAST_CALL.store(now, Ordering::Relaxed);

    let api_key = std::env::var("GEMINI_API_KEY").expect("GEMINI_API_KEY must be set");
    let client = Client::new();

    let rules_text = triggered_rules.join(", ");
    let prompt = build_prompt(transaction_id, risk_score, &rules_text);

    let url = format!(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={}",
        api_key
    );

    let body = json!({
        "contents": [{ "parts": [{ "text": prompt }] }],
        "generationConfig": {
            "maxOutputTokens": 150,
            "temperature": 0.3
        }
    });

    let resp = client
        .post(&url)
        .json(&body)
        .send()
        .await?
        .json::<serde_json::Value>()
        .await?;

    let text = resp["candidates"][0]["content"]["parts"][0]["text"]
        .as_str()
        .unwrap_or("Unable to generate explanation.")
        .trim()
        .to_string();

    Ok(text)
}

fn build_prompt(transaction_id: &str, risk_score: u32, rules: &str) -> String {
    format!(
        "You are a compliance analyst reviewing a suspicious financial transaction. \
        Transaction ID: {}. Risk score: {}/100. \
        The following fraud signals were detected: {}. \
        In 2-3 sentences, explain why this transaction is suspicious and what action \
        the business should take. Be specific and professional. Do not use bullet points.",
        transaction_id, risk_score, rules
    )
}
```

---

## Step 3 — Create `src/services/mod.rs`

```rust
pub mod fraud_rules;
pub mod gemini;
```

---

## Step 4 — Prompt templates to test and tune

Test these prompts directly in Google AI Studio before wiring them in. Tune until output is crisp.

### Fraud explanation prompt

```text
You are a compliance analyst reviewing a suspicious financial transaction.
Transaction ID: TXN-8821. Risk score: 85/100.
The following fraud signals were detected: CVV mismatch, VPN detected, billing and shipping address mismatch.
In 2-3 sentences, explain why this transaction is suspicious and what action the business should take. Be specific and professional. Do not use bullet points.
```

**Target output:**

> "This transaction exhibits multiple indicators of card-not-present fraud: the CVV code did not match bank records, the customer's IP address was routed through a VPN obscuring their true location, and the billing address does not match the shipping destination. These signals together suggest a stolen card being used to ship goods to a drop address. Recommend declining this transaction and flagging the customer account for review."

### Return fraud prompt

```text
You are a fraud analyst. A customer has submitted a refund request.
Transaction amount: $4,200. Refund requested 6 hours after delivery confirmation.
Billing and shipping address did not match at time of purchase.
In 2-3 sentences, assess the return fraud risk and recommend an action.
```

### High-amount anomaly prompt

```text
You are a fraud analyst. A transaction of $12,500 was flagged as a statistical anomaly —
it is 8.3x above this vendor's average transaction amount and the first transaction
between this customer and vendor.
In 2-3 sentences, explain the risk and recommend an action.
```

---

## Done when

```rust
let explanation = explain_fraud(&["CVV mismatch", "VPN detected"], "TXN-001", 65).await?;
// Returns a 2-3 sentence professional fraud explanation
```

Tell Backend Person 2 the function signature so they can wire it into the scan endpoint.
