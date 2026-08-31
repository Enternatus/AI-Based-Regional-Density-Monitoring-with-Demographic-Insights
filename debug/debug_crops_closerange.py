from ultralytics import YOLO
import cv2
import os

os.makedirs("debug_crops_closerange", exist_ok=True)

model = YOLO("yolov8n.pt")
cap = cv2.VideoCapture("close_range_crowd.mp4")

best_frame = None
best_box = None
best_area = 0
frame_idx = 0

while cap.isOpened():
    ret, frame = cap.read()
    if not ret:
        break

    results = model(frame, classes=[0], verbose=False)

    for box in results[0].boxes.xyxy:
        x1, y1, x2, y2 = box.tolist()
        area = (x2 - x1) * (y2 - y1)
        if area > best_area:
            best_area = area
            best_box = (int(x1), int(y1), int(x2), int(y2))
            best_frame = frame.copy()

    frame_idx += 1
    if frame_idx > 600:   # don't scan forever, cap it
        break

cap.release()

if best_frame is not None:
    x1, y1, x2, y2 = best_box
    crop = best_frame[y1:y2, x1:x2]
    cv2.imwrite("debug_crops_closerange/person_best.jpg", crop)
    print(f"Best crop size: {crop.shape[1]}x{crop.shape[0]} (found around frame area {best_area:.0f})")
else:
    print("No detections found in first 600 frames.")