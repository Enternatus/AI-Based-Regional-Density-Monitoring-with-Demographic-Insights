from ultralytics import YOLO
from deepface import DeepFace
import cv2

model = YOLO("yolov8n.pt")
cap = cv2.VideoCapture("sample_crowd.mp4")
ret, frame = cap.read()
cap.release()

results = model(frame, classes=[0])

for i, box in enumerate(results[0].boxes.xyxy):
    x1, y1, x2, y2 = map(int, box.tolist())
    crop = frame[y1:y2, x1:x2]

    if crop.size == 0:
        continue

    try:
        result = DeepFace.analyze(
            img_path=crop,
            actions=["gender"],
            enforce_detection=False
        )
        gender = result[0]['dominant_gender']
        conf = result[0]['gender'][gender]
        print(f"Person {i}: {gender} ({conf:.1f}%)")
    except Exception as e:
        print(f"Person {i}: error - {e}")