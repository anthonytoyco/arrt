from typing import List, Optional

from fastapi import FastAPI
from pydantic import BaseModel

from model import benford_analysis, find_duplicates, score_transactions

app = FastAPI()


class Transaction(BaseModel):
    transaction_id: str
    amount: Optional[float] = None
    customer_name: Optional[str] = None
    cvv_match: Optional[bool] = None
    address_match: Optional[bool] = None
    ip_is_vpn: Optional[bool] = None
    card_present: Optional[bool] = None


class ScoreRequest(BaseModel):
    transactions: List[Transaction]


@app.post("/score")
def score(req: ScoreRequest):
    results = score_transactions([t.model_dump() for t in req.transactions])
    return {"scores": results}


# ── Benford's Law ─────────────────────────────────────────────────────────────

class BenfordRequest(BaseModel):
    amounts: List[float]


@app.post("/benford")
def benford(req: BenfordRequest):
    return benford_analysis(req.amounts)


# ── Duplicate Invoice Detection ───────────────────────────────────────────────

class DuplicateTx(BaseModel):
    transaction_id: str
    order_id: Optional[str] = None
    customer_id: Optional[str] = None
    amount: Optional[float] = None
    timestamp: Optional[str] = None


class DuplicatesRequest(BaseModel):
    transactions: List[DuplicateTx]


@app.post("/duplicates")
def duplicates(req: DuplicatesRequest):
    return find_duplicates([t.model_dump() for t in req.transactions])
