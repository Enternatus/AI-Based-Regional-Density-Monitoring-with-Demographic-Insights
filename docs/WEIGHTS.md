# Model weights (manual)

This repository requires the FairFace ONNX model for attribute prediction. This document describes where to place model weights and recommended options.

Required files and paths

- FairFace ONNX: place the file at `fairface_model/weights/fairface.onnx`

Notes

- This repo does not include the FairFace ONNX weights. Download them manually from a trusted source (see the FairFace repo or an ONNX export repository) and place them at the path above.
- The YOLOv8 `yolov8n.pt` model will be auto-downloaded by `ultralytics` if not present, but some users prefer to provide their own weights in the repo root as `yolov8n.pt` or configure the path in the scripts.

Verifying the file

- If a checksum is provided by your source, verify the file with:

  ```bash
  sha256sum fairface_model/weights/fairface.onnx
  # compare the output with the checksum given by the model provider
  ```

Python environment

- Use a recent Python (e.g., 3.10+). Install dependencies:

  ```bash
  python -m venv venv
  source venv/bin/activate
  pip install -r requirements.txt
  ```

Optional: GPU runtime

- For faster inference you can use an ONNX runtime with GPU support (onnxruntime-gpu). Installation and drivers vary by platform — consult ONNX Runtime docs.

If you need an automated helper to download the weights, please add a signed download source or let me know and I can create a helper script, but by default this file intentionally documents manual placement to avoid bundling third-party models into the repo.