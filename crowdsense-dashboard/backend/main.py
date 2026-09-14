"""
CrowdSense API — FastAPI backend.

Wired against the ACTUAL schema in
https://github.com/Enternatus/AI-Based-Regional-Density-Monitoring-with-Demographic-Insights
not a guessed one. Two things worth knowing before you read further:

1. person_records.json is a DICT keyed by track_id (string), not a list.
   Real fields per record (from gender_monitor.py): gender ("Male" /
   "Female" / "Detecting..."), gender_conf, age (FairFace bucket, e.g.
   "20-29"), race (FairFace label, e.g. "East Asian"), first_seen_frame,
   last_seen_frame, locked, confirmed, source ("settled" / "best_raw" /
   "last_resort" / null), crop_path (e.g. "person_crops/person_7.jpg").
   clothing_color and height_bucket are NOT in the upstream schema yet —
   see gender_monitor.patch.py for the exact diff that adds them.

2. crowd_monitor.py (density, sample_crowd.mp4) and gender_monitor.py
   (demographics, close_range_crowd.mp4) run on TWO DIFFERENT VIDEOS and
   never share track IDs. Density counts and searchable person records
   are not describing the same people right now, and this backend does
   NOT fabricate a region_id on a person record to paper over that — the
   density panel and the search panel are honestly two independent views
   until those pipelines are merged onto shared footage.

WIRING THIS TO THE REAL PIPELINE
---------------------------------
  - Clone/symlink the pipeline repo into backend/pipeline_repo/ (or edit
    REPO_ROOT below to point at wherever you keep it). Once
    pipeline_repo/person_records.json exists, this backend reads it
    automatically instead of the bundled sample data.
  - Apply crowd_monitor.patch.py to crowd_monitor.py so it writes a
    density snapshot each frame.
  - Apply gender_monitor.patch.py to gender_monitor.py so records also
    get clothing_color and height_bucket.

Run:
    pip install -r requirements.txt
    python generate_sample_data.py   # only if you want to try it with sample data first
    uvicorn main:app --reload --port 8000
"""
import json
import re
import tempfile
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import cv2
import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel

HERE = Path(__file__).parent
PROJECT_ROOT = HERE.parent.parent  # Repository root when running in monolithic repo
REPO_ROOT = HERE / "pipeline_repo"  # Standalone mount / symlink
SAMPLE_ROOT = HERE / "sample_data"

if (PROJECT_ROOT / "person_records.json").exists():
    ACTIVE_ROOT = PROJECT_ROOT
elif (REPO_ROOT / "person_records.json").exists():
    ACTIVE_ROOT = REPO_ROOT
elif (PROJECT_ROOT / "sample_data" / "person_records.json").exists():
    ACTIVE_ROOT = PROJECT_ROOT / "sample_data"
else:
    ACTIVE_ROOT = SAMPLE_ROOT

PERSON_RECORDS_PATH = ACTIVE_ROOT / "person_records.json"
CROPS_ROOT = ACTIVE_ROOT  # crop_path in each record is already relative to repo root
REGIONS_PATH = ACTIVE_ROOT / "regions.json" if (ACTIVE_ROOT / "regions.json").exists() else (SAMPLE_ROOT / "regions.json")
DENSITY_SNAPSHOT_PATH = ACTIVE_ROOT / "density_snapshot.json" if (ACTIVE_ROOT / "density_snapshot.json").exists() else (PROJECT_ROOT / "density_snapshot.json")
DENSITY_HISTORY_PATH = ACTIVE_ROOT / "density_history.json" if (ACTIVE_ROOT / "density_history.json").exists() else (PROJECT_ROOT / "density_history.json")
LIVE_FRAME_PATH = Path(tempfile.gettempdir()) / "crowdsense_live_density.jpg"

LOW_THRESHOLD = 3
HIGH_THRESHOLD = 8
DEFAULT_THRESHOLDS = {"low": LOW_THRESHOLD, "high": HIGH_THRESHOLD}

REGION_ACCENTS = {
    "left_walkway": "#38bdf8",
    "central_plaza": "#a855f7",
    "right_walkway": "#f59e0b",
}
DEFAULT_PALETTE = ["#38bdf8", "#a855f7", "#f59e0b", "#10b981", "#ec4899", "#6366f1"]


