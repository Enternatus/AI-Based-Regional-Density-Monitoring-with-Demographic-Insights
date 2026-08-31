import cv2
import os

VIDEO_PATH = "my_recording.mp4"   # <-- set this to your screen recording's filename
OUTPUT_DIR = "recording_frames"
FRAME_INTERVAL = 5   # save every 5th frame -- lower this for more frames, raise for fewer

os.makedirs(OUTPUT_DIR, exist_ok=True)
cap = cv2.VideoCapture(VIDEO_PATH)

if not cap.isOpened():
    print(f"Could not open {VIDEO_PATH} -- check the filename/path.")
else:
    frame_idx = 0
    saved = 0
    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break
        if frame_idx % FRAME_INTERVAL == 0:
            cv2.imwrite(f"{OUTPUT_DIR}/frame_{saved:04d}.jpg", frame)
            saved += 1
        frame_idx += 1

    cap.release()
    print(f"Saved {saved} frames to {OUTPUT_DIR}/")