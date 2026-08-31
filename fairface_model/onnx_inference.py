# Copyright 2025 Yakhyokhuja Valikhujaev
# Author: Yakhyokhuja Valikhujaev
# GitHub: https://github.com/yakhyo

import argparse

import cv2
import numpy as np
from uniface.detection import RetinaFace
from uniface.face_utils import face_alignment

from models.predictor import FairFace


def draw_results(image: np.ndarray, bbox: np.ndarray, result: dict) -> None:
    """Draw bounding box and predictions on image."""
    x1, y1, x2, y2 = map(int, bbox[:4])
    cv2.rectangle(image, (x1, y1), (x2, y2), (0, 255, 0), 2)

    # Get predictions with confidence
    race = result["race"]
    race_conf = result["race_scores"][race] * 100
    gender = result["gender"]
    gender_conf = result["gender_scores"][gender] * 100
    age = result["age"]
    age_conf = result["age_scores"][age] * 100

    text_lines = [
        f"Race: {race} ({race_conf:.1f}%)",
        f"Gender: {gender} ({gender_conf:.1f}%)",
        f"Age: {age} ({age_conf:.1f}%)",
    ]

    # Draw text with background
    text_y = y1 - 10
    for i, text in enumerate(reversed(text_lines)):
        text_size = cv2.getTextSize(text, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 2)[0]
        text_y_pos = text_y - (i * 25)

        # Background rectangle
        cv2.rectangle(
            image,
            (x1, text_y_pos - text_size[1] - 5),
            (x1 + text_size[0] + 5, text_y_pos + 5),
            (0, 0, 0),
            -1,
        )
        # Text
        cv2.putText(
            image,
            text,
            (x1, text_y_pos),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.5,
            (255, 255, 255),
            2,
        )


def run_image(image_path: str, model_path: str, output_path: str = None):
    """Run inference on a single image."""
    model = FairFace(model_path=model_path)
    detector = RetinaFace()

    image = cv2.imread(image_path)
    if image is None:
        print(f"Error: Could not load image from {image_path}")
        return

    faces = detector.detect(image)

    if faces:
        print(f"Detected {len(faces)} face(s)")
        for face in faces:
            bbox = face.bbox[:4]
            landmarks = face.landmarks
            aligned_face, _ = face_alignment(image, landmarks, image_size=224)

            result = model.predict(aligned_face)
            draw_results(image, bbox, result)

            print(
                f"Gender: {result['gender']}, Age: {result['age']}, Race: {result['race']}"
            )
    else:
        print("No face detected")

    if output_path:
        cv2.imwrite(output_path, image)
        print(f"Result saved to {output_path}")
    else:
        cv2.imshow("FairFace Result", image)
        cv2.waitKey(0)
        cv2.destroyAllWindows()


def run_webcam(model_path: str, camera_id: int = 0):
    """Run inference on webcam stream."""
    model = FairFace(model_path=model_path)
    detector = RetinaFace(conf_thresh=0.5, nms_thresh=0.4)

    cap = cv2.VideoCapture(camera_id)
    if not cap.isOpened():
        print(f"Error: Could not open camera {camera_id}")
        return

    print("Press 'q' to quit")

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        faces = detector.detect(frame)

        for face in faces:
            bbox = face.bbox[:4]
            landmarks = face.landmarks
            aligned_face, _ = face_alignment(frame, landmarks, image_size=224)

            result = model.predict(aligned_face)
            draw_results(frame, bbox, result)

        cv2.imshow("FairFace Webcam", frame)

        if cv2.waitKey(1) & 0xFF == ord("q"):
            break

    cap.release()
    cv2.destroyAllWindows()


def main():
    parser = argparse.ArgumentParser(description="FairFace ONNX Inference")
    parser.add_argument(
        "--source",
        type=str,
        default="0",
        help="Image path or camera ID (default: 0 for webcam)",
    )
    parser.add_argument(
        "--model", type=str, default="weights/fairface.onnx", help="Path to ONNX model"
    )
    parser.add_argument(
        "--output",
        type=str,
        default=None,
        help="Output image path (optional, for image mode)",
    )

    args = parser.parse_args()

    if args.source.isdigit():
        run_webcam(model_path=args.model, camera_id=int(args.source))
    else:
        run_image(
            image_path=args.source, model_path=args.model, output_path=args.output
        )


if __name__ == "__main__":
    main()