def enrich_region(region_dict_or_id, index: int = 0) -> dict:
    if isinstance(region_dict_or_id, str):
        rid = region_dict_or_id
        count = 0
    else:
        rid = region_dict_or_id.get("region_id", region_dict_or_id.get("name", ""))
        count = region_dict_or_id.get("count", 0)
    display_name = rid.replace("_", " ").title()
    accent = REGION_ACCENTS.get(rid, DEFAULT_PALETTE[index % len(DEFAULT_PALETTE)])
    return {
        "region_id": rid,
        "name": display_name,
        "display_name": display_name,
        "count": count,
        "accent": accent,
    }
# -------------------------------------------------------------------------

app = FastAPI(title="CrowdSense API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def load_records() -> dict[str, dict]:
    """person_records.json is {track_id: record}, not a list."""
    if not PERSON_RECORDS_PATH.exists():
        return {}
    with open(PERSON_RECORDS_PATH) as f:
        return json.load(f)


def record_with_id(pid: str, record: dict) -> dict:
    """Flatten for API responses so the frontend gets person_id inline."""
    return {"person_id": pid, **record}


def load_density_history() -> list[dict]:
    if not DENSITY_HISTORY_PATH.exists():
        return []
    try:
        with open(DENSITY_HISTORY_PATH) as f:
            data = json.load(f)
        if not isinstance(data, list):
            return []
        enriched = []
        for sample in data:
            regions = [enrich_region(r, i) for i, r in enumerate(sample.get("regions", []))]
            enriched.append({
                **sample,
                "regions": regions,
                "total": sample.get("total", sum(r["count"] for r in regions)),
            })
        return enriched
    except json.JSONDecodeError:
        return []


def density_summaries(history: list[dict], current_regions: list[dict]) -> dict[str, dict]:
    """Current / average / peak per region, from the active video run."""
    by_region: dict[str, list[int]] = {}
    for sample in history:
        for region in sample.get("regions", []):
            by_region.setdefault(region["region_id"], []).append(region.get("count", 0))
    summaries = {}
    for region in current_regions:
        values = by_region.get(region["region_id"], [region["count"]])
        summaries[region["region_id"]] = {
            "current": region["count"],
            "average": round(sum(values) / len(values), 1),
            "peak": max(values),
        }
    return summaries


# ---------------------------------------------------------------------------
# Free-text -> structured filter parsing
#
# Deliberately a keyword/heuristic parser, not an LLM call: the fields are a
# small closed vocabulary (gender, FairFace's 9 age buckets, FairFace's 7
# race labels, plus clothing color and height once the pipeline patch adds
# them), so pattern matching is fast, free, fully explainable to the
# professor, and has no failure mode where it invents a filter that wasn't
# said. Swap in an LLM-based parser later if the vocabulary grows past what
# regex can comfortably cover.
#
# Vocabulary matches gender_monitor.py's actual outputs: gender is
# "Male"/"Female" (title case), age is one of FairFace's 9 buckets, race is
# one of FairFace's 7 labels. We match case-insensitively but store/compare
# against these exact upstream strings.
# ---------------------------------------------------------------------------

FAIRFACE_AGE_BUCKETS = ["0-2", "3-9", "10-19", "20-29", "30-39", "40-49", "50-59", "60-69", "70+"]
FAIRFACE_RACE_LABELS = [
    "White", "Black", "Latino_Hispanic", "East Asian",
    "Southeast Asian", "Indian", "Middle Eastern",
]

AGE_WORDS = {
    "infant": "0-2", "toddler": "0-2",
    "child": "3-9", "kid": "3-9", "children": "3-9",
    "teen": "10-19", "teenager": "10-19", "adolescent": "10-19",
    "young": "20-29", "youth": "20-29",
    "middle-aged": "40-49", "middle aged": "40-49",
    "elderly": "60-69", "senior": "60-69", "old": "70+",
}
COLOR_WORDS = ["red", "blue", "black", "white", "green", "yellow", "grey", "gray", "orange"]
HEIGHT_WORDS = {"tall": "tall", "short": "short", "average height": "average"}
GENDER_WORDS = {"man": "Male", "men": "Male", "male": "Male", "boy": "Male",
                 "woman": "Female", "women": "Female", "female": "Female", "girl": "Female"}
RACE_WORDS = {
    "white": "White", "black": "Black",
    "latino": "Latino_Hispanic", "latina": "Latino_Hispanic", "hispanic": "Latino_Hispanic",
    "east asian": "East Asian",
    "southeast asian": "Southeast Asian",
    "indian": "Indian", "south asian": "Indian",
    "middle eastern": "Middle Eastern",
    # bare "asian" is ambiguous between East/Southeast Asian in this
    # vocabulary — deliberately NOT matched, so a query with just "asian"
    # leaves race unset rather than silently picking one.
}


def disambiguate_color_and_race(text: str, detected_color: Optional[str], detected_race: Optional[str]) -> tuple[Optional[str], Optional[str]]:
    """
    Disambiguates words like 'black' and 'white' based on grammatical context:
    - 'black shirt', 'in black', 'black hoodie' -> clothing_color='black', race unset
    - 'black person', 'black man', 'black appearance' -> race='Black', clothing_color unset
    """
    t = f" {text.lower()} "
    for ambig in ["black", "white"]:
        if f" {ambig} " not in t:
            continue
        # Context 1: directly preceding or attached to clothing terms
        is_clothing = bool(
            re.search(rf"\b{ambig}\s+(?:shirt|t-?shirt|top|tee|hoodie|jacket|sweater|coat|clothes|clothing|pant|pants|dress|suit)\b", t)
            or re.search(rf"\b(?:in|wearing|dressed in)\s+(?:a\s+)?{ambig}\b", t)
        )
        # Context 2: directly attached to demographic/racial terms
        is_race = bool(
            re.search(rf"\b{ambig}\s+(?:man|woman|person|people|guy|girl|individual|appearance|ethnicity|race|group)\b", t)
            or re.search(rf"\b{ambig}\s+appearance\b", t)
        )

        if is_clothing and not is_race:
            detected_color = ambig
            if detected_race and detected_race.lower() == ambig:
                detected_race = None
        elif is_race and not is_clothing:
            detected_race = ambig.title()
            if detected_color == ambig:
                detected_color = None

    return detected_color, detected_race


class ParsedQuery(BaseModel):
    gender: Optional[str] = None
    age: Optional[str] = None
    race: Optional[str] = None
    clothing_color: Optional[str] = None
    height_bucket: Optional[str] = None
    raw_text: str


def parse_query(text: str) -> ParsedQuery:
    t = f" {text.lower()} "

    gender = next((v for k, v in GENDER_WORDS.items() if f" {k} " in t), None)
    age = next((v for k, v in AGE_WORDS.items() if f" {k} " in t), None)
    # longest keys first so "east asian" wins over a shorter overlapping key
    race = next((v for k, v in sorted(RACE_WORDS.items(), key=lambda kv: -len(kv[0])) if k in t), None)
    color = next((c for c in COLOR_WORDS if f" {c} " in t), None)
    if color == "gray":
        color = "grey"
    height = next((v for k, v in HEIGHT_WORDS.items() if k in t), None)

    # Disambiguate black/white clothing vs racial appearance
    color, race = disambiguate_color_and_race(text, color, race)

    # explicit age number, e.g. "35 years old" / "age 8"
    m = re.search(r"\b(\d{1,3})\s*(?:years?\s*old|yo|yrs)\b", t)
    if m and not age:
        n = int(m.group(1))
        for bucket in FAIRFACE_AGE_BUCKETS:
            if bucket.endswith("+"):
                if n >= int(bucket[:-1]):
                    age = bucket
                    break
                continue
            lo, hi = (int(x) for x in bucket.split("-"))
            if lo <= n <= hi:
                age = bucket
                break

    return ParsedQuery(
        gender=gender, age=age, race=race,
        clothing_color=color, height_bucket=height, raw_text=text,
    )


def score_record(record: dict, q: ParsedQuery) -> tuple[int, int]:
    """Simple additive match score across the filters that were actually parsed."""
    score = 0
    total_filters = 0
    for field, value in [
        ("gender", q.gender), ("age", q.age), ("race", q.race),
        ("clothing_color", q.clothing_color), ("height_bucket", q.height_bucket),
    ]:
        if value is None:
            continue
        total_filters += 1
        rec_val = record.get(field)
        if rec_val == value:
            score += 1
        elif field == "race" and {rec_val, value} <= {"Latino_Hispanic", "Hispanic / Latino"}:
            score += 1
    return score, total_filters


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

class SearchRequest(BaseModel):
    text: Optional[str] = None
    gender: Optional[str] = None
    age: Optional[str] = None
    race: Optional[str] = None
    clothing_color: Optional[str] = None
    height_bucket: Optional[str] = None
    match_mode: Optional[str] = "all"  # "all" (strict AND) | "any" (flexible OR)


@app.post("/api/search")
def search(req: SearchRequest):
    """
    Accepts either free text (parsed into filters) or filters directly
    (e.g. the frontend re-submitting after the user edits a filter chip).
    Explicit filter fields override anything parsed from `text`.

    In strict mode ('all', default), all parsed filters must match (AND).
    In flexible mode ('any'), any single filter match qualifies (OR).
    An empty-filter search returns all records.
    """
    parsed = parse_query(req.text) if req.text else ParsedQuery(raw_text="")

    filters = ParsedQuery(
        gender=req.gender or parsed.gender,
        age=req.age or parsed.age,
        race=req.race or parsed.race,
        clothing_color=req.clothing_color or parsed.clothing_color,
        height_bucket=req.height_bucket or parsed.height_bucket,
        raw_text=req.text or "",
    )

    match_mode = (req.match_mode or "all").lower()
    records = load_records()
    scored = []
    for pid, r in records.items():
        score, total_filters = score_record(r, filters)
        if total_filters == 0:
            scored.append((1, record_with_id(pid, r)))
        elif match_mode == "all":
            if score == total_filters:
                scored.append((score, record_with_id(pid, r)))
        else:
            if score > 0:
                scored.append((score, record_with_id(pid, r)))
    scored.sort(key=lambda pair: pair[0], reverse=True)

    return {
        "parsed_filters": filters.model_dump(exclude={"raw_text"}),
        "match_mode": match_mode,
        "result_count": len(scored),
        "results": [r for _, r in scored],
    }


@app.get("/api/persons")
def list_persons(
    gender: Optional[str] = None,
    age: Optional[str] = None,
    race: Optional[str] = None,
    clothing_color: Optional[str] = None,
    height_bucket: Optional[str] = None,
):
    records = load_records()
    filters = {
        "gender": gender, "age": age, "race": race,
        "clothing_color": clothing_color, "height_bucket": height_bucket,
    }
    active = {k: v for k, v in filters.items() if v}
    results = [
        record_with_id(pid, r) for pid, r in records.items()
        if all(r.get(k) == v for k, v in active.items())
    ]
    return {"result_count": len(results), "results": results}


@app.get("/api/persons/{person_id}")
def get_person(person_id: str):
    records = load_records()
    if person_id not in records:
        raise HTTPException(status_code=404, detail="person not found")
    return record_with_id(person_id, records[person_id])


@app.get("/api/persons/{person_id}/crop")
def get_person_crop(person_id: str):
    records = load_records()
    record = records.get(person_id)
    if not record:
        raise HTTPException(status_code=404, detail="person not found")
    crop_path_str = record.get("crop_path")
    if not crop_path_str:
        raise HTTPException(status_code=404, detail="no crop_path on this record yet (still detecting)")
    
    # Path traversal protection: sanitize filename
    safe_name = Path(crop_path_str).name
    crop_path = (CROPS_ROOT / "person_crops" / safe_name).resolve()
    if not crop_path.exists():
        crop_path = (CROPS_ROOT / crop_path_str).resolve()

    allowed_roots = [
        PROJECT_ROOT.resolve(),
        SAMPLE_ROOT.resolve(),
        (HERE / "sample_data").resolve(),
    ]
    if not any(str(crop_path).startswith(str(r)) for r in allowed_roots):
        raise HTTPException(status_code=400, detail="invalid crop path traversal attempt")

    if not crop_path.exists():
        for fallback_dir in [PROJECT_ROOT, SAMPLE_ROOT, HERE / "sample_data" / "person_crops", PROJECT_ROOT / "person_crops"]:
            candidate = (fallback_dir / safe_name).resolve()
            if candidate.exists() and any(str(candidate).startswith(str(r)) for r in allowed_roots):
                crop_path = candidate
                break

    if not crop_path.exists():
        raise HTTPException(status_code=404, detail="crop image not found on disk")
    return FileResponse(crop_path)


def compute_run_metadata(snapshot_data: Optional[dict], history: list) -> dict:
    """Computes first-class run status, timestamps, and pipeline provenance."""
    if not snapshot_data:
        return {
            "run_id": "idle_0",
            "run_status": "idle",
            "source_video": "sample_crowd.mp4",
            "video_fps": 30,
            "started_at": None,
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "completed_at": None,
            "frame_index": 0,
            "is_stale": False,
            "age_seconds": 0,
        }

    raw_status = snapshot_data.get("run_status", "stopped")
    updated_at = snapshot_data.get("updated_at", "")
    try:
        updated_dt = datetime.fromisoformat(updated_at)
        now_dt = datetime.now(updated_dt.tzinfo) if updated_dt.tzinfo else datetime.now(timezone.utc)
        age_seconds = (now_dt - updated_dt).total_seconds()
    except (ValueError, TypeError):
        age_seconds = 9999

    # Freshness states: live (recent frame), paused (no frame within 15s), stopped, completed
    if raw_status == "completed":
        run_status = "completed"
    elif raw_status == "stopped":
        run_status = "stopped"
    elif raw_status == "running":
        run_status = "live" if age_seconds <= 15 else "paused"
    else:
        run_status = raw_status

    started_at = snapshot_data.get("started_at")
    if not started_at and history:
        started_at = history[0].get("updated_at")

    run_id = snapshot_data.get("run_id")
    if not run_id:
        if started_at:
            try:
                run_id = f"run_{datetime.fromisoformat(started_at).strftime('%Y%m%d_%H%M%S')}"
            except Exception:
                run_id = "run_session"
        else:
            run_id = "run_session"

    return {
        "run_id": run_id,
        "run_status": run_status,
        "source_video": snapshot_data.get("source_video", "sample_crowd.mp4"),
        "video_fps": snapshot_data.get("video_fps", 30),
        "started_at": started_at,
        "updated_at": updated_at,
        "completed_at": snapshot_data.get("completed_at"),
        "frame_index": snapshot_data.get("frame_index", 0),
        "is_stale": age_seconds > 30,
        "age_seconds": round(age_seconds),
    }


@app.get("/api/regions/density")
def regions_density():
    """
    Reads the per-frame snapshot crowd_monitor.py writes. If no snapshot exists yet,
    returns configured regions with zero counts.
    """
    history = load_density_history()
    snapshot_raw = None
    if DENSITY_SNAPSHOT_PATH.exists():
        try:
            with open(DENSITY_SNAPSHOT_PATH) as f:
                snapshot_raw = json.load(f)
        except Exception:
            snapshot_raw = None

    if snapshot_raw:
        meta = compute_run_metadata(snapshot_raw, history)
        data = dict(snapshot_raw)
        data.update(meta)
        data["source"] = "live_snapshot"
        data["thresholds"] = DEFAULT_THRESHOLDS

        raw_regions = data.get("regions", [])
        current_regions = [enrich_region(r, i) for i, r in enumerate(raw_regions)]
        data["regions"] = current_regions
        current_total = sum(r.get("count", 0) for r in current_regions)
        data["current_total"] = current_total

        if len(history) >= 2:
            prev_total = sum(r.get("count", 0) for r in history[-2].get("regions", []))
            if current_total > prev_total:
                data["trend_direction"] = "rising"
            elif current_total < prev_total:
                data["trend_direction"] = "falling"
            else:
                data["trend_direction"] = "stable"
        else:
            data["trend_direction"] = "stable"

        data["history"] = history
        data["summaries"] = density_summaries(history, current_regions)
        return data

    region_names: list[str] = []
    if REGIONS_PATH.exists():
        with open(REGIONS_PATH) as f:
            region_names = list(json.load(f).keys())

    enriched_empty = [enrich_region(name, i) for i, name in enumerate(region_names)]
    meta = compute_run_metadata(None, history)
    result = {
        "source": "no_live_snapshot_yet",
        "regions": enriched_empty,
        "current_total": 0,
        "trend_direction": "stable",
        "thresholds": DEFAULT_THRESHOLDS,
        "history": history,
        "summaries": {},
    }
    result.update(meta)
    return result


@app.get("/api/overview")
def get_overview():
    """Unified overview endpoint aggregating live density and demographic metrics."""
    from collections import Counter
    density_data = regions_density()
    current_regions = density_data.get("regions", [])
    current_total = sum(r.get("count", 0) for r in current_regions)
    history = density_data.get("history", [])

    totals_in_history = [sum(r.get("count", 0) for r in h.get("regions", [])) for h in history]
    peak_session = max(totals_in_history, default=current_total)

    busiest = max(current_regions, key=lambda r: r.get("count", 0), default=None)
    busiest_zone = busiest.get("display_name", busiest.get("name", "--")) if busiest else "--"

    records = load_records()
    total_records = len(records)
    settled = sum(1 for r in records.values() if r.get("source") == "settled")
    best_raw = sum(1 for r in records.values() if r.get("source") == "best_raw")
    last_resort = sum(1 for r in records.values() if r.get("source") == "last_resort")

    genders = Counter(r.get("gender") for r in records.values() if r.get("gender") and r.get("gender") != "Detecting...")
    ages = Counter(r.get("age") for r in records.values() if r.get("age"))
    races = Counter((r.get("race") or "").replace("Latino_Hispanic", "Hispanic / Latino") for r in records.values() if r.get("race"))
    colors = Counter(r.get("clothing_color") for r in records.values() if r.get("clothing_color"))

    return {
        "density": {
            "run_id": density_data.get("run_id"),
            "current_total": current_total,
            "peak_session": peak_session,
            "busiest_zone": busiest_zone,
            "regions": current_regions,
            "run_status": density_data.get("run_status", "stopped"),
            "started_at": density_data.get("started_at"),
            "updated_at": density_data.get("updated_at"),
            "completed_at": density_data.get("completed_at"),
            "frame_index": density_data.get("frame_index", 0),
            "thresholds": DEFAULT_THRESHOLDS,
            "trend_direction": density_data.get("trend_direction", "stable"),
            "source_video": density_data.get("source_video", "sample_crowd.mp4"),
            "video_fps": density_data.get("video_fps", 30),
        },
        "people": {
            "total_records": total_records,
            "settled": settled,
            "best_raw": best_raw,
            "last_resort": last_resort,
            "top_demographics": {
                "gender": genders.most_common(1)[0][0] if genders else None,
                "age": ages.most_common(1)[0][0] if ages else None,
                "race": races.most_common(1)[0][0] if races else None,
                "clothing_color": colors.most_common(1)[0][0] if colors else None,
            },
            "source_video": "close_range_crowd.mp4",
            "video_fps": 30,
        }
    }


# ---------------------------------------------------------------------------
# Video & Live Annotated Streaming Endpoints (Priority 7)
# ---------------------------------------------------------------------------

@app.get("/api/video/density")
def video_density():
    """Serves the wide-angle sample_crowd.mp4 video file for HTML5 browser playback."""
    video_path = PROJECT_ROOT / "sample_crowd.mp4"
    if not video_path.exists():
        video_path = SAMPLE_ROOT / "sample_crowd.mp4"
    if not video_path.exists():
        raise HTTPException(status_code=404, detail="sample_crowd.mp4 not found on disk")
    return FileResponse(video_path, media_type="video/mp4")


@app.get("/api/video/demographics")
def video_demographics():
    """Serves the close-range close_range_crowd.mp4 video file for HTML5 browser playback."""
    video_path = PROJECT_ROOT / "close_range_crowd.mp4"
    if not video_path.exists():
        video_path = SAMPLE_ROOT / "close_range_crowd.mp4"
    if not video_path.exists():
        raise HTTPException(status_code=404, detail="close_range_crowd.mp4 not found on disk")
    return FileResponse(video_path, media_type="video/mp4")


def generate_annotated_density_stream():
    """Serves real-time annotated camera detection frames synchronized with crowd_monitor.py if running;
    gracefully falls back to simulated video loop when the pipeline is idle."""
    video_path = PROJECT_ROOT / "sample_crowd.mp4"
    if not video_path.exists():
        video_path = SAMPLE_ROOT / "sample_crowd.mp4"

    regions_raw = {}
    if REGIONS_PATH.exists():
        try:
            with open(REGIONS_PATH) as f:
                raw = json.load(f)
                regions_raw = {k: np.array(pts, dtype=np.int32) for k, pts in raw.items()}
        except Exception:
            pass

    cap = None
    try:
        while True:
            # Check if crowd_monitor.py is actively outputting live frames (< 2.5s old)
            if LIVE_FRAME_PATH.exists():
                try:
                    mtime = LIVE_FRAME_PATH.stat().st_mtime
                    if time.time() - mtime < 2.5:
                        with open(LIVE_FRAME_PATH, "rb") as f:
                            frame_bytes = f.read()
                        if frame_bytes:
                            yield (
                                b"--frame\r\n"
                                b"Content-Type: image/jpeg\r\n\r\n" + frame_bytes + b"\r\n"
                            )
                            time.sleep(0.04)
                            continue
                except Exception:
                    pass

            # Fallback to simulated loop if monitor is not running
            if cap is None and video_path.exists():
                cap = cv2.VideoCapture(str(video_path))

            if cap is not None and cap.isOpened():
                ret, frame = cap.read()
                if not ret:
                    cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                    ret, frame = cap.read()
                    if not ret:
                        time.sleep(0.1)
                        continue

                # Draw region polygons and labels
                for name, poly in regions_raw.items():
                    cv2.polylines(frame, [poly], True, (56, 189, 248), 2)
                    label_pos = tuple(poly[0]) if len(poly) > 0 else (20, 20)
                    cv2.putText(
                        frame, name.replace("_", " ").title(),
                        label_pos, cv2.FONT_HERSHEY_SIMPLEX, 0.5, (56, 189, 248), 1
                    )

                success, buffer = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 60])
                if success:
                    yield (
                        b"--frame\r\n"
                        b"Content-Type: image/jpeg\r\n\r\n" + buffer.tobytes() + b"\r\n"
                    )
            time.sleep(0.04)  # ~25 FPS
    finally:
        if cap is not None:
            cap.release()


