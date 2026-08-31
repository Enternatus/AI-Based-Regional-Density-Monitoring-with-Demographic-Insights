# Copyright 2025 Yakhyokhuja Valikhujaev
# Author: Yakhyokhuja Valikhujaev
# GitHub: https://github.com/yakhyo

import argparse

import cv2
import numpy as np
import torch
from uniface.detection import RetinaFace
from uniface.face_utils import face_alignment

from models.fairface import FairFace

# Label definitions
RACE_LABELS = [
    "White",
    "Black",
    "Latino_Hispanic",
    "East Asian",
    "Southeast Asian",
    "Indian",
    "Middle Eastern",
]
GENDER_LABELS = ["Male", "Female"]
AGE_LABELS = ["0-2", "3-9", "10-19", "20-29", "30-39", "40-49", "50-59", "60-69", "70+"]


def preprocess(image: np.ndarray, input_size: tuple = (224, 224)) -> torch.Tensor:
    """Preprocess image for inference."""
    image = cv2.resize(image, input_size)
    image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    image = image.astype(np.float32) / 255.0

    # ImageNet normalization
    mean = np.array([0.485, 0.456, 0.406], dtype=np.float32)
    std = np.array([0.229, 0.224, 0.225], dtype=np.float32)
    image = (image - mean) / std

    image = np.transpose(image, (2, 0, 1))
    tensor = torch.from_numpy(image).unsqueeze(0)
    return tensor


def predict(model: FairFace, image: np.ndarray) -> dict:
    """Run prediction and return results."""
    input_tensor = preprocess(image)

    with torch.no_grad():
        race_out, gender_out, age_out = model(input_tensor)

    race_probs = torch.softmax(race_out, dim=1).numpy()[0]
    gender_probs = torch.softmax(gender_out, dim=1).numpy()[0]
    age_probs = torch.softmax(age_out, dim=1).numpy()[0]

    race_idx = int(np.argmax(race_probs))
    gender_idx = int(np.argmax(gender_probs))
    age_idx = int(np.argmax(age_probs))

    return {
        "race": RACE_LABELS[race_idx],
        "race_scores": {
            label: float(score) for label, score in zip(RACE_LABELS, race_probs)
        },
        "gender": GENDER_LABELS[gender_idx],
        "gender_scores": {
            label: float(score) for label, score in zip(GENDER_LABELS, gender_probs)
        },
        "age": AGE_LABELS[age_idx],
        "age_scores": {
            label: float(score) for label, score in zip(AGE_LABELS, age_probs)
        },
    }


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


def load_model(model_path: str) -> FairFace:
    """Load PyTorch model."""
    device = torch.device("cpu")
    model = FairFace()
    state_dict = torch.load(model_path, map_location=device, weights_only=True)
    model.load_state_dict(state_dict)
    model.eval()
    print(f"Successfully loaded model from {model_path}")
    return model


def run_image(image_path: str, model_path: str, output_path: str = None):
    """Run inference on a single image."""
    model = load_model(model_path)
    detector = RetinaFace(conf_thresh=0.5, nms_thresh=0.4)

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

            result = predict(model, aligned_face)
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
    model = load_model(model_path)
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

            result = predict(model, aligned_face)
            draw_results(frame, bbox, result)

        cv2.imshow("FairFace Webcam", frame)

        if cv2.waitKey(1) & 0xFF == ord("q"):
            break

    cap.release()
    cv2.destroyAllWindows()


def main():
    parser = argparse.ArgumentParser(description="FairFace PyTorch Inference")
    parser.add_argument(
        "--source",
        type=str,
        default="0",
        help="Image path or camera ID (default: 0 for webcam)",
    )
    parser.add_argument(
        "--model",
        type=str,
        default="weights/res34_fair_align_multi_7_20190809.pt",
        help="Path to PyTorch model",
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
