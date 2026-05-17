"""
Yahoo Finance data fetcher for SectorStress.

Fetches adjusted-close prices for one or more tickers, computes daily log
returns, and caches raw price downloads to disk so repeated calls don't
hit Yahoo. compute_stress.m requires NaN-free input, so we align all
tickers to common trading dates and drop any remaining NaN rows before
returning.
"""

from __future__ import annotations

import logging
from pathlib import Path

import numpy as np
import pandas as pd
import yfinance as yf

log = logging.getLogger(__name__)

CACHE_DIR = Path(__file__).resolve().parent.parent / "data" / "cache"


def fetch_returns(
    tickers: list[str],
    start: str,
    end: str,
) -> tuple[pd.DataFrame, np.ndarray]:
    """Fetch daily log returns for the given tickers, with on-disk caching.

    Returns
    -------
    returns_df : pd.DataFrame
        Indexed by date, one column per ticker, daily log returns, NaN-free.
    returns_arr : np.ndarray
        Same data as a contiguous float64 array, shape (T, N), ready for
        matlab_bridge.compute_stress.
    """
    CACHE_DIR.mkdir(parents=True, exist_ok=True)

    price_series = []
    for ticker in tickers:
        cache_path = CACHE_DIR / f"{ticker}_{start}_{end}.csv"
        if cache_path.exists():
            log.info("Loading %s from cache", ticker)
            prices = pd.read_csv(cache_path, index_col=0, parse_dates=True).squeeze("columns")
        else:
            log.info("Fetching %s from Yahoo", ticker)
            data = yf.download(ticker, start=start, end=end, progress=False, auto_adjust=True)
            if data.empty:
                raise ValueError(f"No data returned for {ticker} in {start}..{end}")
            # yfinance sometimes returns MultiIndex columns; flatten if needed
            if isinstance(data.columns, pd.MultiIndex):
                data.columns = data.columns.get_level_values(0)
            prices = data["Close"]
            prices.to_csv(cache_path)
        prices.name = ticker
        price_series.append(prices)

    # Align to common trading dates, then compute log returns
    prices_df = pd.concat(price_series, axis=1).dropna(how="any")
    returns_df = np.log(prices_df / prices_df.shift(1)).dropna(how="any")

    returns_arr = np.ascontiguousarray(returns_df.values, dtype=np.float64)
    return returns_df, returns_arr