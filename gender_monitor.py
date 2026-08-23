import cv2
from ultralytics import YOLO
from deepface import DeepFace
 
VIDEO_PATH = "close_range_crowd.mp4"
GENDER_EVERY_N_FRAMES = 20
WOMAN_THRESHOLD = 35
 
# Only trust a detection when the person's box center falls within this
# horizontal band of the frame width (0.0-1.0) -- avoids edge-of-frame,
# partial-face (forehead-only) readings that cause flickering.
CENTER_BAND_MIN = 0.25
CENTER_BAND_MAX = 0.75
 
# Also require the box to take up a decent chunk of frame height,
# so we're not reading a tiny/partial figure near the edge.
MIN_BOX_HEIGHT_RATIO = 0.35
 
model = YOLO("yolov8n.pt")
cap = cv2.VideoCapture(VIDEO_PATH)
 
frame_count = 0
last_gender = "Detecting..."
last_conf = 0
 
print("Running. Press 'q' to quit.")
 
while cap.isOpened():
    ret, frame = cap.read()
    if not ret:
        break
 
    frame_h, frame_w = frame.shape[:2]
    results = model(frame, classes=[0], verbose=False)
 
    if len(results[0].boxes) > 0:
        boxes = results[0].boxes.xyxy.tolist()
        areas = [(b[2] - b[0]) * (b[3] - b[1]) for b in boxes]
        biggest_idx = areas.index(max(areas))
        x1, y1, x2, y2 = map(int, boxes[biggest_idx])
 
        crop = frame[y1:y2, x1:x2]
 
        box_center_x_ratio = ((x1 + x2) / 2) / frame_w
        box_height_ratio = (y2 - y1) / frame_h
        is_well_positioned = (
            CENTER_BAND_MIN <= box_center_x_ratio <= CENTER_BAND_MAX
            and box_height_ratio >= MIN_BOX_HEIGHT_RATIO
        )
 
        if (frame_count % GENDER_EVERY_N_FRAMES == 0
                and crop.size > 0
                and is_well_positioned):
            try:
                result = DeepFace.analyze(
                    img_path=crop,
                    actions=["gender"],
                    enforce_detection=False,
                    detector_backend="mtcnn"
                )
 
                face_conf = result[0].get('face_confidence', 0)
                woman_score = result[0]['gender'].get('Woman', 0)
                man_score = result[0]['gender'].get('Man', 0)
 
                if face_conf > 0.85:
                    if woman_score >= WOMAN_THRESHOLD:
                        last_gender = "Woman"
                        last_conf = woman_score
                    else:
                        last_gender = "Man"
                        last_conf = man_score
            except Exception:
                pass
 
        color = (255, 0, 255) if last_gender == "Woman" else (255, 200, 0)
        cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
        cv2.putText(frame, f"{last_gender} ({last_conf:.0f}%)", (x1, y1 - 10),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.8, color, 2)
 
    frame_count += 1
    cv2.imshow("Gender Detection - Close Range", frame)
    if cv2.waitKey(50) & 0xFF == ord('q'):
        break
 
cap.release()
cv2.destroyAllWindows()
 