# Frontend Person 1 — API Layer + Types

## Your job

The frontend was built against a different API contract. Update `lib/api.ts` so it matches
the real Rust backend, then wire the existing components to live data.

Backend is running at `http://localhost:3001` locally and will be deployed on Render.

---

## Current mismatch

| Frontend expects | Rust backend has |
|-----------------|-----------------|
| `POST /api/anomalies` (file upload) | `POST /api/fraud/scan` (JSON) |
| `POST /api/sanctions` (file upload) | ❌ not built |
| `POST /api/georisk` (JSON) | ❌ not built |
| `GET` nothing | `GET /api/transactions` |

Focus on fraud scan + transactions. Remove/stub sanctions and georisk for now.

---

## Step 1 — Update `.env.local` in `frontend/`

```env
NEXT_PUBLIC_BACKEND_URL=http://localhost:3001
```

---

## Step 2 — Replace `lib/api.ts` with the correct types and functions

```ts
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:3001";

// ── Types matching Rust backend ───────────────────────────────────────────────

export interface FraudResult {
  transaction_id: string;
  customer_name: string | null;
  amount: number | null;
  risk_score: number;
  risk_level: "HIGH" | "MEDIUM" | "LOW";
  triggered_rules: string[];
  ai_explanation: string | null;
}

export interface FraudScanResponse {
  total_scanned: number;
  flagged: number;
  results: FraudResult[];
}

export interface Transaction {
  transaction_id: string;
  order_id: string | null;
  customer_id: string | null;
  customer_name: string | null;
  timestamp: string | null;
  amount: number | null;
  currency: string | null;
  payment_method: string | null;
  card_last4: string | null;
  card_brand: string | null;
  transaction_status: string | null;
  merchant_id: string | null;
  refund_status: string | null;
  ip_country: string | null;
  ip_is_vpn: boolean | null;
  device_type: string | null;
  address_match: boolean | null;
  cvv_match: boolean | null;
  avs_result: string | null;
  card_present: boolean | null;
  entry_mode: string | null;
}

// ── API functions ─────────────────────────────────────────────────────────────

/** Scan all transactions or a specific list for fraud */
export async function scanFraud(transactionIds?: string[]): Promise<FraudScanResponse> {
  const res = await fetch(`${BACKEND_URL}/api/fraud/scan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(transactionIds ? { transaction_ids: transactionIds } : {}),
  });
  if (!res.ok) throw new Error(`Fraud scan failed: ${res.status}`);
  return res.json();
}

/** Fetch all transactions from the database */
export async function fetchTransactions(): Promise<Transaction[]> {
  const res = await fetch(`${BACKEND_URL}/api/transactions`);
  if (!res.ok) throw new Error(`Failed to fetch transactions: ${res.status}`);
  return res.json();
}
```

---

## Step 3 — Test it in the browser console

Open `http://localhost:3000` and run in DevTools:

```js
// Should return array of transactions
fetch("http://localhost:3001/api/transactions").then(r => r.json()).then(console.log)

// Should return fraud results
fetch("http://localhost:3001/api/fraud/scan", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: "{}"
}).then(r => r.json()).then(console.log)
```

---

## Done when

- `fetchTransactions()` returns an array of `Transaction` objects
- `scanFraud()` returns a `FraudScanResponse` with `total_scanned`, `flagged`, `results`
- No TypeScript errors in `lib/api.ts`

Hand `FraudResult` and `Transaction` types to Frontend Person 2.
