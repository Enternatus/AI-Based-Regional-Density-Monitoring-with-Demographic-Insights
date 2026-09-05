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
from datetime import datetime
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel

HERE = Path(__file__).parent

# --- Point this at your cloned pipeline repo root ------------------------
REPO_ROOT = HERE / "pipeline_repo"  # <-- clone/symlink the real repo here
SAMPLE_ROOT = HERE / "sample_data"

ACTIVE_ROOT = REPO_ROOT if (REPO_ROOT / "person_records.json").exists() else SAMPLE_ROOT

PERSON_RECORDS_PATH = ACTIVE_ROOT / "person_records.json"
CROPS_ROOT = ACTIVE_ROOT  # crop_path in each record is already relative to repo root
REGIONS_PATH = ACTIVE_ROOT / "regions.json"
DENSITY_SNAPSHOT_PATH = ACTIVE_ROOT / "density_snapshot.json"
DENSITY_HISTORY_PATH = ACTIVE_ROOT / "density_history.json"
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
        return data if isinstance(data, list) else []
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
        if record.get(field) == value:
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


@app.post("/api/search")
def search(req: SearchRequest):
    """
    Accepts either free text (parsed into filters) or filters directly
    (e.g. the frontend re-submitting after the user edits a filter chip).
    Explicit filter fields override anything parsed from `text`.

    Unresolved tracks (gender == "Detecting...") simply won't match any
    specific filter, so they fall out of filtered results naturally. An
    empty-filter search returns everyone, unresolved included.
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

    records = load_records()
    scored = []
    for pid, r in records.items():
        score, total_filters = score_record(r, filters)
        if total_filters == 0 or score > 0:
            scored.append((score, record_with_id(pid, r)))
    scored.sort(key=lambda pair: pair[0], reverse=True)

    return {
        "parsed_filters": filters.model_dump(exclude={"raw_text"}),
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
    crop_path = CROPS_ROOT / crop_path_str
    if not crop_path.exists():
        raise HTTPException(status_code=404, detail="crop image not found on disk")
    return FileResponse(crop_path)


@app.get("/api/regions/density")
def regions_density():
    """
    Reads the per-frame snapshot crowd_monitor.py should write (apply
    crowd_monitor.patch.py). If no snapshot exists yet, returns the
    regions from regions.json with zero counts rather than inventing
    numbers from person_records.json — those records are from a
    different video and would misrepresent live density.
    """
    if DENSITY_SNAPSHOT_PATH.exists():
        with open(DENSITY_SNAPSHOT_PATH) as f:
            data = json.load(f)
        data["source"] = "live_snapshot"
        # Add staleness info so frontend can show stale vs live
        updated_at = data.get("updated_at", "")
        try:
            updated_dt = datetime.fromisoformat(updated_at)
            age_seconds = (datetime.utcnow() - updated_dt).total_seconds()
        except (ValueError, TypeError):
            age_seconds = 9999
        data["age_seconds"] = round(age_seconds)
        data["is_stale"] = age_seconds > 30
        history = load_density_history()
        data["history"] = history
        data["summaries"] = density_summaries(history, data.get("regions", []))
        return data

    region_names: list[str] = []
    if REGIONS_PATH.exists():
        with open(REGIONS_PATH) as f:
            region_names = list(json.load(f).keys())

    return {
        "updated_at": datetime.utcnow().isoformat(),
        "source": "no_live_snapshot_yet",
        "regions": [{"region_id": name, "name": name, "count": 0} for name in region_names],
        "history": [],
        "summaries": {},
    }


@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "active_root": str(ACTIVE_ROOT),
        "using_real_pipeline": ACTIVE_ROOT == REPO_ROOT,
        "records_loaded": len(load_records()),
    }
