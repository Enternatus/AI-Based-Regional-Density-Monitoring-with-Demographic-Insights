import sys
sys.path.insert(0, "attribute_recognition")

import torch
import os
from inference import perform_inference

MODEL_PATH = "attribute_recognition/ResNet18_best_model.pth"
CROPS_DIR = "debug_crops"

print("Loading model...")
model = torch.load(MODEL_PATH, weights_only=False, map_location="cpu")

for fname in sorted(os.listdir(CROPS_DIR)):
    if fname.endswith(".jpg"):
        path = os.path.join(CROPS_DIR, fname)
        results = perform_inference(model, path)
        gender = "Female" if "Gender-Female" in results["labels"] else "Male"
        print(f"{fname}: {gender} | all labels: {list(results['labels'])}")