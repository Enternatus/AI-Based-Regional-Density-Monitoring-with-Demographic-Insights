import sys
import os
import time
import shutil
import json
import cv2
from collections import defaultdict, Counter

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "fairface_model"))

from models.predictor import FairFace
from uniface.detection import RetinaFace
from uniface.face_utils import face_alignment

VIDEO_PATH = "close_range_crowd.mp4"
GENDER_EVERY_N_FRAMES = 20

CENTER_BAND_MIN = 0.25
CENTER_BAND_MAX = 0.75
MIN_BOX_HEIGHT_RATIO = 0.35

# How many recent ACCEPTED raw reads to keep per attribute, per track, for
# confidence-weighted smoothing. A single noisy frame can no longer flip
# the stored label on its own -- it's one weighted vote among the last N.
SMOOTHING_WINDOW = 15

# Per-attribute acceptance thresholds. Gender is a 2-class problem (chance
# = 50%), so a fairly high bar is reasonable. Race is a 7-class problem
# (chance = ~14%) and age is 9-class (chance = ~11%) -- both are genuinely
# harder tasks with lower achievable confidence even when correct, so they
# get lower bars. These are starting points, not exact science -- if you
# print the raw race_scores for a run you can tune them against your own
# footage.
MIN_ACCEPT_CONF = {
    "gender": 60.0,
    "race": 45.0,
    "age": 35.0,
}

# Minimum gap between the top-scoring class and the runner-up, per
# attribute. A read can clear MIN_ACCEPT_CONF and still be a coin-flip
# between two visually similar classes (e.g. White 52% vs Middle Eastern
# 46%) -- softmax confidence alone doesn't catch that, but the margin does.
MIN_MARGIN = {
    "gender": 15.0,
    "race": 10.0,
    "age": 8.0,
}

# How long (in seconds of *accepted* readings) to keep refining a track's
# attributes before locking them in for good. Once locked, the label stops
# updating entirely -- no more flicker, just the settled answer. This
# trades "always current" for "stable and readable", which is what you
# actually want for a label a person is meant to read off the screen.
SETTLE_SECONDS = 5.5

RECORDS_FILE = "person_records.json"

from ultralytics import YOLO

print("Loading YOLO...")
yolo_model = YOLO("yolov8n.pt")

print("Loading FairFace...")
fairface_model = FairFace(model_path="fairface_model/weights/fairface.onnx")
face_detector = RetinaFace()

cap = cv2.VideoCapture(VIDEO_PATH)

# Skip the first ~100 frames, which are empty background
# (no people) at the start of every ChokePoint sequence.
cap.set(cv2.CAP_PROP_POS_FRAMES, 100)

video_fps = cap.get(cv2.CAP_PROP_FPS)
if not video_fps or video_fps <= 0:
    video_fps = 30.0  # sane fallback if the video metadata doesn't report fps
SETTLE_FRAMES = int(SETTLE_SECONDS * video_fps)

# --- Record loading -------------------------------------------------------
# IMPORTANT: yolo_model.track(..., persist=True) only keeps track IDs
# consistent *within a single run* of this script. Every time the script
# is (re)started, the tracker's ID counter resets to 1. That means a track
# ID from today's run and a track ID with the same number from an earlier
# run almost certainly refer to two DIFFERENT physical people.
#
# The old behaviour merged on load, assuming "same ID = same person"
# across runs -- which silently combined unrelated people's gender/age/
# race/crop data under one record. To avoid that, we no longer merge:
# any existing records file is backed up (not deleted) and this run
# starts from a clean slate. If you need true persistence of identity
# across separate runs/sessions, that requires face re-identification
# (matching by face embedding), not raw tracker ID reuse -- flag this
# as future work if it's needed.
if os.path.exists(RECORDS_FILE):
    os.makedirs("backups", exist_ok=True)
    backup_name = f"backups/person_records_{int(time.time())}.json"
    shutil.copy(RECORDS_FILE, backup_name)
    print(f"Found existing {RECORDS_FILE} from a previous run.")
    print(f"Backed it up to {backup_name} instead of merging -- track IDs "
          f"are only unique within a single run, so merging by ID across "
          f"runs would corrupt records by combining two different people.")

