# Weights & model files (scripts)

This file documents where to put model weights and other large files when working with this repository.

Manual placement (recommended)

- FairFace ONNX model: place at `fairface_model/weights/fairface.onnx`.

Why manual?

- Third-party model weights often have their own licenses and distribution constraints. This repository intentionally does not bundle FairFace weights. Download them from the FairFace project or a trusted ONNX-export source and place them under the path above.

Quick verification

- If your download source provides a checksum, verify it:

```bash
sha256sum fairface_model/weights/fairface.onnx
# compare the output with the checksum provided by the model source
```

Notes about YOLOv8

- Ultralytics' `YOLO("yolov8n.pt")` will auto-download the model on first run if the file is not present in the working directory. If you prefer to provide your own weights, place `yolov8n.pt` in the repository root or pass an explicit path to the script (scripts will be updated to support CLI options in a future change).

If you want an automated helper script added later

- I can add a small helper to download and verify the ONNX model automatically, but you asked for manual instructions — this keeps the repository free of third-party binaries unless you explicitly add them.