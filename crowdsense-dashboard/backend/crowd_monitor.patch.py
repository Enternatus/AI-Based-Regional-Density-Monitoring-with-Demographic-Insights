"""
Patch for crowd_monitor.py — adds a density snapshot write.

This is a diff description, not a script to run. Apply these changes to
your actual crowd_monitor.py by hand (it's a small, surgical addition —
running this file does nothing).

--- WHY ---
Right now crowd_monitor.py only draws region counts onto the cv2 window
via cv2.putText/imshow. Nothing is persisted, so the FastAPI backend has
no live density to read. This patch writes a small JSON snapshot once per
frame so /api/regions/density can serve it.

--- WHAT TO CHANGE ---

1. Add these two imports near the top, alongside the existing ones:

    import time
    from pathlib import Path

2. Add this constant near REGIONS_FILE:

    DENSITY_SNAPSHOT_FILE = "density_snapshot.json"
    SNAPSHOT_EVERY_N_FRAMES = 5  # writing every frame is unnecessary I/O

3. Inside main(), after this existing block:

    counts = {name: 0 for name in regions}

   ...and after the loop that populates `counts` from detected boxes has
   run (i.e. right after the `for box in results[0].boxes.xyxy:` loop
   finishes, same indentation level as the `total = sum(counts.values())`
   line that already exists a few lines down), add:

    frame_index = int(cap.get(cv2.CAP_PROP_POS_FRAMES))
    if frame_index % SNAPSHOT_EVERY_N_FRAMES == 0:
        snapshot = {
            "updated_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
            "frame_index": frame_index,
            "regions": [
                {"region_id": name, "name": name, "count": count}
                for name, count in counts.items()
            ],
        }
        Path(DENSITY_SNAPSHOT_FILE).write_text(json.dumps(snapshot))

   Full context of where this lands (existing code shown for orientation,
   new lines marked with '# <-- NEW'):

    counts = {name: 0 for name in regions}

    for box in results[0].boxes.xyxy:
        x1, y1, x2, y2 = box.tolist()
        cx, cy = (x1 + x2) / 2, (y1 + y2) / 2
        region = get_region(cx, cy, regions)
        if region:
            counts[region] += 1
            cv2.circle(frame, (int(cx), int(cy)), 4, (255, 255, 255), -1)

    frame_index = int(cap.get(cv2.CAP_PROP_POS_FRAMES))          # <-- NEW
    if frame_index % SNAPSHOT_EVERY_N_FRAMES == 0:                # <-- NEW
        snapshot = {                                              # <-- NEW
            "updated_at": time.strftime("%Y-%m-%dT%H:%M:%S"),     # <-- NEW
            "frame_index": frame_index,                            # <-- NEW
            "regions": [                                           # <-- NEW
                {"region_id": name, "name": name, "count": count}  # <-- NEW
                for name, count in counts.items()                  # <-- NEW
            ],                                                     # <-- NEW
        }                                                          # <-- NEW
        Path(DENSITY_SNAPSHOT_FILE).write_text(json.dumps(snapshot))  # <-- NEW

    # draw region polygons colored by density level
    for name, poly in regions.items():
        ...

That's the entire patch — everything else in crowd_monitor.py is
unchanged. Once applied, running crowd_monitor.py as usual will also keep
density_snapshot.json up to date in the repo root, which
backend/main.py's /api/regions/density endpoint reads directly.
"""
