# CrowdSense Dashboard

A React + Vite frontend and FastAPI backend for the [AI-Based Regional Density Monitoring](https://github.com/Enternatus/AI-Based-Regional-Density-Monitoring-with-Demographic-Insights) pipeline.

## Quick Start

```bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
```

Open http://localhost:5173.

## Connecting to Live Pipeline Data

The backend auto-detects live data when `backend/pipeline_repo/` points to the main project root:

```bash
cd backend
# Windows (NTFS junction)
mklink /J pipeline_repo "c:\path\to\AI DENSITY CROWD MONITORING"

# Linux/macOS (symlink)
ln -s /path/to/project pipeline_repo
```

When `pipeline_repo/person_records.json` exists, the backend serves real pipeline data. Otherwise it falls back to bundled `sample_data/`. Check `/api/health` to see which is active.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/regions/density` | Latest density snapshot with staleness info |
| POST | `/api/search` | Free-text attribute search over person records |
| GET | `/api/persons` | List all person records |
| GET | `/api/persons/{id}` | Full detail for a single person (includes raw attempts) |
| GET | `/api/persons/{id}/crop` | Representative crop image for a person |
| GET | `/api/health` | Backend status and data source info |

## Frontend Components

| Component | Purpose |
|-----------|---------|
| `App.jsx` | Layout with Split / Density / People view switcher |
| `DensityPanel.jsx` | Live trend chart, region density bars, threshold annotations, smart run states |
| `SearchPanel.jsx` | Free-text search with quality filter tabs and source badges |
| `PersonProfile.jsx` | Evidence modal with attributes labeled as model estimates, confidence bar, timeline |

## Design Principles

- **AI transparency**: All attributes labeled as "model estimates", weak data shows "No reliable estimate" (NIST AI RMF)
- **Operational clarity**: Smart status states — Live / Run stopped / Video complete (Google SRE)
- **Accessibility**: Color always paired with text and icons (WCAG 2.2)
- **Honest confidence**: Model scores explained as "not a guarantee" (Gender Shades)
