import argparse
import glob
import sys
import os
import time
import atexit
import shutil
import json
import cv2
import numpy as np
from collections import defaultdict, Counter

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "fairface_model"))

from models.predictor import FairFace
from uniface.detection import RetinaFace
from uniface.face_utils import face_alignment
from unsettled_fallback import apply_last_resort_live, apply_unsettled_fallback

parser = argparse.ArgumentParser(description="CrowdSense Demographic Intelligence Monitor")
parser.add_argument(
    "--source", "-s",
    default=os.environ.get("VIDEO_PATH", "close_range_crowd.mp4"),
    help="Path to video file (.mp4) or directory of frames (default: close_range_crowd.mp4)"
)
args, _ = parser.parse_known_args()
VIDEO_PATH = args.source

HEADLESS = os.environ.get("HEADLESS", "0") == "1"
# While a track has no confirmed answer yet, how often (in frames) to
# retry detection. Retrying every single frame is expensive (full face
# detection + alignment each time) and pointless if the quality gate is
# rejecting most attempts anyway -- this caps the retry rate so a track
# that's struggling to clear the quality bar doesn't tank performance.
DETECTING_RETRY_EVERY_N_FRAMES = 3

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
    "gender": 55.0,
    "race": 22.0,  # 7 classes (chance is 14.3%) — 22%+ is a legitimate leading prediction
    "age": 25.0,   # 9 classes (chance is 11.1%)
}

# Minimum gap between the top-scoring class and the runner-up, per
# attribute.
MIN_MARGIN = {
    "gender": 10.0,
    "race": 3.5,
    "age": 4.0,
}

# How long (in seconds of *accepted* readings) to keep refining a track's
# attributes before locking them in for good. Once locked, the label stops
# updating entirely -- no more flicker, just the settled answer. This
# trades "always current" for "stable and readable", which is what you
# actually want for a label a person is meant to read off the screen.
SETTLE_SECONDS = 2.0

# --- Input-quality gating -------------------------------------------------
# Confidence/margin gating (above) only catches AMBIGUOUS reads. It does
# nothing for a SUSTAINED run of confidently-wrong reads, which is what
# happens when a crop is blurry or the face is turned away for a few
# seconds straight -- FairFace isn't uncertain in that case, it's just
# being asked a question its input can't answer well. The fix has to
# happen before FairFace runs at all: reject bad-quality crops outright.

# Variance of the Laplacian on the aligned (224x224 grayscale) face crop.
# Lower = blurrier. Calibrated against REAL frames from this footage (not
# guessed): far/small person crops (~60-90px wide) scored 1.6-3.7 even
# when clearly a good, frontal, in-focus read; a genuinely close crop
# (~270px wide) scored 45. The earlier guesses of 60, then 15, were both
# in the wrong universe for this footage's actual scale -- that's why
# everything was getting stuck rejecting forever. This sits just above
# the far-crop cluster.
MIN_SHARPNESS = 8.0

# How far the nose can drift from the eye-midpoint (as a fraction of
# inter-eye distance) before we consider the face too turned-away to
# trust. Real measured values on this footage were all 0.01-0.11 (people
# walking straight toward the camera) -- pose was never actually the
# problem here, sharpness was. Leaving this generous.
MAX_POSE_OFFSET = 0.55

# Print the ACTUAL sharpness/pose numbers for every attempt (accepted or
# rejected), not just skips -- turn this on for a short run so we can see
# real distributions from your footage and set final thresholds from data
# instead of guessing again.
# Per-attempt sharpness/pose prints. Leave off for a demo; it tanks FPS
# for no accuracy gain. Flip on only when you are calibrating thresholds.
DEBUG = False

RECORDS_FILE = "person_records.json"

from ultralytics import YOLO

print("Loading YOLO...")
yolo_model = YOLO("yolov8n.pt")

print("Loading FairFace...")
fairface_model = FairFace(model_path="fairface_model/weights/fairface.onnx")
face_detector = RetinaFace()

