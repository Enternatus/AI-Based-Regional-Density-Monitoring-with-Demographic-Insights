from deepface import DeepFace
import cv2

# Grab a single frame from your video to test on
cap = cv2.VideoCapture("sample_crowd.mp4")
ret, frame = cap.read()
cap.release()

if not ret:
    print("Could not read frame.")
else:
    cv2.imwrite("test_frame.jpg", frame)
    print("Saved test_frame.jpg, analyzing...")

    try:
        result = DeepFace.analyze(
            img_path="test_frame.jpg",
            actions=["gender"],
            enforce_detection=False  # don't crash if face isn't perfectly clear
        )
        print(result)
    except Exception as e:
        print("DeepFace error:", e)