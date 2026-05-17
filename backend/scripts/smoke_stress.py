"""
Smoke test for the SectorStress data + MATLAB pipeline.

Run from backend/ with the venv active:
    python scripts/smoke_stress.py
"""

import logging
import sys
from datetime import date, timedelta
from pathlib import Path

# Make backend/ importable when running this script as a file
BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

import numpy as np

from app.data import fetch_returns
from app.matlab_bridge import compute_stress

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")


def main() -> int:
    tickers = ["XLF", "XLE", "XLK"]
    end_date = date.today()
    start_date = end_date - timedelta(days=400)  # ~1 year of trading days
    window = 21

    print(f"Fetching {tickers} from {start_date} to {end_date}…")
    try:
        returns_df, returns_arr = fetch_returns(
            tickers,
            start=start_date.isoformat(),
            end=end_date.isoformat(),
        )
    except Exception as e:
        print(f"ERROR: data fetch failed: {e}")
        return 1

    print(f"  ✓ returns shape: {returns_arr.shape}")
    print(f"    date range: {returns_df.index[0].date()} → {returns_df.index[-1].date()}")
    print(f"    any NaN: {np.isnan(returns_arr).any()}")

    print(f"\nComputing stress (window={window})…")
    try:
        result = compute_stress(returns_arr, window=window)
    except Exception as e:
        print(f"ERROR: MATLAB compute failed: {e}")
        return 1

    composite = np.array(result["composite"]).flatten()
    print(f"  ✓ composite shape: {composite.shape}")
    print(f"    first 5: {composite[:5]}")
    print(f"    last 5:  {composite[-5:]}")
    print(f"    NaN count: {np.isnan(composite).sum()} (expected ≈ {window - 1})")
    print(f"    min/max (non-NaN): {np.nanmin(composite):.4f} / {np.nanmax(composite):.4f}")

    print("\nSmoke test PASSED.")
    return 0


if __name__ == "__main__":
    sys.exit(main())