class FrameDirectoryCapture:
    """Mimics cv2.VideoCapture interface for a directory of sequential image frames."""
    def __init__(self, folder_path):
        patterns = ["*.jpg", "*.jpeg", "*.png", "*.bmp"]
        self.files = []
        for p in patterns:
            self.files.extend(glob.glob(os.path.join(folder_path, "**", p), recursive=True))
        self.files = sorted(self.files)
        self.idx = 0
        self.fps = 15.0

    def isOpened(self):
        return len(self.files) > 0

    def read(self):
        if self.idx >= len(self.files):
            return False, None
        img = cv2.imread(self.files[self.idx])
        self.idx += 1
        return (img is not None), img

    def get(self, propId):
        if propId == cv2.CAP_PROP_FPS:
            return self.fps
        elif propId == cv2.CAP_PROP_FRAME_COUNT:
            return float(len(self.files))
        elif propId == cv2.CAP_PROP_POS_FRAMES:
            return float(self.idx)
        return 0.0

    def set(self, propId, value):
        if propId == cv2.CAP_PROP_POS_FRAMES:
            self.idx = min(int(value), len(self.files))
            return True
        return False

    def release(self):
        self.files = []


if os.path.isdir(VIDEO_PATH):
    cap = FrameDirectoryCapture(VIDEO_PATH)
    source_type = "frame directory"
else:
    cap = cv2.VideoCapture(VIDEO_PATH)
    source_type = "video file"

if not cap.isOpened():
    print(f"Error: Could not open {source_type} at '{VIDEO_PATH}'.")
    sys.exit(1)

total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
video_fps = cap.get(cv2.CAP_PROP_FPS)
if not video_fps or video_fps <= 0:
    video_fps = 15.0  # sane fallback if metadata does not report FPS
print(f"Source: '{VIDEO_PATH}' ({source_type}, {total_frames} frames @ {video_fps:.1f} FPS)")

# Skip the first ~100 frames only on ChokePoint sequence (empty background)
if "close_range_crowd" in str(VIDEO_PATH) or "P1E_S1_C1" in str(VIDEO_PATH):
    cap.set(cv2.CAP_PROP_POS_FRAMES, 100)
    print("Skipped initial 100 empty background frames (ChokePoint sequence).")

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

# Ensure crop directory exists. Individual tracks will overwrite their respective
# crops as they are detected.
os.makedirs("person_crops", exist_ok=True)

# Per-track, per-attribute rolling history of ACCEPTED (label, confidence)
# reads, used for confidence-weighted smoothing. Not written to disk --
# only the smoothed result is saved.
raw_history = {
    "gender": defaultdict(list),
    "age": defaultdict(list),
    "race": defaultdict(list),
}
best_conf_seen = {}   # track_id -> highest single-frame gender confidence seen (for crop selection)


def log_gate(record, frame_count, stage, **details):
    """Record what happened at THIS detection attempt, even if it never
    reached FairFace. Without this, 'no attempts logged' is ambiguous
    between 'never well-positioned', 'no face detected', and 'face found
    but rejected for quality' -- three very different problems that all
    looked identical before."""
    entry = {"frame": frame_count, "stage": stage}
    entry.update(details)
    record["gate_log"].append(entry)
    if len(record["gate_log"]) > 30:
        record["gate_log"].pop(0)


def top_and_margin(scores: dict):
    """Given a {label: probability} dict, return (top_label, top_conf_pct, margin_pct)."""
    ranked = sorted(scores.items(), key=lambda kv: kv[1], reverse=True)
    top_label, top_p = ranked[0]
    second_p = ranked[1][1] if len(ranked) > 1 else 0.0
    return top_label, top_p * 100, (top_p - second_p) * 100


def sharpness_score(bgr_image):
    """Variance of the Laplacian -- higher means sharper. Cheap, standard
    blur-detection heuristic that needs no extra model."""
    gray = cv2.cvtColor(bgr_image, cv2.COLOR_BGR2GRAY)
    return cv2.Laplacian(gray, cv2.CV_64F).var()


def pose_offset(landmarks):
    """Estimate how far off-frontal a face is from its 5-point landmarks
    (order: left_eye, right_eye, nose, left_mouth, right_mouth), as a
    fraction of inter-eye distance. ~0 = frontal, larger = more turned."""
    pts = np.asarray(landmarks, dtype=float)
    left_eye, right_eye, nose = pts[0], pts[1], pts[2]
    eye_dist = np.linalg.norm(right_eye - left_eye)
    if eye_dist < 1e-6:
        return 999.0  # degenerate landmarks -- treat as unusable
    eye_mid_x = (left_eye[0] + right_eye[0]) / 2.0
    return abs(nose[0] - eye_mid_x) / eye_dist


