# AI-Based Regional Density Monitoring with Demographic Insights

> Real-time, per-zone crowd density monitoring with optional close-range demographic attribute detection, built with YOLOv8, OpenCV, and FairFace.

## The problem

Public spaces (stations, campuses, malls) lack real-time visibility into crowd density at a sub-area level — most systems give a single headcount for an entire camera feed, not a per-zone breakdown. This delays response to overcrowding, bottlenecks, or safety-relevant zones.

## What this does

- **Per-zone density monitoring** — define arbitrary polygon regions on a camera feed and track live person-count and density level (LOW / MEDIUM / HIGH) per zone, not just a single frame-wide headcount.
- **Person tracking with demographic attributes** — for close-range footage, tracks individuals across frames and estimates gender, age range, and race using the FairFace model, with confidence-weighted temporal smoothing so a label settles rather than flickering frame-to-frame.
- **Per-person lookup** — every tracked individual is stored with their attributes and a reference crop, searchable afterward by gender, age range, or race, or by ID.

## How it works

```
                     ┌─────────────────────┐
  Region density  →  │  select_regions.py  │  → regions.json (polygon zones, drawn once)
                     └─────────────────────┘
                               │
                               ▼
                     ┌─────────────────────┐
                     │   crowd_monitor.py   │  → YOLOv8n person detection per frame
                     │                      │     + per-zone count/density overlay
                     └─────────────────────┘

                     ┌─────────────────────┐
  Person attributes →│  gender_monitor.py   │  → YOLOv8n + ByteTrack (persistent per-run ID)
                     │                      │     → RetinaFace face detect + align
                     │                      │     → FairFace (gender / age / race)
                     │                      │     → confidence-weighted smoothing per track
                     └─────────────────────┘
                               │
                               ▼
                       person_records.json
                               │
                               ▼
                     ┌─────────────────────┐
                     │  search_person.py    │  → interactive lookup / filter by attribute
                     └─────────────────────┘
```

The density pipeline and the demographic-attribute pipeline are independent — you can run region density monitoring on wide-angle crowd footage and, separately, run attribute detection on close-range footage where faces are actually resolvable.

## Tech stack

| Component | Used for |
|---|---|
| [Ultralytics YOLOv8n](https://github.com/ultralytics/ultralytics) | Person detection + multi-object tracking |
| OpenCV | Video I/O, region drawing, visualization |
| [FairFace](https://github.com/dchen236/FairFace) (ONNX) | Gender / age / race attribute prediction |
| RetinaFace (via `uniface`) | Face detection + landmark alignment ahead of FairFace |

## Setup

```bash
git clone https://github.com/Enternatus/AI-Based-Regional-Density-Monitoring-with-Demographic-Insights.git
cd AI-Based-Regional-Density-Monitoring-with-Demographic-Insights
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

`yolov8n.pt` and the FairFace ONNX weights are required — see [Model weights](#model-weights) below.

## Usage

**1. Define density regions on your footage (once per camera angle):**
```bash
python select_regions.py
```
Left-click to add polygon points, press `n` to name and save a region, `q` to finish. Produces `regions.json`.

**2. Run density monitoring:**
```bash
python crowd_monitor.py
```
Shows live per-zone person count and a LOW / MEDIUM / HIGH density level, drawn directly on the video.

**3. Run demographic attribute detection (close-range footage):**
```bash
python gender_monitor.py
```
Tracks each person, runs FairFace once a track is well-positioned, and confidence-weight-smooths the result over ~5.5 seconds before locking it in (shown as `[confirmed]`). Saves everyone detected to `person_records.json`.

**4. Look up detected people:**
```bash
python search_person.py
```
Interactive menu — list everyone detected, filter by gender/age/race, or pull up a specific person's stored crop and attributes by ID.

## Testing

```bash
python test_gender_monitor.py
```
Regression tests for the attribute-smoothing and confidence-gating logic — each test corresponds to a specific bug found during development (see [Known limitations](#known-limitations)), so a future change can't silently reintroduce one.

## Known limitations

- **Race classification accuracy varies by category.** FairFace's race classifier is measurably less reliable on certain category pairs (e.g. White / Middle Eastern / Indian can be confused with each other) — this is a documented limitation of the underlying model on ambiguous or lower-quality crops, not something temporal smoothing alone fully resolves. Per-attribute confidence + margin gating is used to reject low-certainty reads before they're accepted.
- **Track IDs are scoped to a single run.** The tracker's ID counter resets every time `gender_monitor.py` is (re)started, so identity is not persisted across separate recording sessions — this project assumes each person appears once per session, not that the system re-recognizes a returning individual across different runs.
- **Attribute detection needs a reasonably close, well-lit, front-facing view.** Accuracy degrades on small, angled, or motion-blurred crops, which is why detection is gated on box size/position before FairFace is run at all.

## Model weights

- `yolov8n.pt` auto-downloads via `ultralytics` on first run if not already present.
- FairFace ONNX weights are expected at `fairface_model/weights/fairface.onnx` — see the [FairFace repo](https://github.com/dchen236/FairFace) or [yakhyo/fairface (ONNX export)](https://github.com/yakhyo) for the weight file and `models/predictor.py` / `models/fairface.py` used here.

## Datasets

- [Mall Dataset](https://personal.ie.cuhk.edu.hk/~ccloy/downloads_mall_dataset.html) — wide-angle crowd footage used for density-region testing.
- [ChokePoint Dataset](http://arma.sourceforge.net/chokepoint/) — real-world surveillance-condition face footage (portal cameras), used for close-range person tracking and attribute detection testing. Used strictly for academic research purposes per the dataset's license terms.

## License

MIT — see [LICENSE](LICENSE).