person_records = {}

# Per-track, per-attribute rolling history of ACCEPTED (label, confidence)
# reads, used for confidence-weighted smoothing. Not written to disk --
# only the smoothed result is saved.
raw_history = {
    "gender": defaultdict(list),
    "age": defaultdict(list),
    "race": defaultdict(list),
}
best_conf_seen = {}   # track_id -> highest single-frame gender confidence seen (for crop selection)


def top_and_margin(scores: dict):
    """Given a {label: probability} dict, return (top_label, top_conf_pct, margin_pct)."""
    ranked = sorted(scores.items(), key=lambda kv: kv[1], reverse=True)
    top_label, top_p = ranked[0]
    second_p = ranked[1][1] if len(ranked) > 1 else 0.0
    return top_label, top_p * 100, (top_p - second_p) * 100


def _smoothed_from_history(history):
    if not history:
        return None, None
    weights = Counter()
    for h_label, h_conf in history:
        weights[h_label] += h_conf
    smoothed_label = weights.most_common(1)[0][0]
    agreeing = [c for l, c in history if l == smoothed_label]
    smoothed_conf = sum(agreeing) / len(agreeing)
    return smoothed_label, smoothed_conf


def update_attribute(attr_name, track_id, label, conf, margin):
    """Accept/reject a raw read for one attribute. If accepted, add it to
    this track's rolling history and return the updated confidence-weighted
    smoothed value. If rejected, leave history untouched and just return
    the existing smoothed value (or (None, None) if nothing accepted yet)."""
    history = raw_history[attr_name][track_id]

    if conf < MIN_ACCEPT_CONF[attr_name] or margin < MIN_MARGIN[attr_name]:
        return _smoothed_from_history(history)

    history.append((label, conf))
    if len(history) > SMOOTHING_WINDOW:
        history.pop(0)
    return _smoothed_from_history(history)

frame_count = 0

print("Running. Press 'q' to quit.")