@app.get("/api/stream/density")
def stream_density():
    """Serves an MJPEG video stream of annotated camera detection frames."""
    return StreamingResponse(
        generate_annotated_density_stream(),
        media_type="multipart/x-mixed-replace; boundary=frame"
    )


@app.get("/api/density/history")
def get_density_history(limit: Optional[int] = 30):
    """Returns actual session history from the monitoring run."""
    history = load_density_history()
    if limit and limit > 0:
        history = history[-limit:]
    
    totals = [sum(r.get("count", 0) for r in h.get("regions", [])) for h in history]
    peak_session = max(totals, default=0)
    current_total = totals[-1] if totals else 0

    return {
        "history": history,
        "count": len(history),
        "peak_session": peak_session,
        "current_total": current_total,
        "thresholds": DEFAULT_THRESHOLDS,
    }


@app.get("/api/people/summary")
def get_people_summary():
    """Aggregated demographic analytics across all tracked person records."""
    from collections import Counter
    records = load_records()
    total_records = len(records)
    
    genders = Counter()
    ages = Counter()
    races = Counter()
    clothing_colors = Counter()
    source_types = Counter()
    
    for r in records.values():
        g = r.get("gender")
        if g and g != "Detecting...":
            genders[g] += 1
        a = r.get("age")
        if a:
            ages[a] += 1
        rc = r.get("race")
        if rc:
            races[rc.replace("Latino_Hispanic", "Hispanic / Latino")] += 1
        c = r.get("clothing_color")
        if c:
            clothing_colors[c] += 1
        src = r.get("source", "unresolved")
        source_types[src] += 1
        
    return {
        "total_records": total_records,
        "gender": dict(genders),
        "age": dict(sorted(ages.items())),
        "race": dict(races.most_common()),
        "clothing_color": dict(clothing_colors.most_common()),
        "source_type": dict(source_types),
        "source_video": "close_range_crowd.mp4",
        "video_fps": 30,
    }


@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "active_root": str(ACTIVE_ROOT),
        "using_real_pipeline": ACTIVE_ROOT == REPO_ROOT,
        "records_loaded": len(load_records()),
    }