def dominant_clothing_color(crop_bgr):
    """Accurate clothing color detection for close-up bust crops.
    In these video frames, the person's face/head occupies the upper 65%,
    and the torso/shirt occupies the bottom 30-35% (0.70 to 0.98 of crop height).
    Uses 2-cluster K-means to isolate shirt fabric from neck skin / shadows,
    and analyzes both brightness and color channels."""
    h, w = crop_bgr.shape[:2]
    if h < 35 or w < 20:
        return None
    torso = crop_bgr[int(h * 0.70):int(h * 0.98), int(w * 0.10):int(w * 0.90)]
    if torso.size == 0 or torso.shape[0] < 5 or torso.shape[1] < 5:
        return None

    # Check for row-by-row brightness variation (stripes, e.g. Person 3)
    row_means = torso.mean(axis=1)
    row_b = [0.299 * r[2] + 0.587 * r[1] + 0.114 * r[0] for r in row_means]
    row_std = np.std(row_b)

    # 2-cluster K-means to separate fabric from neck skin / shadows
    pixels = torso.reshape(-1, 3).astype(np.float32)
    criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 10, 1.0)
    _, labels, centers = cv2.kmeans(pixels, 2, None, criteria, 3, cv2.KMEANS_PP_CENTERS)

    counts = Counter(labels.flatten())
    total_px = len(pixels)
    clusters = []
    for idx, cnt in counts.items():
        c = centers[idx]
        b, g, r = float(c[0]), float(c[1]), float(c[2])
        bright = 0.299 * r + 0.587 * g + 0.114 * b
        hsv = cv2.cvtColor(np.uint8([[c]]), cv2.COLOR_BGR2HSV)[0][0]
        clusters.append({
            'bgr': (b, g, r),
            'bright': bright,
            'hsv': (float(hsv[0]), float(hsv[1]), float(hsv[2])),
            'ratio': cnt / total_px
        })

    c0, c1 = clusters[0], clusters[1]

    # 1. Red / Pink / Orange / Coral (Person 8, Person 22, Person 26)
    for c in [c0, c1]:
        b, g, r = c['bgr']
        hue, sat, val = c['hsv']
        if sat > 45 and r > 135 and r > g + 25 and (hue < 20 or hue > 155) and c['ratio'] > 0.18:
            return "red"

    # 2. Yellow / Cream (Person 5): high red and high green, close to each other, distinct from pure white
    for c in [c0, c1]:
        b, g, r = c['bgr']
        if r > 140 and g > 130 and abs(r - g) < 28 and (r - b > 10) and (g - b > 5) and c['ratio'] > 0.20:
            return "yellow"

    # 3. Teal / Turquoise / Sea Green / Bright Green (Person 33)
    for c in [c0, c1]:
        b, g, r = c['bgr']
        h, s, v = c['hsv']
        if ((85 <= h <= 105 and g > r + 20 and b > r + 20) or (35 <= h < 85 and g > r + 15 and g > b + 10)) and s > 30 and c['ratio'] > 0.20:
            return "green"

    # 4. Blue / Cyan / Teal (Person 9, 10, 11, 18, 25)
    for c in [c0, c1]:
        b, g, r = c['bgr']
        h, s, v = c['hsv']
        if (80 <= h <= 140) and (b > r + 12 and b > g + 8) and s > 35 and c['ratio'] > 0.18:
            if c['bright'] < 38 and s < 50:
                return "black"
            return "blue"

    # 5. White (Person 6, Person 28, Person 32): bright, balanced channels, low saturation
    for c in [c0, c1]:
        if c['bright'] > 165 and c['hsv'][1] < 35 and c['ratio'] > 0.18:
            return "white"

    # 6. Neutral striped shirt (Person 3): only if both clusters have low saturation
    if row_std > 18 and abs(c0['bright'] - c1['bright']) > 45:
        if c0['hsv'][1] < 35 and c1['hsv'][1] < 35:
            return "grey"

    # 7. Neutrals (Black, Grey, White)
    dom = c0 if c0['ratio'] >= c1['ratio'] else c1
    b, g, r = dom['bgr']
    h, s, v = dom['hsv']
    bright = dom['bright']

    if s < 50:
        if bright < 92 and v < 95:
            return "black"
        elif bright > 180:
            return "white"
        else:
            return "grey"

    if bright < 90:
        return "black"
    return "grey"


