"""Last-resort / unsettled-track fallback, kept separate from FairFace
smoothing so tests can import it without loading YOLO/ONNX."""


def best_attempt(attempts):
    if not attempts:
        return None
    return max(attempts, key=lambda a: a["gender_conf"])


def _apply_attempt(record, attempt):
    record["gender"] = attempt["gender"]
    record["gender_conf"] = attempt["gender_conf"]
    record["age"] = attempt.get("age", "")
    record["race"] = attempt.get("race", "")
    record["confirmed"] = False


def apply_unsettled_fallback(record):
    """Fill an unsettled track from the best available attempt.

    Priority: confirmed/settled (no-op) > quality-OK raw_attempts >
    low_quality_attempts > leave Detecting...

    Returns the source applied: 'settled', 'best_raw', 'last_resort',
    or None if the record is still Detecting... with nothing to fall back to.
    """
    if record.get("confirmed"):
        record["source"] = "settled"
        return "settled"

    raw = record.get("raw_attempts") or []
    if raw:
        _apply_attempt(record, best_attempt(raw))
        record["source"] = "best_raw"
        return "best_raw"

    low_quality = record.get("low_quality_attempts") or []
    if low_quality:
        _apply_attempt(record, best_attempt(low_quality))
        record["source"] = "last_resort"
        return "last_resort"

    return None


def apply_last_resort_live(record):
    """Overlay a running-best last-resort guess while a track still has
    no quality-OK FairFace reads. Does not touch smoothing history.

    No-op if the track is confirmed/locked, or if raw_attempts already
    exist (those use the end-of-run best_raw fallback instead).
    """
    if record.get("confirmed") or record.get("locked"):
        return None
    if record.get("raw_attempts"):
        return None
    low_quality = record.get("low_quality_attempts") or []
    if not low_quality:
        return None
    if (record.get("gender") != "Detecting..."
            and record.get("source") != "last_resort"):
        return None
    return apply_unsettled_fallback(record)
