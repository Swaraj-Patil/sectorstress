# SectorStress

A web application that visualizes sectoral financial stress across major US equity sectors. Stress metrics are computed in MATLAB, served through a Python FastAPI bridge using the MATLAB Engine API for Python, and displayed in a React frontend with interactive controls.

## Why

The architecture mirrors what financial-research labs need but rarely have time to build: MATLAB for the analytical heavy-lifting that researchers actually write, a web stack for the stakeholder-facing access layer. Most lab-built tools stop at MATLAB scripts and static plots; this one bridges to a live, queryable web interface without abandoning the MATLAB compute.

## Stack

- **MATLAB** — analytical layer (rolling volatility, cross-sector correlation, composite stress index)
- **Python 3.11 + FastAPI** — backend serving JSON, calls MATLAB via `matlab.engine`
- **Vite + React + TypeScript + Tailwind + Recharts** — interactive frontend
- **Yahoo Finance** (via `yfinance`) — free sector ETF data

## Architecture

```
┌────────────────────┐         ┌────────────────────┐         ┌────────────────────┐
│ React frontend     │  HTTP   │ FastAPI backend    │  MATLAB │ MATLAB compute     │
│ — sector selector  │ ──────► │ — yfinance data    │ Engine  │ compute_stress.m   │
│ — date range       │ ◄────── │ — calls MATLAB     │ ──────► │ — rolling vol      │
│ — stress chart     │  JSON   │   via matlab.engine│         │ — correlations     │
└────────────────────┘         └────────────────────┘         │ — composite index  │
                                                              └────────────────────┘
```

## Setup

Requires a real MATLAB installation (R2026a or newer recommended). Northeastern provides MATLAB free via the site license. **Octave will not work** — `matlab.engine` is a MathWorks-proprietary package.

```bash
# 1. Create a Python 3.11 venv (MATLAB Engine requires a supported Python version)
uv venv --python 3.11
source backend/.venv/bin/activate

# 2. Install Python dependencies
cd backend
uv pip install -r requirements.txt

# 3. Install the MATLAB Engine for Python (NOT a pip package)
cd "$(dirname "$(which matlab)")/../extern/engines/python"
python setup.py install

# 4. Verify the engine starts
python -c "import matlab.engine; eng = matlab.engine.start_matlab(); print(eng.sqrt(16.0)); eng.quit()"
# Should print: 4.0
```

## Running

```bash
# Backend
cd backend && uvicorn app.main:app --reload

# Frontend
cd frontend && npm install && npm run dev
```

Open <http://localhost:5173>.

## What the stress indicator measures

A composite of two well-known stress signals:

1. **Rolling cross-sectional volatility** — when sector returns become more volatile, stress is higher.
2. **Average pairwise correlation across sectors** — when sectors that normally move independently start moving together, contagion is higher.

The composite is a normalized weighted blend (60% volatility, 40% correlation by default; tunable in `compute_stress.m`). The metric is intentionally simple — it's a transparent demonstration of the integration pattern, not a research claim.

## Design decisions

See [`docs/design-choices.md`](docs/design-choices.md) for a running log of decisions made during development — MATLAB engine singleton pattern, data caching strategy, stress-metric definition, and others.

## Status

Demonstration project, May 2026. Built as a learning project to ramp into MATLAB and demonstrate the MATLAB-to-web integration pattern.
