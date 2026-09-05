"""
Patch for gender_monitor.py — adds clothing_color and height_bucket to
every person record.

This is a diff description, not a script to run. Apply these changes to
your actual gender_monitor.py by hand.

--- WHY ---
Both new fields are cheap (no extra ML model, no extra FairFace calls) and
can be computed every frame a track is visible, independent of the
expensive gate/quality logic that already governs gender/age/race. That
keeps them decoupled from FairFace's settle/lock timing — they update
every frame a good bbox exists, rather than waiting on a settled face read.

--- WHAT TO CHANGE ---

1. Add this helper function near the other helpers (e.g. right after
   sharpness_score / pose_offset):

    def dominant_clothing_color(crop_bgr):
        \"\"\"Rough dominant-color read on the torso band of a person crop
        (roughly the middle third vertically, avoiding head and legs).
        Returns one of a small fixed palette, or None if the crop is too
        small to sample.\"\"\"
        h, w = crop_bgr.shape[:2]
        if h < 20 or w < 10:
            return None
        torso = crop_bgr[int(h * 0.30):int(h * 0.65), :]
        if torso.size == 0:
            return None
        avg_bgr = torso.reshape(-1, 3).mean(axis=0)
        b, g, r = avg_bgr
        palette = {
            "red": (196, 60, 55), "blue": (58, 92, 168), "black": (30, 30, 30),
            "white": (235, 235, 235), "green": (63, 130, 78), "yellow": (214, 178, 46),
            "grey": (128, 130, 135), "orange": (214, 122, 46),
        }
        # nearest palette color by simple Euclidean distance in BGR space
        best_name, best_dist = None, float("inf")
        for name, (pr, pg, pb) in palette.items():
            dist = (r - pr) ** 2 + (g - pg) ** 2 + (b - pb) ** 2
            if dist < best_dist:
                best_name, best_dist = name, dist
        return best_name


    def height_bucket_from_ratio(box_height_ratio):
        \"\"\"Buckets the same box_height_ratio the script already computes
        for the well-positioned check -- no new geometry needed. These
        cutoffs are starting points; tune against your own footage the
        same way MIN_SHARPNESS etc. were tuned.\"\"\"
        if box_height_ratio >= 0.75:
            return "tall"
        elif box_height_ratio >= 0.50:
            return "average"
        else:
            return "short"

2. Inside the per-track record initializer (the `if track_id not in
   person_records:` block), add two new keys alongside the existing ones:

        "gender": "Detecting...",
        "gender_conf": 0,
        "age": "",
        "race": "",
        "clothing_color": None,     # <-- NEW
        "height_bucket": None,      # <-- NEW
        "first_seen_frame": frame_count,
        ...

3. Right after this existing line (which already computes
   box_height_ratio for the positioning check):

        box_height_ratio = (y2 - y1) / frame_h

   add:

        record["height_bucket"] = height_bucket_from_ratio(box_height_ratio)  # <-- NEW
        color = dominant_clothing_color(crop)                                  # <-- NEW
        if color:                                                              # <-- NEW
            record["clothing_color"] = color                                   # <-- NEW

   This runs every frame regardless of is_well_positioned/needs_detection,
   so it updates continuously rather than only on the frames FairFace
   happens to run -- clothing color and height don't need the same
   settle/lock gating gender/age/race need, since there's no
   ambiguous-class smoothing problem to solve here.

That's the entire patch. Both fields end up in the same person_records.json
each track already writes to, so no changes are needed to the file-saving
code at the bottom of the script.
"""
