"""Detection + IoU tracker for static and slow-moving people.

ByteTrack (Ultralytics yolo.track) keeps new tracks unconfirmed until the
Kalman motion filter matches them across frames. Seated classroom students
have near-zero velocity and are often desk-occluded, so those tracks never
confirm and vanish from results[0].boxes.

This tracker treats every high-confidence detection as a real person and
associates IDs by IoU / centroid distance, so a still student keeps an ID.
"""

from __future__ import annotations

import math


def _iou(a, b):
    ax1, ay1, ax2, ay2 = a
    bx1, by1, bx2, by2 = b
    ix1, iy1 = max(ax1, bx1), max(ay1, by1)
    ix2, iy2 = min(ax2, bx2), min(ay2, by2)
    iw, ih = max(0.0, ix2 - ix1), max(0.0, iy2 - iy1)
    inter = iw * ih
    if inter <= 0:
        return 0.0
    area_a = max(0.0, ax2 - ax1) * max(0.0, ay2 - ay1)
    area_b = max(0.0, bx2 - bx1) * max(0.0, by2 - by1)
    union = area_a + area_b - inter
    return inter / union if union > 0 else 0.0


def _centroid(box):
    x1, y1, x2, y2 = box
    return ((x1 + x2) / 2.0, (y1 + y2) / 2.0)


def _centroid_dist(a, b):
    ac, bc = _centroid(a), _centroid(b)
    return math.hypot(ac[0] - bc[0], ac[1] - bc[1])


class IoUTracker:
    """Greedy IoU association. New detections are confirmed immediately."""

    def __init__(self, iou_threshold=0.3, max_age=45, centroid_max_frac=0.08):
        self.iou_threshold = iou_threshold
        self.max_age = max_age
        self.centroid_max_frac = centroid_max_frac
        self.next_id = 1
        self.tracks = {}  # id -> {box, age, hits}

    def update(self, detections, frame_wh=None):
        """detections: iterable of [x1, y1, x2, y2].

        Returns list of (track_id:int, box:list[float]).
        """
        dets = [list(map(float, d[:4])) for d in detections if d is not None]
        active_ids = list(self.tracks.keys())
        unmatched_tracks = set(active_ids)
        unmatched_dets = set(range(len(dets)))
        assignments = []

        pairs = []
        for tid in active_ids:
            tbox = self.tracks[tid]["box"]
            tw = max(1.0, tbox[2] - tbox[0])
            th = max(1.0, tbox[3] - tbox[1])
            max_cent = self.centroid_max_frac * math.hypot(tw, th)
            if frame_wh:
                max_cent = max(max_cent, 0.03 * max(frame_wh))
            for di, dbox in enumerate(dets):
                iou = _iou(tbox, dbox)
                dist = _centroid_dist(tbox, dbox)
                if iou >= self.iou_threshold or dist <= max_cent:
                    # Prefer IoU; centroid is fallback for tiny static jitter.
                    score = iou if iou >= self.iou_threshold else (0.15 - dist / max(1.0, max_cent))
                    pairs.append((score, iou, tid, di))

        pairs.sort(key=lambda p: p[0], reverse=True)
        used_t, used_d = set(), set()
        for _score, _iou_val, tid, di in pairs:
            if tid in used_t or di in used_d:
                continue
            used_t.add(tid)
            used_d.add(di)
            unmatched_tracks.discard(tid)
            unmatched_dets.discard(di)
            assignments.append((tid, di))

        for tid, di in assignments:
            tr = self.tracks[tid]
            tr["box"] = dets[di]
            tr["age"] = 0
            tr["hits"] = tr.get("hits", 0) + 1

        for di in sorted(unmatched_dets):
            tid = self.next_id
            self.next_id += 1
            self.tracks[tid] = {"box": dets[di], "age": 0, "hits": 1}
            assignments.append((tid, di))

        for tid in unmatched_tracks:
            self.tracks[tid]["age"] += 1

        stale = [tid for tid, tr in self.tracks.items() if tr["age"] > self.max_age]
        for tid in stale:
            del self.tracks[tid]

        live = []
        assigned_ids = {tid for tid, _di in assignments}
        for tid, tr in self.tracks.items():
            if tid in assigned_ids or tr["age"] == 0:
                live.append((tid, tr["box"]))
        return live
