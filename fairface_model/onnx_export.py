# Copyright 2025 Yakhyokhuja Valikhujaev
# Author: Yakhyokhuja Valikhujaev
# GitHub: https://github.com/yakhyo

import argparse

import numpy as np
import onnx
import onnxruntime as ort
import torch

from models.fairface import FairFace


def export_to_onnx(model_path, output_path, input_size=(224, 224), opset_version=12):
    """Export PyTorch model to ONNX format."""
    device = torch.device("cpu")

    # Load model
    model = FairFace()
    state_dict = torch.load(model_path, map_location=device)
    model.load_state_dict(state_dict)
    model.eval()

    # Create dummy input
    dummy_input = torch.randn(1, 3, input_size[0], input_size[1], device=device)

    # Export to ONNX
    torch.onnx.export(
        model,
        dummy_input,
        output_path,
        export_params=True,
        opset_version=opset_version,
        do_constant_folding=True,
        input_names=["input"],
        output_names=["race_output", "gender_output", "age_output"],
        dynamic_axes={
            "input": {0: "batch_size"},
            "race_output": {0: "batch_size"},
            "gender_output": {0: "batch_size"},
            "age_output": {0: "batch_size"},
        },
    )

    print(f"Exported to: {output_path}")

    # Verify
    onnx_model = onnx.load(output_path)
    onnx.checker.check_model(onnx_model)

    # Test
    ort_session = ort.InferenceSession(output_path, providers=["CPUExecutionProvider"])
    ort_outputs = ort_session.run(None, {"input": dummy_input.numpy()})

    with torch.no_grad():
        torch_outputs = model(dummy_input)

    # Compare outputs
    for i, (torch_out, onnx_out) in enumerate(zip(torch_outputs, ort_outputs)):
        max_diff = np.abs(torch_out.numpy() - onnx_out).max()
        print(f"Output {i} max diff: {max_diff:.6f}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Export FairFace model to ONNX format")
    parser.add_argument(
        "--model",
        type=str,
        default="weights/res34_fair_align_multi_7_20190809.pt",
        help="Path to PyTorch model checkpoint",
    )
    parser.add_argument(
        "--output",
        type=str,
        default="weights/fairface.onnx",
        help="Output path for ONNX model",
    )
    parser.add_argument(
        "--input-size",
        type=int,
        nargs=2,
        default=[224, 224],
        help="Input image size (height width)",
    )
    parser.add_argument("--opset", type=int, default=17, help="ONNX opset version")

    args = parser.parse_args()

    export_to_onnx(args.model, args.output, tuple(args.input_size), args.opset)
