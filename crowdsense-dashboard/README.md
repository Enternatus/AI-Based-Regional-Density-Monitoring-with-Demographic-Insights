# CrowdSense Dashboard

A FastAPI backend + React frontend, wired against the **actual** schema of
https://github.com/Enternatus/AI-Based-Regional-Density-Monitoring-with-Demographic-Insights
(not a guessed one — the repo's real files were fetched and read to build this).

## Two things to know before running this

1. **`person_records.json` is a dict keyed by track ID**, not a list.
   Real fields (from `gender_monitor.py`): `gender` ("Male"/"Female"/
   "Detecting..."), `gender_conf`, `age` (a FairFace bucket like
   "20-29"), `race` (a FairFace label like "East Asian"),
   `first_seen_frame`, `last_seen_frame`, `locked`, `confirmed`, `source`
   ("settled"/"best_raw"/"last_resort"/null), `crop_path`. There's no
   `clothing_color`, `height_bucket`, or region info in the upstream data
   yet — see the two patch files below.

2. **`crowd_monitor.py` (density) and `gender_monitor.py` (demographics)
   run on two different videos** (`sample_crowd.mp4` vs
   `close_range_crowd.mp4`) and never share track IDs. Density counts and
   searchable person records are not the same people right now. This
   backend does not fake a `region_id` on person records to paper over
   that — the density panel and search panel are honestly two
   independent views until the pipelines are merged onto shared footage.
   Worth flagging as a known scope boundary, not silently hiding it.

## Run it (bundled sample data, matches the real schema)

```bash
cd backend
pip install -r requirements.txt
python generate_sample_data.py
uvicorn main:app --reload --port 8000

# separate terminal
cd frontend
npm install
npm run dev
```

Open http://localhost:5173.

## Wiring to the real repo

1. Clone the pipeline repo into `backend/pipeline_repo/` (or symlink it):
   ```bash
   cd backend
   git clone https://github.com/Enternatus/AI-Based-Regional-Density-Monitoring-with-Demographic-Insights pipeline_repo
   ```
   `backend/main.py` auto-detects `pipeline_repo/person_records.json` and
   switches over from the bundled sample data — no config edit needed.
   `/api/health` reports which one is active (`using_real_pipeline`).

2. Apply `backend/crowd_monitor.patch.py` to your `crowd_monitor.py` —
   it's a diff description with the exact lines to add, not a script to
   run. Adds a `density_snapshot.json` write once every few frames, which
   `/api/regions/density` reads directly.

3. Apply `backend/gender_monitor.patch.py` to your `gender_monitor.py` —
   same format. Adds `clothing_color` (nearest-palette match on the
   crop's torso band, no extra ML model) and `height_bucket` (bucketed
   from `box_height_ratio`, which the script already computes) to every
   record, every frame — decoupled from FairFace's settle/lock timing
   since neither needs class-smoothing the way gender/age/race do.

Run `crowd_monitor.py` and `gender_monitor.py` as usual afterward; both
now also update files this backend reads.

## What the search parser does (and doesn't do)

`backend/main.py`'s `parse_query()` is a keyword/regex matcher over a
closed vocabulary matching gender_monitor.py's real outputs: gender
(Male/Female), FairFace's 9 age buckets, FairFace's 7 race labels
(bare "asian" is deliberately left unmatched — it's ambiguous between
East Asian and Southeast Asian in this vocabulary, so it's better to
leave the filter unset than guess), plus clothing color and height once
the pipeline patch adds them. Not an LLM call — the vocabulary is small
and fixed, so pattern matching is instant, free, fully explainable, and
can't invent a filter that wasn't actually said.

This is attribute search over anonymized track IDs from your own
footage — not identity lookup. There's no name field and nothing here
matches a person against an external face database; keep it that way as
you extend it.

## Project structure

```
backend/
  main.py                       FastAPI app — real schema, auto-detects real vs sample data
  generate_sample_data.py       sample person_records.json + regions.json + placeholder crops
  crowd_monitor.patch.py        diff description: density snapshot write
  gender_monitor.patch.py       diff description: clothing_color + height_bucket
  requirements.txt
  pipeline_repo/                <- clone the real repo here (gitignored, not included)
frontend/
  src/App.jsx                    layout, top bar, density polling
  src/components/DensityPanel.jsx
  src/components/SearchPanel.jsx
  src/api.js                     fetch wrapper (BASE_URL = 127.0.0.1:8000)
```
