# AI-Based Regional Density Monitoring with Demographic Insights

> Real-time, per-zone crowd density monitoring with close-range demographic attribute detection and a live operational dashboard — built with YOLOv8, FairFace, React, and FastAPI.

## Overview

This project provides two independent video-analysis pipelines and a unified web dashboard for crowd monitoring:

| Pipeline | What it does | Video type |
|----------|-------------|------------|
| **Density Monitor** | Counts people per user-defined polygon zone, classifies density as LOW / MEDIUM / HIGH | Wide-angle crowd footage |
| **Demographic Monitor** | Tracks individuals, estimates gender, age range, and appearance group via FairFace | Close-range footage where faces are resolvable |
| **CrowdSense Dashboard** | Live web UI showing density trends, person search, and per-record evidence profiles | Reads output from both pipelines |

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        VIDEO PIPELINES                           │
│                                                                  │
│  ┌───────────────────┐         ┌───────────────────────┐         │
│  │  crowd_monitor.py │         │   gender_monitor.py   │         │
│  │  YOLOv8 detection │         │   YOLOv8 + ByteTrack  │         │
│  │  per-zone counts  │         │   RetinaFace + FairFace│        │
│  └────────┬──────────┘         └──────────┬────────────┘         │
│           │                               │                      │
│    density_snapshot.json          person_records.json             │
│                                   person_crops/*.jpg              │
└──────────┬────────────────────────────────┬──────────────────────┘
           │                                │
           ▼                                ▼
┌──────────────────────────────────────────────────────────────────┐
│                    CROWDSENSE DASHBOARD                           │
│                                                                  │
│  ┌──────────────────┐    ┌───────────────────────────────┐       │
│  │  FastAPI Backend  │    │  React + Vite Frontend        │       │
│  │  /api/density     │◄──│  DensityPanel (live trends)    │       │
│  │  /api/search      │◄──│  SearchPanel (attribute search)│       │
│  │  /api/persons/:id │◄──│  PersonProfile (evidence view) │       │
│  └──────────────────┘    └───────────────────────────────┘       │
└──────────────────────────────────────────────────────────────────┘
```

## Features

### Density Monitoring
- User-defined polygon regions via interactive GUI (`select_regions.py`)
- Per-zone person count with LOW / MEDIUM / HIGH density classification
- Live `density_snapshot.json` written every 5 frames for dashboard consumption

### Demographic Detection
- Per-person tracking with persistent IDs (within a single run)
- FairFace-based gender, age range, and appearance group estimation
- Confidence-weighted temporal smoothing — labels settle over ~2 seconds before locking
- Quality gating: blurry or non-frontal crops are rejected before prediction
- Incremental saves every 500 frames + crash-safe `atexit` handler

### CrowdSense Dashboard
- **Split / Density / People** view modes for flexible presentation
- **Density panel**: Live trend chart with annotated HIGH threshold line, per-region sparklines, peak tracking, and smart status states (`Live` / `Run stopped` / `Video complete`)
- **People search**: Free-text attribute search (e.g., "tall young man in a red shirt"), quality filter tabs (Confirmed / Best available / Low-quality guess)
- **Person profiles**: Clickable evidence modal with all attributes labeled as model estimates, confidence bar, detection timeline, and raw attempt history
- **Research-backed UI**: Follows IBM Carbon, Google SRE, NIST AI RMF, and WCAG 2.2 guidelines for data-visualization, operational monitoring, AI transparency, and accessibility

## Tech Stack

| Component | Used for |
|-----------|----------|
| [Ultralytics YOLOv8n](https://github.com/ultralytics/ultralytics) | Person detection + multi-object tracking (ByteTrack) |
| OpenCV | Video I/O, region drawing, visualization |
| [FairFace](https://github.com/dchen236/FairFace) (ONNX) | Gender / age / appearance group prediction |
| RetinaFace (via `uniface`) | Face detection + landmark alignment |
| [FastAPI](https://fastapi.tiangolo.com/) | Dashboard REST API backend |
| [React](https://react.dev/) + [Vite](https://vite.dev/) | Dashboard frontend |

## Setup

### Prerequisites
- Python 3.9+
- Node.js 18+ and npm
- A CUDA-capable GPU is recommended but not required

### Installation

```bash
git clone https://github.com/Enternatus/AI-Based-Regional-Density-Monitoring-with-Demographic-Insights.git
cd AI-Based-Regional-Density-Monitoring-with-Demographic-Insights

# Python dependencies
python -m venv venv
venv\Scripts\activate          # Linux/macOS: source venv/bin/activate
pip install -r requirements.txt

# Dashboard frontend
cd crowdsense-dashboard/frontend
npm install
cd ../..
```

### Model Weights

- **YOLOv8n** — auto-downloads via `ultralytics` on first run.
- **FairFace ONNX** — place at `fairface_model/weights/fairface.onnx`. See the [FairFace repo](https://github.com/dchen236/FairFace) or `docs/WEIGHTS.md` for details.

## Usage

### 1. Define density regions (once per camera angle)
```bash
python scripts/select_regions.py
```
Left-click to add polygon points, press `n` to name and save a region, `q` to finish. Produces `regions.json`.

### 2. Run density monitoring
```bash
python crowd_monitor.py
```
Shows live per-zone person count with density level overlay. Writes `density_snapshot.json` for the dashboard.

### 3. Run demographic attribute detection
```bash
python gender_monitor.py
```
Tracks each person, runs FairFace when the face is well-positioned and sharp, and saves results to `person_records.json` with representative crops in `person_crops/`.

### 4. Launch the dashboard
```bash
# Terminal 1 — Backend API
cd crowdsense-dashboard/backend
uvicorn main:app --reload --port 8000

# Terminal 2 — Frontend
cd crowdsense-dashboard/frontend
npm run dev
```
Open http://localhost:5173. The backend auto-detects live pipeline data when a `pipeline_repo` symlink exists.

### 5. Search detected people (CLI alternative)
```bash
python scripts/search_person.py
```

## Project Structure

```
├── crowd_monitor.py              # Density pipeline — per-zone person counting
├── gender_monitor.py             # Demographic pipeline — FairFace attribute detection
├── unsettled_fallback.py         # Fallback logic for tracks that never fully settled
├── test_gender_monitor.py        # 17 regression tests for attribute smoothing/gating
├── regions.json                  # Polygon zone definitions (generated by select_regions.py)
├── requirements.txt              # Python dependencies
│
├── crowdsense-dashboard/         # Web dashboard (React + FastAPI)
│   ├── backend/
│   │   ├── main.py               # FastAPI — search, density, person detail endpoints
│   │   ├── generate_sample_data.py
│   │   ├── requirements.txt
│   │   └── sample_data/          # Bundled demo data matching real schema
│   └── frontend/
│       ├── src/
│       │   ├── App.jsx           # Layout with Split/Density/People view modes
│       │   ├── api.js            # API client (density, search, person detail)
│       │   ├── styles.css        # Full dark-theme terminal aesthetic
│       │   └── components/
│       │       ├── DensityPanel.jsx    # Live trend chart, region bars, threshold annotations
│       │       ├── SearchPanel.jsx     # Attribute search with quality filters
│       │       └── PersonProfile.jsx   # Evidence modal with confidence display
│       └── package.json
│
├── fairface_model/               # FairFace ONNX predictor + model definitions
│   ├── models/predictor.py       # ONNX inference wrapper
│   └── weights/.gitkeep          # Place fairface.onnx here
│
├── attribute_recognition/        # Experimental clothing attribute recognition
├── scripts/                      # Utility scripts (region selection, person search, video tools)
├── debug/                        # Debug/development scripts
└── docs/                         # Documentation (model weight instructions)
```

## Testing

```bash
python test_gender_monitor.py
```
17 regression tests covering attribute smoothing, confidence gating, quality rejection, fallback logic, and cross-run isolation. Each test corresponds to a specific bug found during development.

## Known Limitations

- **Density and demographics use separate videos.** `crowd_monitor.py` processes wide-angle footage; `gender_monitor.py` processes close-range footage. They do not share track IDs. The dashboard presents them as independent views.
- **Track IDs are per-run only.** The tracker resets on each execution — there is no cross-session re-identification.
- **Attribute accuracy varies.** FairFace's predictions are model estimates, not verified facts. Accuracy degrades on small, angled, or motion-blurred crops. The UI labels all attributes as estimates and shows evidence quality (Confirmed / Best available / Low-quality guess).
- **Race classification has documented limitations.** Per the [Gender Shades](https://proceedings.mlr.press/v81/buolamwini18a.html) study, error rates differ across demographic groups. Confidence + margin gating is used to reject uncertain predictions.

## Research References

The dashboard UI design is informed by:
- [IBM Carbon Design System — Dashboards](https://carbondesignsystem.com/data-visualization/dashboards/) — KPI hierarchy and threshold annotations
- [Google SRE Workbook — Monitoring](https://sre.google/workbook/monitoring/) — Operational status states and data freshness
- [NIST AI Risk Management Framework](https://doi.org/10.6028/NIST.AI.100-1) — AI transparency and honest uncertainty display
- [WCAG 2.2](https://www.w3.org/TR/WCAG22/) — Accessible data visualization (color + text + icons)
- [NIST FATE — Age Estimation](https://doi.org/10.6028/NIST.IR.8525) — Presenting age as an estimate, not a fact

## License

MIT — see [LICENSE](LICENSE).
