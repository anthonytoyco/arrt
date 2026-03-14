# Frontend Person 2 — Dashboard UI

## Your job

Update `app/page.tsx` to use the real backend. The existing components (`RiskBadge`,
`AIExplanationCard`, `RiskSummary`, `ResultsTable`) are already built — just wire them
to live data from `lib/api.ts`.

Wait for Frontend Person 1 to finish `lib/api.ts` before starting Step 2.
You can do Step 1 independently.

---

## What already exists in `components/`

| Component | What it does |
|-----------|-------------|
| `RiskBadge.tsx` | HIGH / MEDIUM / LOW coloured badge |
| `AIExplanationCard.tsx` | Displays Gemini explanation text |
| `RiskSummary.tsx` | Summary stats (total scanned, flagged, etc.) |
| `ResultsTable.tsx` | Table of fraud results |
| `CSVDataTable.tsx` | Editable CSV preview table — NOT needed anymore |

Read each component before editing to understand their props.

---

## Step 1 — Understand the existing components

Open each of the components listed above and note the prop names. You'll need them in Step 2.

---

## Step 2 — Replace `app/page.tsx`

Replace the CSV-upload flow with a live DB-backed fraud scan dashboard:

```tsx
"use client";

import { useEffect, useState } from "react";
import { fetchTransactions, scanFraud } from "@/lib/api";
import type { FraudResult, FraudScanResponse, Transaction } from "@/lib/api";
import { RiskBadge } from "@/components/RiskBadge";
import { AIExplanationCard } from "@/components/AIExplanationCard";
import { RiskSummary } from "@/components/RiskSummary";
import { Button } from "@/components/ui/button";
import { Shield, AlertTriangle } from "lucide-react";

export default function Dashboard() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [scanResult, setScanResult] = useState<FraudScanResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load transactions on mount
  useEffect(() => {
    fetchTransactions()
      .then(setTransactions)
      .catch(() => setError("Could not load transactions. Is the backend running?"));
  }, []);

  async function handleScan() {
    setLoading(true);
    setError(null);
    try {
      const result = await scanFraud();
      setScanResult(result);
    } catch {
      setError("Fraud scan failed. Is the backend running?");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6 space-y-4">
      {/* Header */}
      <header className="flex items-center justify-between px-1">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 tracking-tight">ARRT</h1>
          <p className="text-xs text-gray-500">Fraud Detection Dashboard</p>
        </div>
        <Button
          className="rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm"
          disabled={loading}
          onClick={handleScan}
        >
          {loading ? "Scanning…" : "Run Fraud Scan"}
        </Button>
      </header>

      {error && (
        <div className="rounded-2xl p-3 bg-red-50 border border-red-200 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Summary stats — shown after scan */}
      {scanResult && (
        <RiskSummary
          totalScanned={scanResult.total_scanned}
          flagged={scanResult.flagged}
        />
      )}

      {/* Fraud results */}
      {scanResult && scanResult.results.length > 0 && (
        <div className="space-y-3">
          {scanResult.results.map((r) => (
            <div key={r.transaction_id} className="bg-white rounded-3xl p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{r.transaction_id}</p>
                  <p className="text-xs text-gray-400">
                    {r.customer_name ?? "Unknown"} · ${r.amount?.toFixed(2) ?? "—"}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-400">Score: {r.risk_score}</span>
                  <RiskBadge level={r.risk_level} />
                </div>
              </div>

              {/* Triggered rules */}
              <div className="flex flex-wrap gap-1.5">
                {r.triggered_rules.map((rule) => (
                  <span
                    key={rule}
                    className="text-[11px] bg-gray-100 text-gray-600 rounded-lg px-2 py-0.5"
                  >
                    {rule}
                  </span>
                ))}
              </div>

              {/* AI explanation */}
              {r.ai_explanation && <AIExplanationCard explanation={r.ai_explanation} />}
            </div>
          ))}
        </div>
      )}

      {/* Empty state before scan */}
      {!scanResult && !loading && (
        <div className="bg-white rounded-3xl p-16 shadow-sm text-center text-gray-400">
          <Shield className="h-8 w-8 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Click "Run Fraud Scan" to analyse all transactions.</p>
          <p className="text-xs mt-1">{transactions.length} transactions loaded from database.</p>
        </div>
      )}
    </div>
  );
}
```

> Adjust the props passed to `RiskBadge`, `AIExplanationCard`, and `RiskSummary` to match
> what those components actually accept — read each file first.

---

## Step 3 — Handle the case where AI explanation is missing

The backend returns `"Unable to generate explanation."` when Gemini isn't available.
Don't show the `AIExplanationCard` in that case:

```tsx
{r.ai_explanation && r.ai_explanation !== "Unable to generate explanation." && (
  <AIExplanationCard explanation={r.ai_explanation} />
)}
```

---

## Done when

- Page loads and shows "X transactions loaded from database"
- "Run Fraud Scan" button calls the backend and shows flagged results
- Each result shows: transaction ID, customer, amount, risk badge, triggered rules
- Gemini explanation shown when available
