import cv2
import json
import time
import numpy as np
from datetime import datetime, timezone
from pathlib import Path
from ultralytics import YOLO
 
VIDEO_PATH = "sample_crowd.mp4"   # <-- same video used in select_regions.py
REGIONS_FILE = "regions.json"
DENSITY_SNAPSHOT_FILE = "density_snapshot.json"
DENSITY_HISTORY_FILE = "density_history.json"
SNAPSHOT_EVERY_N_FRAMES = 5
MAX_HISTORY_SAMPLES = 3600
 
# Density thresholds - tune these based on your test footage
LOW_THRESHOLD = 3
HIGH_THRESHOLD = 8
 
COLOR_LOW = (0, 255, 0)      # green
COLOR_MEDIUM = (0, 255, 255) # yellow
COLOR_HIGH = (0, 0, 255)     # red
 
 
def load_regions(path):
    with open(path, "r") as f:
        raw = json.load(f)
    # convert to numpy arrays for cv2.pointPolygonTest
    return {name: np.array(pts, dtype=np.int32) for name, pts in raw.items()}
 
 
def get_region(cx, cy, regions):
    for name, poly in regions.items():
        if cv2.pointPolygonTest(poly, (float(cx), float(cy)), False) >= 0:
            return name
    return None
 
 
def density_level(count):
    if count <= LOW_THRESHOLD:
        return "LOW", COLOR_LOW
    elif count <= HIGH_THRESHOLD:
        return "MEDIUM", COLOR_MEDIUM
    else:
        return "HIGH", COLOR_HIGH


def write_json_atomically(path, data):
    """Avoid the API reading a half-written JSON file while the monitor runs."""
    path = Path(path)
    temporary_path = path.with_suffix(path.suffix + ".tmp")
    temporary_path.write_text(json.dumps(data))
    temporary_path.replace(path)


def build_sample(frame_index, counts, run_status):
    return {
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "frame_index": frame_index,
        "run_status": run_status,
        "regions": [
            {"region_id": name, "name": name, "count": count}
            for name, count in counts.items()
        ],
    }
 
 
def main():
    regions = load_regions(REGIONS_FILE)
    if not regions:
        print("No regions found. Run select_regions.py first.")
        return
 
    model = YOLO("yolov8n.pt")  # auto-downloads on first run
    cap = cv2.VideoCapture(VIDEO_PATH)
 
    if not cap.isOpened():
        print(f"Could not open {VIDEO_PATH}")
        return
 
    print("Running. Press 'q' to quit.")
    # History represents this run only: do not blend it with an old clip.
    history = []
    write_json_atomically(DENSITY_HISTORY_FILE, history)
    last_counts = None
    last_frame_index = 0
    stopped_early = False
 
    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break
 
        results = model(frame, classes=[0], verbose=False)  # class 0 = person
 
        counts = {name: 0 for name in regions}
 
        for box in results[0].boxes.xyxy:
            x1, y1, x2, y2 = box.tolist()
            cx, cy = (x1 + x2) / 2, (y1 + y2) / 2
            region = get_region(cx, cy, regions)
            if region:
                counts[region] += 1
                cv2.circle(frame, (int(cx), int(cy)), 4, (255, 255, 255), -1)
 
        frame_index = int(cap.get(cv2.CAP_PROP_POS_FRAMES))
        last_counts = counts.copy()
        last_frame_index = frame_index
        if frame_index % SNAPSHOT_EVERY_N_FRAMES == 0:
            snapshot = build_sample(frame_index, counts, "running")
            history.append(snapshot)
            history = history[-MAX_HISTORY_SAMPLES:]
            write_json_atomically(DENSITY_HISTORY_FILE, history)
            write_json_atomically(DENSITY_SNAPSHOT_FILE, snapshot)
        # draw region polygons colored by density level
        for name, poly in regions.items():
            level, color = density_level(counts[name])
            cv2.polylines(frame, [poly], True, color, 2)
            label_pos = tuple(poly[0])
            cv2.putText(frame, f"{name}: {counts[name]} ({level})",
                        label_pos, cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2)
 
        total = sum(counts.values())
        cv2.putText(frame, f"Total (in regions): {total}", (10, 30),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
 
        cv2.imshow("CrowdSense - Region Density Monitor", frame)
        if cv2.waitKey(450) & 0xFF == ord('q'):
            stopped_early = True
            break

    # Publish the true final frame even when it is not on the sample boundary.
    if last_counts is not None:
        final_status = "stopped" if stopped_early else "completed"
        final_sample = build_sample(last_frame_index, last_counts, final_status)
        if not history or history[-1]["frame_index"] != last_frame_index:
            history.append(final_sample)
            history = history[-MAX_HISTORY_SAMPLES:]
            write_json_atomically(DENSITY_HISTORY_FILE, history)
        write_json_atomically(DENSITY_SNAPSHOT_FILE, final_sample)

    cap.release()
    cv2.destroyAllWindows()
 
 
if __name__ == "__main__":
    main()
