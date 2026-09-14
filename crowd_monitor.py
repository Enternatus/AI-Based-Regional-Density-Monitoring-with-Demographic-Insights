import cv2
import json
import os
import time
import numpy as np
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from ultralytics import YOLO
 
VIDEO_PATH = "sample_crowd.mp4"   # <-- same video used in select_regions.py
REGIONS_FILE = "regions.json"
DENSITY_SNAPSHOT_FILE = "density_snapshot.json"
DENSITY_HISTORY_FILE = "density_history.json"
LIVE_FRAME_FILE = Path(tempfile.gettempdir()) / "crowdsense_live_density.jpg"
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
    """Avoid the API reading a half-written JSON file while the monitor runs.
    Resilient on Windows / OneDrive: retries on transient file locks and falls back cleanly."""
    path = Path(path)
    content = json.dumps(data)
    temporary_path = path.with_suffix(f"{path.suffix}.{os.getpid()}.tmp")

    try:
        temporary_path.write_text(content)
    except Exception:
        try:
            path.write_text(content)
        except Exception:
            pass
        return

    replaced = False
    for _ in range(5):
        try:
            temporary_path.replace(path)
            replaced = True
            break
        except (PermissionError, OSError):
            time.sleep(0.015)

    if not replaced:
        try:
            path.write_text(content)
        except Exception:
            pass

    if temporary_path.exists():
        try:
            temporary_path.unlink()
        except Exception:
            pass


def write_frame_atomically(path, buffer):
    path = Path(path)
    tmp_path = path.with_suffix(f"{path.suffix}.{os.getpid()}.tmp")
    try:
        tmp_path.write_bytes(buffer)
        for _ in range(3):
            try:
                tmp_path.replace(path)
                return
            except PermissionError:
                time.sleep(0.005)
    except Exception:
        pass
    try:
        path.write_bytes(buffer)
    except Exception:
        pass


def build_sample(frame_index, counts, run_status, run_id=None, started_at=None, source_video=None, video_fps=30, completed_at=None):
    sample = {
        "run_id": run_id,
        "source_video": source_video or VIDEO_PATH,
        "video_fps": video_fps,
        "started_at": started_at,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "frame_index": frame_index,
        "run_status": run_status,
        "regions": [
            {"region_id": name, "name": name, "count": count}
            for name, count in counts.items()
        ],
    }
    if completed_at:
        sample["completed_at"] = completed_at
    return sample
 
 
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
    run_id = f"run_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}"
    started_at = datetime.now(timezone.utc).isoformat()
    fps = int(cap.get(cv2.CAP_PROP_FPS)) or 30

    write_json_atomically(DENSITY_HISTORY_FILE, history)
    last_counts = None
    last_frame_index = 0
    stopped_early = False
 
    try:
        while cap.isOpened():
            t_frame_start = time.perf_counter()
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

            frame_index = int(cap.get(cv2.CAP_PROP_POS_FRAMES))
            last_counts = counts.copy()
            last_frame_index = frame_index
            if frame_index % SNAPSHOT_EVERY_N_FRAMES == 0:
                snapshot = build_sample(
                    frame_index, counts, "running",
                    run_id=run_id, started_at=started_at,
                    source_video=VIDEO_PATH, video_fps=fps
                )
                history.append(snapshot)
                history = history[-MAX_HISTORY_SAMPLES:]
                write_json_atomically(DENSITY_HISTORY_FILE, history)
                write_json_atomically(DENSITY_SNAPSHOT_FILE, snapshot)
            # draw region polygons colored by density level
            for name, poly in regions.items():
                level, color = density_level(counts[name])
                cv2.polylines(frame, [poly], True, color, 2)
                display_name = name.replace("_", " ").title()
                label_pos = (int(poly[0][0]) + 6, int(poly[0][1]) + 20)
                cv2.putText(frame, f"{display_name}: {counts[name]} ({level})",
                            label_pos, cv2.FONT_HERSHEY_SIMPLEX, 0.55, color, 2)
 
            total = sum(counts.values())
            cv2.putText(frame, f"Total (in regions): {total}", (10, 30),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
 
            # Broadcast live frame for dashboard synchronization
            success, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 70])
            if success:
                write_frame_atomically(LIVE_FRAME_FILE, buf.tobytes())

            cv2.imshow("CrowdSense - Region Density Monitor", frame)
            # Frame pacing: delay so video plays at natural camera speed (15 FPS)
            elapsed_ms = (time.perf_counter() - t_frame_start) * 1000
            target_frame_ms = 1000.0 / max(1, fps)
            wait_ms = max(1, int(target_frame_ms - elapsed_ms))
            if cv2.waitKey(wait_ms) & 0xFF == ord('q'):
                stopped_early = True
                break
    finally:
        try:
            if LIVE_FRAME_FILE.exists():
                LIVE_FRAME_FILE.unlink()
        except Exception:
            pass

    # Publish the true final frame even when it is not on the sample boundary.
    if last_counts is not None:
        final_status = "stopped" if stopped_early else "completed"
        completed_at = datetime.now(timezone.utc).isoformat()
        final_sample = build_sample(
            last_frame_index, last_counts, final_status,
            run_id=run_id, started_at=started_at,
            source_video=VIDEO_PATH, video_fps=fps,
            completed_at=completed_at
        )
        if not history or history[-1]["frame_index"] != last_frame_index:
            history.append(final_sample)
            history = history[-MAX_HISTORY_SAMPLES:]
            write_json_atomically(DENSITY_HISTORY_FILE, history)
        write_json_atomically(DENSITY_SNAPSHOT_FILE, final_sample)

    cap.release()
    cv2.destroyAllWindows()
 
 
if __name__ == "__main__":
    main()
