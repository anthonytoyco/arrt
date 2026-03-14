import pandas as pd
from collections import defaultdict
from sklearn.ensemble import IsolationForest

# ── Isolation Forest ──────────────────────────────────────────────────────────

def score_transactions(transactions: list[dict]) -> list[dict]:
    df = pd.DataFrame(transactions)
    numeric = df.select_dtypes(include="number").fillna(0)

    if numeric.empty or len(numeric) < 5:
        return [
            {"transaction_id": t["transaction_id"], "anomaly_score": 0.0}
            for t in transactions
        ]

    model = IsolationForest(contamination=0.05, random_state=42)
    raw_scores = model.fit(numeric).decision_function(numeric)

    min_s, max_s = raw_scores.min(), raw_scores.max()
    normalized = [
        (max_s - s) / (max_s - min_s) if max_s != min_s else 0.0 for s in raw_scores
    ]

    return [
        {"transaction_id": t["transaction_id"], "anomaly_score": round(score, 4)}
        for t, score in zip(transactions, normalized)
    ]


# ── Benford's Law ─────────────────────────────────────────────────────────────

BENFORD_EXPECTED = {
    1: 30.103, 2: 17.609, 3: 12.494, 4: 9.691,
    5: 7.918,  6: 6.695,  7: 5.799,  8: 5.115, 9: 4.576,
}

# Chi-squared critical value at p=0.05, df=8
_CHI2_CRITICAL = 15.507


def benford_analysis(amounts: list[float]) -> dict:
    digits = []
    for amt in amounts:
        if amt and amt > 0:
            s = str(int(abs(amt)))
            if s and s[0] != "0":
                digits.append(int(s[0]))

    if len(digits) < 5:
        return {"sufficient_data": False, "total_transactions": len(digits)}

    n = len(digits)
    observed_counts = {d: 0 for d in range(1, 10)}
    for d in digits:
        if 1 <= d <= 9:
            observed_counts[d] += 1

    observed_pct = {d: (observed_counts[d] / n) * 100 for d in range(1, 10)}
    expected_counts = {d: (BENFORD_EXPECTED[d] / 100) * n for d in range(1, 10)}

    chi2 = sum(
        (observed_counts[d] - expected_counts[d]) ** 2 / expected_counts[d]
        for d in range(1, 10)
        if expected_counts[d] > 0
    )
    is_suspicious = chi2 > _CHI2_CRITICAL

    digit_analysis = [
        {
            "digit": d,
            "expected_pct": round(BENFORD_EXPECTED[d], 2),
            "observed_pct": round(observed_pct[d], 2),
            "deviation": round(observed_pct[d] - BENFORD_EXPECTED[d], 2),
            "flagged": abs(observed_pct[d] - BENFORD_EXPECTED[d]) > 5,
        }
        for d in range(1, 10)
    ]

    return {
        "sufficient_data": True,
        "total_transactions": n,
        "chi_square": round(chi2, 4),
        "is_suspicious": is_suspicious,
        "digit_analysis": digit_analysis,
        "flagged_digits": [d["digit"] for d in digit_analysis if d["flagged"]],
    }


# ── Duplicate Invoice Detection ───────────────────────────────────────────────

def find_duplicates(transactions: list[dict]) -> dict:
    amount_date_groups: dict = defaultdict(list)
    order_id_map: dict = defaultdict(list)

    for tx in transactions:
        timestamp = tx.get("timestamp") or ""
        date = timestamp[:10] if len(timestamp) >= 10 else timestamp
        amount = tx.get("amount")
        customer_id = tx.get("customer_id") or "unknown"

        if amount is not None:
            key = f"{customer_id}|{amount}|{date}"
            amount_date_groups[key].append(tx["transaction_id"])

        order_id = tx.get("order_id")
        if order_id:
            order_id_map[order_id].append(tx["transaction_id"])

    duplicate_groups = []

    for key, txn_ids in amount_date_groups.items():
        if len(txn_ids) > 1:
            parts = key.split("|", 2)
            duplicate_groups.append({
                "type": "same_amount_customer_date",
                "customer_id": parts[0],
                "amount": float(parts[1]) if parts[1] else None,
                "date": parts[2] if len(parts) > 2 else "",
                "transaction_ids": txn_ids,
                "count": len(txn_ids),
            })

    for order_id, txn_ids in order_id_map.items():
        if len(txn_ids) > 1:
            duplicate_groups.append({
                "type": "duplicate_order_id",
                "order_id": order_id,
                "transaction_ids": txn_ids,
                "count": len(txn_ids),
            })

    return {
        "total_duplicate_groups": len(duplicate_groups),
        "duplicate_groups": duplicate_groups,
    }
