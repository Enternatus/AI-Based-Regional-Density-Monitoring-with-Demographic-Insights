from deepface import DeepFace

result = DeepFace.analyze(
    img_path="debug_crops_closerange/person_best.jpg",
    actions=["gender"],
    enforce_detection=False
)
print(result)