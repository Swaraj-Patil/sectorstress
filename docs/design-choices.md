# Design choices and tradeoffs

A running log of technical decisions made during SectorStress development.

This document exists in part because evaluating computational tools rigorously is part of any real research-software project, and Profs. Chiou and Oet may look at it when reviewing this work.

---

## MATLAB ↔ Python bridge

**Choice:** `matlab.engine` (MathWorks's official Python package).

**Alternatives:**
- Compiling MATLAB code to a standalone executable via MATLAB Compiler, then calling the executable from Python — more deployment-friendly but adds a build step every time the MATLAB code changes.
- Translating the MATLAB to Python (with NumPy / SciPy) — defeats the purpose of integrating with the lab's MATLAB-based research.
- Octave + `oct2py` — free, but Octave is not feature-complete with MATLAB toolboxes, and the lab is literally named MathWorks Lab.

**Why:** `matlab.engine` keeps a single source of MATLAB truth (real `.m` files), runs them in-process from Python, and supports passing MATLAB types back to Python cleanly. The cost is a slow engine startup (~5–10s); we amortize that with a process-singleton in `matlab_bridge.py`.

---

## Engine lifecycle

**Choice:** Process-singleton engine, started once at FastAPI lifespan-startup, reused across requests, cleanly stopped on shutdown.

**Alternative:** Start a fresh engine per request — clean isolation, but unusable in practice (every API call would pay the 5–10 second startup cost).

**Tradeoff:** Singleton means one slow user could in principle block other users on the same MATLAB call. Acceptable for a single-user research tool; would need an engine pool for multi-user serving.

---

## Stress metric definition

**Choice:** Composite of (a) rolling cross-sectional mean volatility and (b) rolling average pairwise correlation. Weighted 60/40, normalized per series to [0, 1].

**Why this simple metric:** This is a *demonstrator*. A serious research metric (e.g., the ECB's Composite Indicator of Systemic Stress (CISS), or the dynamic conditional correlation approach in Engle 2002) would require careful econometric specification and isn't the point here. The composite I picked is interpretable (volatility ↑ and cross-sector correlation ↑ both indicate stress), computable in a handful of MATLAB lines, and lets the integration architecture be the focus.

**To revisit:** Replace with a CISS-style composite or a dynamic conditional correlation indicator if and when the real co-op project specifies its preferred metric.

---

## Data source

**Choice:** SPDR sector ETFs from Yahoo Finance via `yfinance`. Default sectors: XLF (financials), XLE (energy), XLK (technology), XLV (healthcare), XLI (industrials).

**Why ETFs not individual stocks:** Sectoral, not single-name, stress is the research question. ETFs are clean sectoral proxies, public, and free.

**Why Yahoo not a paid source:** Free, no auth, sufficient for daily-frequency historical data. The real research project will move to higher-frequency paid feeds (Bloomberg, Refinitiv, etc.); the architecture is data-source-agnostic — only `data.py` would change.

---

## Frontend chart library

**Choice:** Recharts.

**Alternatives:** Chart.js (faster but less React-idiomatic), Plotly (more powerful but heavier and slower), D3 (most flexible but more code).

**Why:** React-native, declarative API, good defaults for time-series + multi-line charts (which is exactly what we have). Acceptable for a demonstrator.

---

(Add new entries below as decisions arise.)
