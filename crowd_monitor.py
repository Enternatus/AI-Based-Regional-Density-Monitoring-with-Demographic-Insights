import cv2
import json
import numpy as np
from ultralytics import YOLO
 
VIDEO_PATH = "sample_crowd.mp4"   # <-- same video used in select_regions.py
REGIONS_FILE = "regions.json"
 
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
            break
 
    cap.release()
    cv2.destroyAllWindows()
 
 
if __name__ == "__main__":
    main()
 















