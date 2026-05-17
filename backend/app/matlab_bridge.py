"""
MATLAB Engine bridge for SectorStress.

Starting a MATLAB engine is slow (~5-10 seconds), so this module exposes a
process-singleton that boots the engine on first use and reuses it for every
subsequent call. FastAPI's lifespan event should call `get_engine()` at startup
so the first user request doesn't pay the boot cost.

Design choices documented in ../../docs/design-choices.md.
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import TYPE_CHECKING

import numpy as np

if TYPE_CHECKING:
    import matlab.engine

log = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Engine singleton
# ---------------------------------------------------------------------------

_engine: "matlab.engine.MatlabEngine | None" = None


def get_engine() -> "matlab.engine.MatlabEngine":
    """Return the process-wide MATLAB engine, starting it on first call."""
    global _engine
    if _engine is None:
        import matlab.engine  # imported here so the module loads even without MATLAB
        log.info("Starting MATLAB engine — this takes ~5–10 seconds…")
        _engine = matlab.engine.start_matlab()
        # Add the directory containing compute_stress.m to the MATLAB path
        matlab_dir = (Path(__file__).resolve().parent.parent / "matlab").as_posix()
        _engine.addpath(matlab_dir, nargout=0)
        log.info("MATLAB engine ready.")
    return _engine


def shutdown_engine() -> None:
    """Cleanly stop the MATLAB engine (FastAPI shutdown hook)."""
    global _engine
    if _engine is not None:
        _engine.quit()
        _engine = None


# ---------------------------------------------------------------------------
# Stress computation wrapper
# ---------------------------------------------------------------------------

def compute_stress(returns: np.ndarray, window: int = 21) -> dict:
    """Call MATLAB's compute_stress and return a Python-native dict.

    Parameters
    ----------
    returns : np.ndarray of shape (T, N)
        Daily log-returns. T = number of days, N = number of sectors.
    window : int
        Rolling window length in trading days. Default 21 (~1 month).

    Returns
    -------
    dict with keys:
        'volatility' : list[list[float]]   shape (T, N)
        'avg_corr'   : list[float]          length T (NaN for early indices)
        'composite'  : list[float]          length T (NaN for early indices)
    """
    import matlab  # only needed when actually computing

    if returns.ndim != 2:
        raise ValueError(f"returns must be 2-D, got shape {returns.shape}")
    T, N = returns.shape
    if T < window:
        raise ValueError(f"need at least {window} rows of returns; got {T}")

    # Convert numpy → matlab.double (MATLAB's preferred numeric type)
    returns_ml = matlab.double(returns.tolist())

    eng = get_engine()
    result = eng.compute_stress(returns_ml, float(window), nargout=1)

    # result is a MATLAB struct; matlab.engine returns it as a dict-like with
    # MATLAB-typed values. Convert to plain Python lists.
    return {
        "volatility": _ml_to_list(result["volatility"]),
        "avg_corr":   _ml_to_list(result["avg_corr"]),
        "composite":  _ml_to_list(result["composite"]),
    }


def is_engine_ready() -> bool:
    """Return True if the MATLAB engine has been started."""
    return _engine is not None


def _ml_to_list(value):
    """Convert a matlab.double to a Python list.

    Flattens [T x 1] column vectors to 1-D lists so JSON serialization
    of fields like composite/avg_corr is a flat list, not a list of
    single-element lists.
    """
    arr = np.array(value)
    if arr.ndim == 2 and arr.shape[1] == 1:
        arr = arr.flatten()
    return arr.tolist()