while cap.isOpened():
    ret, frame = cap.read()
    if not ret:
        break

    frame_h, frame_w = frame.shape[:2]

    # persist=True keeps the same ID for the same person across frames
    # *within this run only* -- see note above.
    results = yolo_model.track(frame, classes=[0], verbose=False, persist=True)

    if results[0].boxes is not None and results[0].boxes.id is not None:
        boxes = results[0].boxes.xyxy.tolist()
        track_ids = results[0].boxes.id.int().tolist()

        for box, track_id in zip(boxes, track_ids):
            track_id = str(track_id)  # keep keys consistent with JSON (always string keys)
            x1, y1, x2, y2 = map(int, box)
            crop = frame[y1:y2, x1:x2]

            if track_id not in person_records:
                person_records[track_id] = {
                    "gender": "Detecting...",
                    "gender_conf": 0,
                    "age": "",
                    "race": "",
                    "first_seen_frame": frame_count,
                    "last_seen_frame": frame_count,
                    "settle_start_frame": None,  # frame of first ACCEPTED read
                    "locked": False,             # True once attributes are final
                }

            record = person_records[track_id]
            record["last_seen_frame"] = frame_count

            box_center_x_ratio = ((x1 + x2) / 2) / frame_w
            box_height_ratio = (y2 - y1) / frame_h
            is_well_positioned = (
                CENTER_BAND_MIN <= box_center_x_ratio <= CENTER_BAND_MAX
                and box_height_ratio >= MIN_BOX_HEIGHT_RATIO
            )

            # Run every frame until this person has a confirmed answer,
            # then drop to periodic refreshes to save compute. Once a
            # track is locked, skip re-detection for it entirely -- the
            # answer is already settled and won't change.
            needs_detection = (
                not record["locked"]
                and (record["gender"] == "Detecting..."
                     or frame_count % GENDER_EVERY_N_FRAMES == 0)
            )

            if (needs_detection
                    and crop.size > 0
                    and is_well_positioned):
                try:
                    faces = face_detector.detect(crop)
                    if faces:
                        face = faces[0]
                        landmarks = face.landmarks
                        aligned_face, _ = face_alignment(crop, landmarks, image_size=224)
                        result = fairface_model.predict(aligned_face)

                        # Judge each attribute independently on its OWN
                        # confidence and margin -- gender being easy on a
                        # given frame says nothing about whether race was.
                        g_label, g_conf, g_margin = top_and_margin(result["gender_scores"])
                        a_label, a_conf, a_margin = top_and_margin(result["age_scores"])
                        r_label, r_conf, r_margin = top_and_margin(result["race_scores"])

                        smoothed_gender, smoothed_gender_conf = update_attribute(
                            "gender", track_id, g_label, g_conf, g_margin)
                        smoothed_age, _ = update_attribute(
                            "age", track_id, a_label, a_conf, a_margin)
                        smoothed_race, _ = update_attribute(
                            "race", track_id, r_label, r_conf, r_margin)

                        any_accepted = (
                            g_conf >= MIN_ACCEPT_CONF["gender"] and g_margin >= MIN_MARGIN["gender"]
                        ) or (
                            a_conf >= MIN_ACCEPT_CONF["age"] and a_margin >= MIN_MARGIN["age"]
                        ) or (
                            r_conf >= MIN_ACCEPT_CONF["race"] and r_margin >= MIN_MARGIN["race"]
                        )

                        if any_accepted:
                            if record["settle_start_frame"] is None:
                                record["settle_start_frame"] = frame_count

                            if smoothed_gender is not None:
                                record["gender"] = smoothed_gender
                                record["gender_conf"] = smoothed_gender_conf
                            if smoothed_age is not None:
                                record["age"] = smoothed_age
                            if smoothed_race is not None:
                                record["race"] = smoothed_race

                            # Keep the crop from whichever single raw read
                            # had the highest gender confidence, not just
                            # the first read -- used only for picking a
                            # representative reference image.
                            if g_conf > best_conf_seen.get(track_id, -1):
                                crop_path = f"person_crops/person_{track_id}.jpg"
                                os.makedirs("person_crops", exist_ok=True)
                                cv2.imwrite(crop_path, crop)
                                record["crop_path"] = crop_path
                                best_conf_seen[track_id] = g_conf

                            # Lock once enough settle time has passed since
                            # the first accepted read -- stop updating for
                            # good, so the label stays put and readable.
                            if (frame_count - record["settle_start_frame"]) >= SETTLE_FRAMES:
                                record["locked"] = True
                except Exception:
                    pass

            if record["gender"] == "Female":
                color = (255, 0, 255)
            elif record["gender"] == "Male":
                color = (255, 200, 0)
            else:
                color = (180, 180, 180)  # grey = still detecting, not a guess
            cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
            label = f"ID {track_id}: {record['gender']} ({record['gender_conf']:.0f}%)"
            if record["age"]:
                label += f" | {record['age']} | {record['race']}"
            if record["locked"]:
                label += " [confirmed]"
            cv2.putText(frame, label, (x1, y1 - 10),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2)

    frame_count += 1
    cv2.imshow("Gender Detection - FairFace", frame)
    if cv2.waitKey(50) & 0xFF == ord('q'):
        break

cap.release()
cv2.destroyAllWindows()

# Save all person records to disk so they can be searched later
with open(RECORDS_FILE, "w") as f:
    json.dump(person_records, f, indent=2)

print(f"Saved {len(person_records)} person record(s) to {RECORDS_FILE}")