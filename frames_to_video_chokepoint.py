import cv2
import glob
import os
 
FRAMES_DIR = "P1E_S1_C1/P1E_S1_C1"
OUTPUT_FILE = "close_range_crowd.mp4"
FPS = 15
 
frame_files = sorted(glob.glob(os.path.join(FRAMES_DIR, "*.jpg")))
if not frame_files:
    frame_files = sorted(glob.glob(os.path.join(FRAMES_DIR, "*.png")))
 
print(f"Found {len(frame_files)} frames")
 
if not frame_files:
    print("No frames found — check FRAMES_DIR path and file extension.")
else:
    first_frame = cv2.imread(frame_files[0])
    h, w = first_frame.shape[:2]
 
    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    out = cv2.VideoWriter(OUTPUT_FILE, fourcc, FPS, (w, h))
 
    for i, f in enumerate(frame_files):
        frame = cv2.imread(f)
        if frame is not None:
            out.write(frame)
        if i % 200 == 0:
            print(f"Processed {i}/{len(frame_files)}")
 
    out.release()
    print(f"Done. Saved {len(frame_files)} frames to {OUTPUT_FILE}")
 





























