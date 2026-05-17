"""
SectorStress FastAPI application.

Serves /health, /api/sectors, and /api/stress endpoints. Pre-warms the
MATLAB engine at startup so the first user request doesn't pay the cost.
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from datetime import date, timedelta

import numpy as np
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.data import fetch_returns
from app.matlab_bridge import (
    compute_stress,
    get_engine,
    is_engine_ready,
    shutdown_engine,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s: %(message)s",
)
log = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Sector catalog
# ---------------------------------------------------------------------------

SECTOR_CATALOG = [
    {"ticker": "XLF",  "name": "Financials"},
    {"ticker": "XLE",  "name": "Energy"},
    {"ticker": "XLK",  "name": "Technology"},
    {"ticker": "XLV",  "name": "Healthcare"},
    {"ticker": "XLI",  "name": "Industrials"},
    {"ticker": "XLP",  "name": "Consumer Staples"},
    {"ticker": "XLY",  "name": "Consumer Discretionary"},
    {"ticker": "XLU",  "name": "Utilities"},
    {"ticker": "XLB",  "name": "Materials"},
    {"ticker": "XLRE", "name": "Real Estate"},
    {"ticker": "XLC",  "name": "Communication Services"},
]
SECTOR_TICKERS = {s["ticker"] for s in SECTOR_CATALOG}


# ---------------------------------------------------------------------------
# Lifespan: warm the MATLAB engine at startup, shut it down cleanly
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("Lifespan startup: pre-warming MATLAB engine…")
    get_engine()  # boots the singleton; subsequent calls are instant
    log.info("Lifespan startup complete.")
    yield
    log.info("Lifespan shutdown: stopping MATLAB engine…")
    shutdown_engine()


app = FastAPI(title="SectorStress API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Vite default
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Response models
# ---------------------------------------------------------------------------

class HealthResponse(BaseModel):
    status: str
    matlab_engine_ready: bool


class Sector(BaseModel):
    ticker: str
    name: str


class StressResponse(BaseModel):
    sectors: list[str]
    dates: list[str]
    composite: list[float | None]    # None for leading NaN values
    avg_corr: list[float | None]
    volatility: list[list[float]]    # shape [T x N]
    window: int


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.get("/health", response_model=HealthResponse)
def health():
    return HealthResponse(status="ok", matlab_engine_ready=is_engine_ready())


@app.get("/api/sectors", response_model=list[Sector])
def sectors():
    return [Sector(**s) for s in SECTOR_CATALOG]


@app.get("/api/stress", response_model=StressResponse)
def stress(
    sectors: list[str] = Query(default=["XLF", "XLE", "XLK"]),
    start: str | None = Query(default=None, description="ISO date; defaults to ~1 year ago"),
    end: str | None = Query(default=None, description="ISO date; defaults to today"),
    window: int = Query(default=21, ge=2, le=252),
):
    # Validate sectors
    unknown = [s for s in sectors if s not in SECTOR_TICKERS]
    if unknown:
        raise HTTPException(400, f"Unknown sector tickers: {unknown}")
    if len(sectors) < 2:
        raise HTTPException(400, "Need at least 2 sectors for cross-sector correlation.")

    # Default date range
    if end is None:
        end = date.today().isoformat()
    if start is None:
        start = (date.today() - timedelta(days=400)).isoformat()

    # Fetch + compute
    try:
        returns_df, returns_arr = fetch_returns(sectors, start=start, end=end)
    except Exception as e:
        raise HTTPException(502, f"Data fetch failed: {e}") from e

    if returns_arr.shape[0] < window:
        raise HTTPException(
            400,
            f"Window ({window}) too large for date range — only {returns_arr.shape[0]} days of data.",
        )

    try:
        result = compute_stress(returns_arr, window=window)
    except Exception as e:
        raise HTTPException(500, f"MATLAB compute failed: {e}") from e

    # JSON can't represent NaN — convert to None
    composite = [None if np.isnan(v) else float(v) for v in result["composite"]]
    avg_corr  = [None if np.isnan(v) else float(v) for v in result["avg_corr"]]

    return StressResponse(
        sectors=sectors,
        dates=[d.date().isoformat() for d in returns_df.index],
        composite=composite,
        avg_corr=avg_corr,
        volatility=result["volatility"],
        window=window,
    )