EASY (1-2 hours each) — get these done tonight
Duplicate Invoice Detection — hash invoice numbers, amounts, dates, and vendor combos. Flag exact and near-duplicates. This is embarrassingly simple but catches one of the most common small business fraud types. Just group-by and count. Small businesses lose thousands to duplicate payments they never notice.

Benford's Law Analysis — check if the leading digits of transaction amounts follow the expected Benford distribution. Real financial data follows this pattern; fabricated data usually doesn't. It's ~20 lines of Python, visually impressive when you chart expected vs actual distributions, and it's a real forensic accounting technique. Gemini explains which digit positions deviate and what that implies.

Round Number Detection — flag transactions that are suspiciously round ($5,000.00 exactly, $10,000.00, $9,999.99 just under reporting thresholds). Structuring transactions to avoid reporting thresholds is a federal crime called "smurfing." Simple regex/filter, but the AI explanation layer makes it powerful.

MEDIUM (2-4 hours each) — pick one or two
Document/Invoice Fraud (Gemini Vision) — the one we discussed. Upload PDF/image → multimodal Gemini analysis → structured fraud assessment. Medium because you need to handle file upload, base64 encoding for Gemini's vision endpoint, and prompt engineering for consistent structured output. But the demo impact is huge.

Vendor Risk Profiling — aggregate all transactions per vendor and score them: how long have they existed in your data, what's their transaction pattern, how concentrated is your spending with them, do they share addresses or bank details with other vendors. No ML needed, just smart aggregation + Gemini narrative. Small businesses often don't realize 60% of their spend goes through one vendor with no contract.

Behavioral Velocity Alerts — time-window analysis of transaction acceleration. Flag when a vendor's transaction frequency or amount jumps 3x+ in a short window. Compare current week vs trailing 30-day average. This catches compromised accounts and rogue employees fast.

HARD (4+ hours) — only if you're ahead of schedule

Transaction Network Analysis — build a graph from your transaction CSV, detect circular flows and suspicious clusters. Impressive but takes time to build the graph logic and visualize it meaningfully.

Cross-Module Intelligence — connect your anomaly detector to your sanctions screener automatically. When a transaction is flagged as anomalous AND the vendor fuzzy-matches a sanctioned entity, escalate it to CRITICAL. This is the "compound signal" that real compliance platforms charge six figures for.
