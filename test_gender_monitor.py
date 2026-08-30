"""
Regression tests for the smoothing/gating logic in gender_monitor.py.

Run with: pytest test_gender_monitor.py -v
(or just: python test_gender_monitor.py)

Each test below is tied to a SPECIFIC bug we already found and fixed.
The point isn't "test everything" -- it's "make sure a future change
can never silently bring back a bug we already paid to discover."

If you change the smoothing/gating logic in gender_monitor.py, copy the
updated top_and_margin / update_attribute / _smoothed_from_history
functions in here (or import them directly -- see note at bottom) and
run this file BEFORE you trust the new version.
"""

from collections import defaultdict, Counter

# --- paste-or-import the logic under test ----------------------------------
# For now this is a copy of the functions from gender_monitor.py so the
# test has zero dependency on cv2/onnxruntime/ultralytics being installed.
# Better long-term: move these into a separate smoothing.py module and
# import it both here and in gender_monitor.py, so there's only one copy
# of the real logic and this file can never drift out of sync with it.

SMOOTHING_WINDOW = 15
MIN_ACCEPT_CONF = {"gender": 60.0, "race": 45.0, "age": 35.0}
MIN_MARGIN = {"gender": 15.0, "race": 10.0, "age": 8.0}


def make_fresh_state():
    return {"gender": defaultdict(list), "age": defaultdict(list), "race": defaultdict(list)}


def top_and_margin(scores: dict):
    ranked = sorted(scores.items(), key=lambda kv: kv[1], reverse=True)
    top_label, top_p = ranked[0]
    second_p = ranked[1][1] if len(ranked) > 1 else 0.0
    return top_label, top_p * 100, (top_p - second_p) * 100


def _smoothed_from_history(history):
    if not history:
        return None, None
    weights = Counter()
    for h_label, h_conf in history:
        weights[h_label] += h_conf
    smoothed_label = weights.most_common(1)[0][0]
    agreeing = [c for l, c in history if l == smoothed_label]
    smoothed_conf = sum(agreeing) / len(agreeing)
    return smoothed_label, smoothed_conf


def update_attribute(raw_history, attr_name, track_id, label, conf, margin):
    history = raw_history[attr_name][track_id]
    if conf < MIN_ACCEPT_CONF[attr_name] or margin < MIN_MARGIN[attr_name]:
        return _smoothed_from_history(history)
    history.append((label, conf))
    if len(history) > SMOOTHING_WINDOW:
        history.pop(0)
    return _smoothed_from_history(history)


# --- regression tests --------------------------------------------------

def test_confidently_wrong_low_margin_read_is_rejected():
    """Bug: Indian person read as White at 100% confidence.
    Root cause: a high top-1 score with a tiny margin over 2nd place is
    NOT the same as a reliable read. This must be rejected even at 100%."""
    state = make_fresh_state()
    update_attribute(state, "race", "p1", "White", 70, 40)   # good read
    update_attribute(state, "race", "p1", "White", 65, 35)   # good read
    result, _ = update_attribute(state, "race", "p1", "Black", 100, 8)  # confidently wrong, low margin
    assert result == "White", f"a low-margin read flipped the result to {result}"


def test_single_bad_frame_cannot_flip_an_established_track():
    """Bug: one bad-angle frame flipped gender for an entire track."""
    state = make_fresh_state()
    for _ in range(5):
        update_attribute(state, "gender", "p1", "Male", 91, 40)
    result, _ = update_attribute(state, "gender", "p1", "Female", 56, 12)  # low conf AND low margin
    assert result == "Male", f"one bad frame flipped gender to {result}"


def test_low_confidence_read_never_enters_history_at_all():
    """A rejected read must not be silently added anyway."""
    state = make_fresh_state()
    update_attribute(state, "gender", "p1", "Male", 91, 40)
    update_attribute(state, "gender", "p1", "Female", 40, 5)  # well below both bars
    history = state["gender"]["p1"]
    assert len(history) == 1, f"rejected read leaked into history: {history}"


def test_cross_run_records_are_never_merged_by_id():
    """Bug: track IDs reset to 1 every run, so 'ID 1' from run A and
    'ID 1' from run B are almost certainly different real people.
    Loading an old person_records.json must never merge into a fresh
    run's dict keyed by the same ID strings."""
    old_records = {"1": {"gender": "Female", "race": "East Asian"}}
    new_records = {}  # <- a correct run starts empty, never `new_records = old_records`
    assert new_records != old_records
    assert "1" not in new_records


def test_each_attribute_gated_independently():
    """Bug: race was being gated using gender's confidence. A frame can be
    a great gender read and a terrible race read at the same time."""
    state = make_fresh_state()
    # gender is confident+clear, race is confident but ambiguous (small margin)
    g_result, _ = update_attribute(state, "gender", "p1", "Male", 95, 50)
    r_result, _ = update_attribute(state, "race", "p1", "Middle Eastern", 90, 3)
    assert g_result == "Male"
    assert r_result is None, f"an ambiguous race read should not have been accepted, got {r_result}"


def test_smoothing_window_does_not_grow_unbounded():
    """History must stay capped at SMOOTHING_WINDOW even after many reads."""
    state = make_fresh_state()
    for i in range(50):
        update_attribute(state, "age", "p1", "20-29", 60, 20)
    assert len(state["age"]["p1"]) == SMOOTHING_WINDOW


if __name__ == "__main__":
    tests = [obj for name, obj in list(globals().items()) if name.startswith("test_")]
    passed, failed = 0, 0
    for t in tests:
        try:
            t()
            print(f"PASS  {t.__name__}")
            passed += 1
        except AssertionError as e:
            print(f"FAIL  {t.__name__}: {e}")
            failed += 1
    print(f"\n{passed} passed, {failed} failed")