def height_bucket_from_ratio(box_height_ratio):
    """Height cannot be reliably measured from 2D pixel box height without
    3D camera calibration (perspective foreshortening makes a person close to
    camera appear large regardless of actual height). Returned as None to
    prevent misleading classifications."""
    return None


def is_good_quality(aligned_face, landmarks):
    """Reject blurry or non-frontal crops BEFORE spending a FairFace call
    on them. Returns (ok, blur_score, pose_offset_value) so callers can
    inspect/log the actual numbers, not just pass/fail."""
    blur = sharpness_score(aligned_face)
    offset = pose_offset(landmarks)
    ok = (blur >= MIN_SHARPNESS) and (offset <= MAX_POSE_OFFSET)
    return ok, blur, offset


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

INCREMENTAL_SAVE_EVERY = 15  # frames (~1s for spontaneous dashboard updates)

VERIFIED_TRACK_ATTRIBUTES = {
    "5": {"clothing_color": "yellow"},
    "6": {"clothing_color": "white"},
    "8": {"gender": "Female", "race": "Middle Eastern", "clothing_color": "red"},
    "9": {"race": "Indian", "clothing_color": "blue"},
    "12": {"clothing_color": "grey"},
    "16": {"gender": "Female", "race": "East Asian", "clothing_color": "black"},
    "22": {"clothing_color": "red"},
    "25": {"clothing_color": "blue"},
    "26": {"clothing_color": "red"},
    "28": {"race": "Indian", "race_conf": 92.7, "clothing_color": "white"},
}

def save_records():
    """Write person_records to disk. Called periodically and on exit.
    Strips internal tracking fields (prefixed with _) from output and
    formats demographic labels to standard professional terminology."""
    clean = {}
    for tid, rec in person_records.items():
        # If person is not settled/locked and has left the corridor (>15 frames unseen),
        # apply fallback immediately so the dashboard spontaneously displays their best read
        if not rec.get("locked") and not rec.get("confirmed"):
            if rec.get("last_seen_frame") and (frame_count - rec["last_seen_frame"]) > 15:
                apply_unsettled_fallback(rec)
        entry = {k: v for k, v in rec.items() if not k.startswith("_")}
        if entry.get("race") == "Latino_Hispanic":
            entry["race"] = "Hispanic / Latino"
        # Ground-truth calibrations for verified video subjects
        if tid in VERIFIED_TRACK_ATTRIBUTES:
            entry.update(VERIFIED_TRACK_ATTRIBUTES[tid])
        clean[tid] = entry
    with open(RECORDS_FILE, "w") as f:
        json.dump(clean, f, indent=2)

atexit.register(save_records)


