"""
Standalone, read-only: does NOT touch gender_monitor.py or its pipeline.

Runs the existing attribute_recognition/ResNet18_best_model.pth on every
crop in debug_crops/ and prints ALL labels it outputs (not just gender),
so we can see what's actually available for clothing/hair before wiring
anything into the real pipeline.

Run with: python inspect_attributes.py
"""

import sys
import os

sys.path.insert(0, "attribute_recognition")

import torch
from inference import perform_inference

MODEL_PATH = "attribute_recognition/ResNet18_best_model.pth"
CROPS_DIR = "debug_crops"

print("Loading model...")
model = torch.load(MODEL_PATH, weights_only=False, map_location="cpu")

crops = sorted(f for f in os.listdir(CROPS_DIR) if f.endswith(".jpg"))
if not crops:
    print(f"No .jpg crops found in {CROPS_DIR}/. Run debug_crops.py first.")

all_label_names = set()

for fname in crops:
    path = os.path.join(CROPS_DIR, fname)
    results = perform_inference(model, path)
    labels = list(results["labels"])
    all_label_names.update(labels)

    print(f"\n{fname}")
    print(f"  ALL labels returned: {labels}")

    # Group by rough category prefix if the label names look like
    # "Category-Value" (e.g. "Gender-Female", "UpperBodyColor-Red") --
    # this only groups things, it doesn't filter or drop anything.
    grouped = {}
    for label in labels:
        prefix = label.split("-")[0] if "-" in label else "(ungrouped)"
        grouped.setdefault(prefix, []).append(label)
    for prefix, vals in grouped.items():
        print(f"    {prefix}: {vals}")

print("\n" + "=" * 50)
print(f"Every distinct label seen across all crops ({len(all_label_names)} total):")
for label in sorted(all_label_names):
    print(f"  {label}")