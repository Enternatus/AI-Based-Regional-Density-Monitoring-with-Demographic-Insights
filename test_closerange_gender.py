import sys
sys.path.insert(0, "attribute_recognition")
import torch
from inference import perform_inference

model = torch.load("attribute_recognition/ResNet18_best_model.pth", weights_only=False, map_location="cpu")
results = perform_inference(model, "debug_crops_closerange/person_best.jpg")
print(results)