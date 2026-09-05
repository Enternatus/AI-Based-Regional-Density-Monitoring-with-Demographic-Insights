"""
Generates sample_data/person_records.json + regions.json + placeholder
crop images, matching the REAL upstream schema (dict keyed by track_id,
FairFace field names) plus the clothing_color/height_bucket fields that
gender_monitor.patch.py adds.

This exists purely so the dashboard has something to render before you
wire backend/main.py's REPO_ROOT at the real cloned pipeline repo.

Run: python generate_sample_data.py
"""
import json
import random
from pathlib import Path
from PIL import Image, ImageDraw

random.seed(7)

HERE = Path(__file__).parent
DATA_DIR = HERE / "sample_data"
CROPS_DIR = DATA_DIR / "person_crops"
CROPS_DIR.mkdir(parents=True, exist_ok=True)

GENDERS = ["Male", "Female"]
AGE_BUCKETS = ["0-2", "3-9", "10-19", "20-29", "30-39", "40-49", "50-59", "60-69", "70+"]
RACES = ["White", "Black", "Latino_Hispanic", "East Asian", "Southeast Asian", "Indian", "Middle Eastern"]
CLOTHING_COLORS = {
    "red": (196, 60, 55), "blue": (58, 92, 168), "black": (30, 30, 30),
    "white": (235, 235, 235), "green": (63, 130, 78), "yellow": (214, 178, 46),
    "grey": (128, 130, 135), "orange": (214, 122, 46),
}
HEIGHT_BUCKETS = ["short", "average", "tall"]
SOURCES = ["settled", "best_raw", "last_resort"]
REGION_NAMES = ["left_walkway", "right_walkway", "central_plaza"]  # matches real regions.json

records = {}
for i in range(1, 43):
    track_id = str(i)
    gender = random.choice(GENDERS)
    age = random.choice(AGE_BUCKETS)
    race = random.choice(RACES)
    color_name = random.choice(list(CLOTHING_COLORS.keys()))
    height_bucket = random.choices(HEIGHT_BUCKETS, weights=[0.25, 0.5, 0.25])[0]
    source = random.choices(SOURCES, weights=[0.7, 0.2, 0.1])[0]
    first_seen = random.randint(1, 3000)
    last_seen = first_seen + random.randint(20, 400)

    crop_filename = f"person_{track_id}.jpg"
    img = Image.new("RGB", (80, 160), (40, 44, 52))
    draw = ImageDraw.Draw(img)
    draw.ellipse((25, 10, 55, 40), fill=(200, 170, 140))  # head
    draw.rectangle((15, 45, 65, 120), fill=CLOTHING_COLORS[color_name])  # torso
    draw.rectangle((20, 120, 40, 155), fill=(50, 50, 60))  # legs
    draw.rectangle((42, 120, 62, 155), fill=(50, 50, 60))
    img.save(CROPS_DIR / crop_filename)

    records[track_id] = {
        "gender": gender,
        "gender_conf": round(random.uniform(60, 99), 1),
        "age": age,
        "race": race,
        "clothing_color": color_name,     # added by gender_monitor.patch.py
        "height_bucket": height_bucket,   # added by gender_monitor.patch.py
        "first_seen_frame": first_seen,
        "last_seen_frame": last_seen,
        "locked": source == "settled",
        "confirmed": source == "settled",
        "source": source,
        "crop_path": f"person_crops/{crop_filename}",
    }

with open(DATA_DIR / "person_records.json", "w") as f:
    json.dump(records, f, indent=2)

# A couple of still-detecting tracks too, since real data always has some
records["43"] = {
    "gender": "Detecting...", "gender_conf": 0, "age": "", "race": "",
    "first_seen_frame": 3800, "last_seen_frame": 3820,
    "locked": False, "confirmed": False, "source": None, "crop_path": None,
}
with open(DATA_DIR / "person_records.json", "w") as f:
    json.dump(records, f, indent=2)

# Sample regions.json matching the real file's shape (name -> polygon)
regions = {
    "left_walkway": [[0, 60], [260, 60], [260, 220], [0, 220]],
    "right_walkway": [[420, 60], [640, 60], [640, 220], [420, 220]],
    "central_plaza": [[150, 220], [480, 220], [480, 480], [150, 480]],
}
with open(DATA_DIR / "regions.json", "w") as f:
    json.dump(regions, f, indent=2)

print(f"Wrote {len(records)} sample records to {DATA_DIR / 'person_records.json'}")
print(f"Wrote {len(records) - 1} placeholder crops to {CROPS_DIR}")
print(f"Wrote sample regions.json (no density_snapshot.json — dashboard will show zero counts until you apply crowd_monitor.patch.py against a running crowd_monitor.py)")
