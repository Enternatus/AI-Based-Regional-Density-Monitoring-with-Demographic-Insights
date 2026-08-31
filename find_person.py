"""
Enter whatever features you know (gender / age / race -- any subset,
blank = skip) and get a RANKED list of the closest-matching people from
person_records.json, not just an exact filter. Built for the "find the
exact person" use case where you might only have a rough age guess or
just gender+race.

Run with: python find_person.py
"""

import json
import os
from difflib import SequenceMatcher

import cv2

RECORDS_FILE = "person_records.json"

# FairFace age buckets, in order, so we can score how CLOSE two age
# buckets are (not just equal/not-equal) -- e.g. "20-29" vs "30-39"
# should score higher than "20-29" vs "60-69".
AGE_BUCKETS = ["0-2", "3-9", "10-19", "20-29", "30-39",
               "40-49", "50-59", "60-69", "70+"]

# How much each provided feature is worth if it's a perfect match.
# Only features you actually enter get counted -- the final score is
# rescaled to 0-100 based on whichever subset you gave.
WEIGHTS = {"gender": 40, "age": 30, "race": 30}


def load_records():
    if not os.path.exists(RECORDS_FILE):
        print(f"No {RECORDS_FILE} found. Run gender_monitor.py first.")
        return {}
    with open(RECORDS_FILE, "r") as f:
        return json.load(f)


def bucket_for_age_input(raw):
    """Accept either an exact bucket string ('20-29') or a plain number
    ('25') and return the matching bucket index, or None if it can't be
    parsed at all."""
    raw = raw.strip()
    if raw in AGE_BUCKETS:
        return AGE_BUCKETS.index(raw)
    try:
        n = int(raw)
    except ValueError:
        return None
    if n <= 2:
        return 0
    if n <= 9:
        return 1
    if n <= 19:
        return 2
    if n <= 29:
        return 3
    if n <= 39:
        return 4
    if n <= 49:
        return 5
    if n <= 59:
        return 6
    if n <= 69:
        return 7
    return 8


def age_score(query_bucket_idx, record_age):
    if record_age not in AGE_BUCKETS:
        return 0.0  # record has no usable age (still "Detecting..." etc.)
    record_idx = AGE_BUCKETS.index(record_age)
    distance = abs(query_bucket_idx - record_idx)
    max_distance = len(AGE_BUCKETS) - 1
    return max(0.0, 1.0 - distance / max_distance)


def race_score(query_race, record_race):
    if not record_race:
        return 0.0
    q = query_race.strip().lower()
    r = record_race.strip().lower()
    if q == r:
        return 1.0
    return SequenceMatcher(None, q, r).ratio()


def gender_score(query_gender, record_gender):
    return 1.0 if query_gender.strip().lower() == record_gender.strip().lower() else 0.0


def rank_matches(records, gender=None, age=None, race=None):
    active_weight = 0
    if gender:
        active_weight += WEIGHTS["gender"]
    age_bucket_idx = bucket_for_age_input(age) if age else None
    if age and age_bucket_idx is None:
        print(f"Couldn't parse age '{age}' -- ignoring that field.")
        age = None
    if age:
        active_weight += WEIGHTS["age"]
    if race:
        active_weight += WEIGHTS["race"]

    if active_weight == 0:
        print("No usable features entered.")
        return []

    scored = []
    for pid, r in records.items():
        raw = 0.0
        if gender:
            raw += WEIGHTS["gender"] * gender_score(gender, r.get("gender", ""))
        if age:
            raw += WEIGHTS["age"] * age_score(age_bucket_idx, r.get("age", ""))
        if race:
            raw += WEIGHTS["race"] * race_score(race, r.get("race", ""))
        pct = round(100 * raw / active_weight, 1)
        scored.append((pid, pct, r))

    scored.sort(key=lambda t: t[1], reverse=True)
    return scored


def quality_tag(record):
    source = record.get("source")
    if record.get("confirmed") or source == "settled":
        return "confirmed"
    if source == "last_resort":
        return "guess"
    if source == "best_raw":
        return "best-raw"
    return "unresolved"


def show_results(scored, top_n=5):
    if not scored:
        print("No matches.")
        return
    print(f"\nTop {min(top_n, len(scored))} match(es):\n")
    for pid, pct, r in scored[:top_n]:
        print(f"  ID {pid}  |  {pct:5.1f}% match  |  {r.get('gender')} | "
              f"Age {r.get('age') or '?'} | {r.get('race') or '?'}  "
              f"[{quality_tag(r)}]")


def view_crop(pid, record):
    crop_path = record.get("crop_path")
    if crop_path and os.path.exists(crop_path):
        img = cv2.imread(crop_path)
        cv2.imshow(f"Person {pid}", img)
        print("Press any key on the image window to close it.")
        cv2.waitKey(0)
        cv2.destroyAllWindows()
    else:
        print("(no saved image for this person)")


def main():
    records = load_records()
    if not records:
        return

    while True:
        print("\n" + "=" * 40)
        print("Enter known features (blank = skip / unknown).")
        gender = input("Gender (Male/Female): ").strip() or None
        age = input("Age (exact bucket e.g. 20-29, OR a plain number e.g. 25): ").strip() or None
        race = input("Race (e.g. East Asian, White, Black, Indian, etc.): ").strip() or None

        scored = rank_matches(records, gender=gender, age=age, race=race)
        show_results(scored)

        if scored:
            choice = input("\nView a crop image by ID (or press Enter to skip): ").strip()
            if choice:
                match = next(((pid, r) for pid, _, r in scored if pid == choice), None)
                if match:
                    view_crop(*match)
                else:
                    print("That ID wasn't in the results.")

        again = input("\nSearch again? (y/n): ").strip().lower()
        if again != "y":
            break


if __name__ == "__main__":
    main()