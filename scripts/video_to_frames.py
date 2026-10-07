import argparse
import glob
import os
import sys
import time
import cv2


def find_latest_video(search_dirs=None):
    """Find the newest video file across standard Videos directories."""
    if search_dirs is None:
        search_dirs = [
            os.path.expanduser(r"~\Videos"),
            r"C:\Users\santa\Videos",
            r"C:\Users\santa\OneDrive\Videos",
        ]
    exts = ("*.mp4", "*.mkv", "*.avi", "*.mov", "*.wmv")
    candidates = []
    for d in search_dirs:
        if os.path.isdir(d):
            for ext in exts:
                for f in glob.glob(os.path.join(d, ext)):
                    try:
                        candidates.append((os.path.getmtime(f), f))
                    except OSError:
                        pass
                for f in glob.glob(os.path.join(d, "**", ext), recursive=False):
                    try:
                        candidates.append((os.path.getmtime(f), f))
                    except OSError:
                        pass
    if not candidates:
        return None
    candidates.sort(key=lambda x: x[0], reverse=True)
    return candidates[0][1]


def main():
    parser = argparse.ArgumentParser(
        description="Convert video to sequential image frames."
    )
    parser.add_argument(
        "--video", "-v",
        default=None,
        help="Path to video file (defaults to newest video in Videos folder)"
    )
    parser.add_argument(
        "--output", "-o",
        default="extracted_frames",
        help="Directory to save extracted frames (default: extracted_frames)"
    )
    parser.add_argument(
        "--every-n", "-n",
        type=int,
        default=1,
        help="Extract every N-th frame (default: 1, extracts all frames)"
    )
    parser.add_argument(
        "--max-frames", "-m",
        type=int,
        default=None,
        help="Maximum number of frames to save (default: all)"
    )
    parser.add_argument(
        "--jpeg-quality", "-q",
        type=int,
        default=95,
        help="JPEG quality 1-100 (default: 95)"
    )

    args = parser.parse_args()

    video_path = args.video
    if not video_path:
        video_path = find_latest_video()
        if not video_path:
            print("Error: No video specified and no video found in Videos folder.")
            sys.exit(1)
        print(f"Auto-selected latest video: {video_path}")

    if not os.path.isfile(video_path):
        print(f"Error: Video file not found: {video_path}")
        sys.exit(1)

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        print(f"Error: Could not open video: {video_path}")
        sys.exit(1)

    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    dur_s = total_frames / max(1.0, fps)

    os.makedirs(args.output, exist_ok=True)

    print(f"Source video:     {video_path}")
    print(f"Resolution:       {w}x{h}")
    print(f"FPS:              {fps:.2f}")
    print(f"Total frames:     {total_frames} (~{dur_s:.1f}s)")
    print(f"Step interval:    every {args.every_n} frame(s)")
    print(f"Output directory: {os.path.abspath(args.output)}")
    print("-" * 50)

    frame_idx = 0
    saved_count = 0
    encode_param = [int(cv2.IMWRITE_JPEG_QUALITY), args.jpeg_quality]
    t0 = time.time()

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        if frame_idx % args.every_n == 0:
            out_filename = os.path.join(args.output, f"frame_{saved_count:05d}.jpg")
            cv2.imwrite(out_filename, frame, encode_param)
            saved_count += 1

            if saved_count % 100 == 0:
                elapsed = time.time() - t0
                pct = (frame_idx / max(1, total_frames)) * 100
                speed = saved_count / max(0.001, elapsed)
                print(f"Saved {saved_count} frames ({pct:.1f}%) - {speed:.1f} fps")

            if args.max_frames and saved_count >= args.max_frames:
                print(f"Reached maximum requested frames: {args.max_frames}")
                break

        frame_idx += 1

    cap.release()
    total_time = time.time() - t0
    print("-" * 50)
    print(f"Successfully extracted {saved_count} frames to '{args.output}' in {total_time:.1f}s ({saved_count/max(0.001, total_time):.1f} fps).")


if __name__ == "__main__":
    main()
