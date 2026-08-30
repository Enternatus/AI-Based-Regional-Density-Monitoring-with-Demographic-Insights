import sys
import os
import json
import cv2
from ultralytics import YOLO

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "fairface_model"))

from models.predictor import FairFace
from uniface.detection import RetinaFace
from uniface.face_utils import face_alignment

VIDEO_PATH = "close_range_crowd.mp4"
GENDER_EVERY_N_FRAMES = 20

CENTER_BAND_MIN = 0.25
CENTER_BAND_MAX = 0.75
MIN_BOX_HEIGHT_RATIO = 0.35

RECORDS_FILE = "person_records.json"

print("Loading YOLO...")
yolo_model = YOLO("yolov8n.pt")

print("Loading FairFace...")
fairface_model = FairFace(model_path="fairface_model/weights/fairface.onnx")
face_detector = RetinaFace()

cap = cv2.VideoCapture(VIDEO_PATH)

# Skip the first ~100 frames, which are empty background
# (no people) at the start of every ChokePoint sequence.
cap.set(cv2.CAP_PROP_POS_FRAMES, 100)

# Load any existing records from a previous run so this run adds
# to them instead of wiping them out. Since this is the same video,
# the same track ID represents the same physical person, so a
# fresh detection for that ID simply updates/improves the record.
if os.path.exists(RECORDS_FILE):
    with open(RECORDS_FILE, "r") as f:
        person_records = json.load(f)
    print(f"Loaded {len(person_records)} existing record(s) from {RECORDS_FILE}")
else:
    person_records = {}

frame_count = 0

print("Running. Press 'q' to quit.")

while cap.isOpened():
    ret, frame = cap.read()
    if not ret:
        break

    frame_h, frame_w = frame.shape[:2]

    # persist=True keeps the same ID for the same person across frames
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
            # then drop to periodic refreshes to save compute.
            needs_detection = (
                record["gender"] == "Detecting..."
                or frame_count % GENDER_EVERY_N_FRAMES == 0
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

                        gender = result["gender"]
                        gender_conf = result["gender_scores"][gender] * 100
                        age = result["age"]
                        race = result["race"]

                        record["gender"] = gender
                        record["gender_conf"] = gender_conf
                        record["age"] = age
                        record["race"] = race

                        # Save a reference crop the first time we get a
                        # confident read, so it can be viewed later.
                        if "crop_path" not in record:
                            crop_path = f"person_crops/person_{track_id}.jpg"
                            os.makedirs("person_crops", exist_ok=True)
                            cv2.imwrite(crop_path, crop)
                            record["crop_path"] = crop_path
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