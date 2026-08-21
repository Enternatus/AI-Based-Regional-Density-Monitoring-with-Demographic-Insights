import cv2
import json
 
VIDEO_PATH = "sample_crowd.mp4"   # <-- change to your video file
OUTPUT_FILE = "regions.json"
 
current_points = []
regions = {}
frame_display = None
frame_original = None
 
 
def mouse_callback(event, x, y, flags, param):
    global current_points, frame_display
    if event == cv2.EVENT_LBUTTONDOWN:
        current_points.append([x, y])
        frame_display = frame_original.copy()
        redraw()
 
 
def redraw():
    global frame_display
    frame_display = frame_original.copy()
    # draw already-saved regions
    for name, poly in regions.items():
        pts = [tuple(p) for p in poly]
        for i in range(len(pts)):
            cv2.line(frame_display, pts[i], pts[(i + 1) % len(pts)], (0, 255, 0), 2)
        if pts:
            cv2.putText(frame_display, name, pts[0], cv2.FONT_HERSHEY_SIMPLEX,
                        0.7, (0, 255, 0), 2)
    # draw current in-progress region
    for i, p in enumerate(current_points):
        cv2.circle(frame_display, tuple(p), 4, (0, 0, 255), -1)
        if i > 0:
            cv2.line(frame_display, tuple(current_points[i - 1]), tuple(p), (0, 0, 255), 2)
 
 
def main():
    global frame_original, frame_display, current_points
 
    cap = cv2.VideoCapture(VIDEO_PATH)
    ret, frame = cap.read()
    cap.release()
    if not ret:
        print(f"Could not read a frame from {VIDEO_PATH}. Check the path.")
        return
 
    frame_original = frame.copy()
    frame_display = frame.copy()
 
    cv2.namedWindow("Define Regions")
    cv2.setMouseCallback("Define Regions", mouse_callback)
 
    print("Left-click to add polygon points. Press 'n' to save the region and name it.")
    print("Press 'q' to quit and save all regions to regions.json.")
 
    while True:
        cv2.imshow("Define Regions", frame_display)
        key = cv2.waitKey(20) & 0xFF
 
        if key == ord('n'):
            if len(current_points) >= 3:
                name = input("Name this region (e.g. entrance): ").strip()
                regions[name] = current_points.copy()
                current_points = []
                redraw()
            else:
                print("Need at least 3 points to make a region.")
 
        elif key == ord('q'):
            break
 
    cv2.destroyAllWindows()
 
    with open(OUTPUT_FILE, "w") as f:
        json.dump(regions, f, indent=2)
 
    print(f"Saved {len(regions)} region(s) to {OUTPUT_FILE}: {list(regions.keys())}")
 
 
if __name__ == "__main__":
    main()
 