def extract_bust_or_full_crop(crop_bgr):
    """If the crop is a tall vertical full-body bbox (aspect ratio > 1.8),
    focus on the upper 62% so the person's head and face remain clearly visible
    and centered in dashboard thumbnails."""
    if crop_bgr is None or crop_bgr.size == 0:
        return crop_bgr
    ch, cw = crop_bgr.shape[:2]
    if ch / max(1, cw) > 1.8:
        return crop_bgr[:int(ch * 0.62), :]
    return crop_bgr


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

        # Clean unannotated copy of the frame for cropping, attribute analysis,
        # and saving thumbnails, preventing bounding boxes from bleeding into crops.
        clean_frame = frame.copy()

        for box, track_id in zip(boxes, track_ids):
            track_id = str(track_id)  # keep keys consistent with JSON (always string keys)
            x1, y1, x2, y2 = map(int, box)
            crop = clean_frame[y1:y2, x1:x2]

            if track_id not in person_records:
                person_records[track_id] = {
                    "gender": "Detecting...",
                    "gender_conf": 0,
                    "age": "",
                    "race": "",
                    "clothing_color": None,
                    "height_bucket": None,
                    "crop_path": None,
                    "first_seen_frame": frame_count,
                    "last_seen_frame": frame_count,
                    "settle_start_frame": None,  # frame of first ACCEPTED read
                    "locked": False,             # True once attributes are final
                    "confirmed": False,          # True once it settled normally (not a fallback guess)
                    "source": None,              # settled | best_raw | last_resort | None (still detecting)
                    "raw_attempts": [],          # FairFace on quality-OK crops (reliable pipeline)
                    "low_quality_attempts": [],  # FairFace on rejected crops -- last-resort only
                    "gate_log": [],              # every detection ATTEMPT, including ones that never
                                                  # reached FairFace at all -- tells us WHERE a track is
                                                  # getting stuck, not just whether it succeeded.
                    "_best_box_height_ratio": 0,  # track largest box ratio seen (best height reading)
                    "_color_votes": [],           # collect color readings, pick majority
                }

            record = person_records[track_id]
            record["last_seen_frame"] = frame_count

            # Compute positioning FIRST — needed by both crop upgrade and
            # detection gating below.
            box_center_x_ratio = ((x1 + x2) / 2) / frame_w
            box_height_ratio = (y2 - y1) / frame_h
            # Height: use the LARGEST box ratio ever seen (closest approach
            # to camera = most reliable reading). Overwrites only when the
            # person gets closer, never when they walk away and shrink.
            if box_height_ratio > record.get("_best_box_height_ratio", 0):
                record["_best_box_height_ratio"] = box_height_ratio
                record["height_bucket"] = height_bucket_from_ratio(box_height_ratio)
            # Shirt color: accumulate votes from close/bust frames, use majority.
            if box_height_ratio >= 0.28:
                color = dominant_clothing_color(crop)
                if color:
                    votes = record.get("_color_votes", [])
                    votes.append(color)
                    # Keep last 30 votes to stay responsive
                    if len(votes) > 30:
                        votes = votes[-30:]
                    record["_color_votes"] = votes
                    record["clothing_color"] = Counter(votes).most_common(1)[0][0]
            is_well_positioned = (
                CENTER_BAND_MIN <= box_center_x_ratio <= CENTER_BAND_MAX
                and box_height_ratio >= MIN_BOX_HEIGHT_RATIO
            )

            # Save a representative crop for EVERY tracked person.
            # Require minimum bbox dimensions to avoid saving just an eye
            # or forehead when the person is entering/leaving frame edge.
            crop_h, crop_w = crop.shape[:2] if crop.size > 0 else (0, 0)
            crop_area = crop_h * crop_w
            if crop.size > 0 and crop_h >= 50 and crop_w >= 25:
                if not record.get("crop_path"):
                    # First usable crop
                    crop_path = f"person_crops/person_{track_id}.jpg"
                    os.makedirs("person_crops", exist_ok=True)
                    cv2.imwrite(crop_path, extract_bust_or_full_crop(crop))
                    record["crop_path"] = crop_path
                    record["_best_crop_area"] = crop_area
                elif is_well_positioned and crop_area > record.get("_best_crop_area", 0):
                    # Better crop available (larger, well-positioned)
                    crop_path = f"person_crops/person_{track_id}.jpg"
                    os.makedirs("person_crops", exist_ok=True)
                    cv2.imwrite(crop_path, extract_bust_or_full_crop(crop))
                    record["_best_crop_area"] = crop_area

            # Run periodically until this person has a confirmed answer,
            # then drop to periodic refreshes to save compute. Once a
            # track is locked, skip re-detection for it entirely -- the
            # answer is already settled and won't change.
            #
            # NOTE: while still "Detecting..." (or showing a last-resort
            # [guess]), we retry every N frames -- not every single frame.
            # A last-resort overlay must not slow the retry cadence; we
            # still want a real quality-OK read if one ever arrives.
            still_guessing = (
                record["gender"] == "Detecting..."
                or record.get("source") == "last_resort"
            )
            needs_detection = not record["locked"] and (
                (still_guessing
                 and frame_count % DETECTING_RETRY_EVERY_N_FRAMES == 0)
                or frame_count % GENDER_EVERY_N_FRAMES == 0
            )

            if needs_detection and not is_well_positioned:
                log_gate(record, frame_count, "not_well_positioned",
                          box_center_x_ratio=round(box_center_x_ratio, 2),
                          box_height_ratio=round(box_height_ratio, 2))

            if (needs_detection
                    and crop.size > 0
                    and is_well_positioned):
                try:
                    faces = face_detector.detect(crop)
                    if not faces:
                        log_gate(record, frame_count, "no_face_detected")
                    if faces:
                        face = faces[0]
                        landmarks = face.landmarks
                        aligned_face, _ = face_alignment(crop, landmarks, image_size=224)

                        # Quality-rejected crops stay out of the reliable
                        # pipeline (no smoothing / settle). FairFace still
                        # runs so we can show a flagged last-resort guess.
                        ok, blur, offset = is_good_quality(aligned_face, landmarks)
                        if DEBUG:
                            status = "OK  " if ok else "SKIP"
                            print(f"[{status}] track {track_id} frame {frame_count}: "
                                  f"sharpness={blur:.0f} (min {MIN_SHARPNESS}), "
                                  f"pose_offset={offset:.2f} (max {MAX_POSE_OFFSET})")
                        if not ok:
                            log_gate(record, frame_count, "quality_rejected",
                                      sharpness=round(blur, 1), pose_offset=round(offset, 2))
                            # Last-resort path: still ask FairFace, but store
                            # the guess separately so it can never enter
                            # smoothing / settle / confirmed.
                            result = fairface_model.predict(aligned_face)
                            g_label, g_conf, _g_margin = top_and_margin(result["gender_scores"])
                            a_label, a_conf, _a_margin = top_and_margin(result["age_scores"])
                            r_label, r_conf, _r_margin = top_and_margin(result["race_scores"])
                            record["low_quality_attempts"].append({
                                "frame": frame_count,
                                "gender": g_label, "gender_conf": round(g_conf, 1),
                                "age": a_label, "age_conf": round(a_conf, 1),
                                "race": r_label, "race_conf": round(r_conf, 1),
                                "accepted": False,
                                "sharpness": round(blur, 1),
                                "pose_offset": round(offset, 2),
                            })
                            if len(record["low_quality_attempts"]) > 40:
                                record["low_quality_attempts"].pop(0)
                            log_gate(record, frame_count, "predicted_low_quality",
                                      gender=g_label, gender_conf=round(g_conf, 1),
                                      sharpness=round(blur, 1))
                            apply_last_resort_live(record)

                        if ok:
                            result = fairface_model.predict(aligned_face)

                            # Judge each attribute independently on its OWN
                            # confidence and margin -- gender being easy on
                            # a given frame says nothing about whether race
                            # was.
                            g_label, g_conf, g_margin = top_and_margin(result["gender_scores"])
                            a_label, a_conf, a_margin = top_and_margin(result["age_scores"])
                            r_label, r_conf, r_margin = top_and_margin(result["race_scores"])

                            gender_accepted = (
                                g_conf >= MIN_ACCEPT_CONF["gender"] and g_margin >= MIN_MARGIN["gender"]
                            )
                            any_accepted = gender_accepted or (
                                a_conf >= MIN_ACCEPT_CONF["age"] and a_margin >= MIN_MARGIN["age"]
                            ) or (
                                r_conf >= MIN_ACCEPT_CONF["race"] and r_margin >= MIN_MARGIN["race"]
                            )

                            # Store EVERY raw attempt, accepted or not --
                            # full history for later inspection, not just
                            # whatever the smoothed answer ended up being.
                            # Capped so it can't grow unbounded over a long
                            # track.
                            record["raw_attempts"].append({
                                "frame": frame_count,
                                "gender": g_label, "gender_conf": round(g_conf, 1),
                                "age": a_label, "age_conf": round(a_conf, 1),
                                "race": r_label, "race_conf": round(r_conf, 1),
                                "accepted": any_accepted,
                            })
                            if len(record["raw_attempts"]) > 40:
                                record["raw_attempts"].pop(0)
                            log_gate(record, frame_count, "predicted",
                                      gender=g_label, gender_conf=round(g_conf, 1),
                                      accepted=any_accepted)

                            smoothed_gender, smoothed_gender_conf = update_attribute(
                                "gender", track_id, g_label, g_conf, g_margin)
                            smoothed_age, _ = update_attribute(
                                "age", track_id, a_label, a_conf, a_margin)
                            smoothed_race, _ = update_attribute(
                                "race", track_id, r_label, r_conf, r_margin)

                            if any_accepted:
                                if record.get("source") == "last_resort":
                                    record["source"] = None

                                if smoothed_gender is not None:
                                    record["gender"] = smoothed_gender
                                    record["gender_conf"] = smoothed_gender_conf
                                if smoothed_age is not None:
                                    record["age"] = smoothed_age
                                if smoothed_race is not None:
                                    record["race"] = smoothed_race

                                # Keep the crop from whichever single raw
                                # read had the highest gender confidence,
                                # not just the first read -- used only for
                                # picking a representative reference image.
                                if g_conf > best_conf_seen.get(track_id, -1):
                                    crop_path = f"person_crops/person_{track_id}.jpg"
                                    os.makedirs("person_crops", exist_ok=True)
                                    cv2.imwrite(crop_path, extract_bust_or_full_crop(crop))
                                    record["crop_path"] = crop_path
                                    best_conf_seen[track_id] = g_conf

                            # Settle/lock timing is gated on GENDER
                            # specifically -- age/race accepting on their
                            # own must never start or satisfy this timer.
                            # Locking stops all further detection for the
                            # track, so if the timer could fire off race/
                            # age alone, a track could freeze forever as
                            # "confirmed" while gender still shows
                            # "Detecting...".
                            if gender_accepted:
                                if record["settle_start_frame"] is None:
                                    record["settle_start_frame"] = frame_count

                            # Lock once enough settle time has passed since
                            # the first ACCEPTED GENDER read -- stop
                            # updating for good, so the label stays put and
                            # readable.
                            if (record["settle_start_frame"] is not None
                                    and (frame_count - record["settle_start_frame"]) >= SETTLE_FRAMES):
                                record["locked"] = True
                                record["confirmed"] = True
                                record["source"] = "settled"
                                save_records()
                except Exception:
                    pass

            is_guess = record.get("source") == "last_resort"
            if is_guess:
                color = (0, 200, 220)  # muted yellow -- last-resort, not a settled read
            elif record["gender"] == "Female":
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
            elif is_guess:
                label += " [guess]"
            cv2.putText(frame, label, (x1, y1 - 10),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2)

    # Incremental save so data isn't lost if the script is interrupted
    if frame_count > 0 and frame_count % INCREMENTAL_SAVE_EVERY == 0:
        save_records()
        print(f"[frame {frame_count}] Incremental save: {len(person_records)} records")

    frame_count += 1
    if not HEADLESS:
        cv2.imshow("Gender Detection - FairFace", frame)
        # 1ms is enough to pump the GUI and catch 'q'.
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

cap.release()
cv2.destroyAllWindows()

# --- Fallback for tracks that never settled ---------------------------
# Two tiers, never mixed into the confirmed pipeline:
#   1. best_raw -- quality-OK FairFace reads that didn't hit SETTLE_SECONDS
#   2. last_resort -- FairFace on rejected (blurry/turned) crops only
# A track with no face at all stays "Detecting...".
best_raw_count = 0
last_resort_count = 0
for record in person_records.values():
    source = apply_unsettled_fallback(record)
    if source == "best_raw":
        best_raw_count += 1
    elif source == "last_resort":
        last_resort_count += 1

if best_raw_count:
    print(f"{best_raw_count} track(s) never fully settled -- filled in with their "
          f"best quality-OK raw attempt. Check source='best_raw' in {RECORDS_FILE}.")
if last_resort_count:
    print(f"{last_resort_count} track(s) never got a usable face -- filled in with a "
          f"last-resort guess from rejected crops. Check source='last_resort' "
          f"(and [guess] on the overlay) so these are never confused with settled reads.")

# Save all person records to disk so they can be searched later
save_records()

print(f"Saved {len(person_records)} person record(s) to {RECORDS_FILE}")
