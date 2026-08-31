from ultralytics import YOLO
import cv2

model = YOLO("yolov8n.pt")
cap = cv2.VideoCapture("close_range_crowd.mp4")

while cap.isOpened():
    ret, frame = cap.read()
    if not ret:
        break
    results = model(frame, classes=[0])
    cv2.imshow("frame", results[0].plot())
    if cv2.waitKey(150) & 0xFF == ord('q'):
        break

cap.release()
cv2.destroyAllWindows()