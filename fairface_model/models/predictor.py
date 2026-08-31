# Copyright 2025 Yakhyokhuja Valikhujaev
# Author: Yakhyokhuja Valikhujaev
# GitHub: https://github.com/yakhyo

from typing import Dict, List, Optional, Tuple, Union

import cv2
import numpy as np
import onnxruntime as ort

__all__ = ["FairFace", "RACE_LABELS", "GENDER_LABELS", "AGE_LABELS"]

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


class FairFace:
    """FairFace attribute prediction model using ONNX Runtime.

    This class predicts race (7 categories), gender (2 categories), and age (9 groups)
    from face images. It requires a bounding box to locate the face.

    Args:
        model_path (str): Path to the ONNX model file.
        input_size (Tuple[int, int]): Input size (height, width). Defaults to (224, 224).
    """

    def __init__(
        self,
        model_path: str = "fairface.onnx",
        input_size: Tuple[int, int] = (224, 224),
    ) -> None:
        """Initializes the FairFace prediction model.

        Args:
            model_path (str): Path to the ONNX model file.
            input_size (Tuple[int, int]): Input size (height, width).
        """
        self.model_path = model_path
        self.input_size = input_size
        self._initialize_model()

    def _initialize_model(self) -> None:
        """Initializes the ONNX model and creates an inference session."""
        try:
            self.session = ort.InferenceSession(
                self.model_path, providers=["CPUExecutionProvider"]
            )

            # Get model input/output details
            input_meta = self.session.get_inputs()[0]
            self.input_name = input_meta.name
            self.output_names = [output.name for output in self.session.get_outputs()]

            print(f"Successfully initialized FairFace model from {self.model_path}")
            print(f"Input size: {self.input_size}")

        except Exception as e:
            raise RuntimeError(f"Failed to initialize FairFace model: {e}") from e

    def preprocess(
        self, image: np.ndarray, bbox: Optional[Union[List, np.ndarray]] = None
    ) -> np.ndarray:
        """Preprocesses the face image for inference.

        Args:
            image (np.ndarray): The input image in BGR format.
            bbox (Optional[Union[List, np.ndarray]]): Face bounding box [x1, y1, x2, y2].
                If None, uses the entire image.

        Returns:
            np.ndarray: The preprocessed image blob ready for inference.
        """
        # Crop face if bbox provided
        if bbox is not None:
            bbox = np.asarray(bbox, dtype=int)
            x1, y1, x2, y2 = bbox[:4]

            # Add padding
            w, h = x2 - x1, y2 - y1
            padding = 0.25
            x_pad = int(w * padding)
            y_pad = int(h * padding)

            x1 = max(0, x1 - x_pad)
            y1 = max(0, y1 - y_pad)
            x2 = min(image.shape[1], x2 + x_pad)
            y2 = min(image.shape[0], y2 + y_pad)

            image = image[y1:y2, x1:x2]

        # Resize
        image = cv2.resize(image, self.input_size[::-1])

        # Convert BGR to RGB
        image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)

        # Normalize
        image = image.astype(np.float32) / 255.0
        mean = np.array([0.485, 0.456, 0.406], dtype=np.float32)
        std = np.array([0.229, 0.224, 0.225], dtype=np.float32)
        image = (image - mean) / std

        # Transpose to CHW format and add batch dimension
        image = np.transpose(image, (2, 0, 1))
        image = np.expand_dims(image, axis=0)

        return image

    def postprocess(
        self, prediction: Tuple[np.ndarray, np.ndarray, np.ndarray]
    ) -> Dict[str, any]:
        """Processes the raw model output to extract race, gender, and age.

        Args:
            prediction (Tuple[np.ndarray, np.ndarray, np.ndarray]): Raw outputs from model
                (race_logits, gender_logits, age_logits).

        Returns:
            Dict containing:
                - race: predicted race label
                - race_scores: probability scores for all race categories
                - gender: predicted gender label
                - gender_scores: probability scores for both genders
                - age: predicted age group
                - age_scores: probability scores for all age groups
        """
        race_logits, gender_logits, age_logits = prediction

        # Apply softmax
        race_probs = self._softmax(race_logits[0])
        gender_probs = self._softmax(gender_logits[0])
        age_probs = self._softmax(age_logits[0])

        # Get predictions
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

    def predict(
        self, image: np.ndarray, bbox: Optional[Union[List, np.ndarray]] = None
    ) -> Dict[str, any]:
        """Predicts race, gender, and age for a face.

        Args:
            image (np.ndarray): The input image in BGR format.
            bbox (Optional[Union[List, np.ndarray]]): Face bounding box [x1, y1, x2, y2].
                If None, uses the entire image.

        Returns:
            Dict containing predicted attributes and confidence scores.
        """
        # Preprocess
        input_blob = self.preprocess(image, bbox)

        # Inference
        outputs = self.session.run(self.output_names, {self.input_name: input_blob})

        # Postprocess
        result = self.postprocess(outputs)

        return result

    @staticmethod
    def _softmax(x: np.ndarray) -> np.ndarray:
        """Compute softmax values."""
        exp_x = np.exp(x - np.max(x))
        return exp_x / np.sum(exp_x)
