import React, { useEffect, useRef, useState } from "react";
import { cropUrl, getPerson } from "../api/crowdsense.js";
import DataSourceBadge from "./common/DataSourceBadge.jsx";

const SOURCE_INFO = {
  settled: {
    label: "Confirmed Multi-Frame Result",
    description: "This estimate passed all face sharpness, centering, and temporal stability criteria across multiple consensus video frames.",
    className: "badge-settled",
  },
  best_raw: {
    label: "Best Available Inference",
    description: "This estimate was derived from quality-accepted frames, but the person track exited the corridor before reaching full settlement.",
    className: "badge-raw",
  },
  last_resort: {
    label: "Low-Quality Guess",
    description: "Estimated from marginal, blurry, or edge crops with minimal consensus. Treated as low reliability.",
    className: "badge-guess",
  },
};

function Attribute({ label, value, subtext }) {
  return (
    <div className="profile-attr">
      <span className="profile-attr-label">{label}</span>
      <span className="profile-attr-value">{value || "No reliable estimate"}</span>
      {subtext && <span className="profile-attr-subtext">{subtext}</span>}
    </div>
  );
}

function Confidence({ label = "Model Confidence", value }) {
  if (!(value > 0)) return null;
  return (
    <div className="confidence-card">
      <div className="conf-header">
        <span>{label}</span>
        <strong>{value.toFixed(1)}%</strong>
      </div>
      <div className="conf-bar-track">
        <div className="conf-bar-fill" style={{ width: `${Math.min(value, 100)}%` }} />
      </div>
      <p className="conf-note">Model classification probability from FairFace multi-task neural network.</p>
    </div>
  );
}

export default function PersonProfile({ person, onClose }) {
  const [detail, setDetail] = useState(null);
  const closeButton = useRef(null);

  useEffect(() => {
    let cancelled = false;
    getPerson(person.person_id)
      .then((data) => {
        if (!cancelled) setDetail(data);
      })
      .catch(() => {});

    closeButton.current?.focus();
    const onKeyDown = (event) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKeyDown);
    return () => {
      cancelled = true;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [person.person_id, onClose]);

  const data = detail || person;
  const source = SOURCE_INFO[data.source] ?? {
    label: "Unresolved / Detecting",
    description: "The pipeline did not retain sufficient frames for a verified estimate.",
    className: "badge-locked",
  };

  const fps = 30;
  const firstFrame = data.first_seen_frame ?? 0;
  const lastFrame = data.last_seen_frame ?? firstFrame;
  const frameSpan = Math.max(1, lastFrame - firstFrame);
  const durationSec = (frameSpan / fps).toFixed(2);

  return (
    <div className="profile-overlay" onClick={onClose}>
      <section
        className="profile-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-title"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          ref={closeButton}
          className="profile-close"
          onClick={onClose}
          type="button"
          aria-label="Close record details"
        >
          &times;
        </button>

        {/* Modal Top Header */}
        <div className="profile-top">
          <div className="profile-crop-wrap">
            {data.crop_path ? (
              <img
                className="profile-crop"
                src={cropUrl(data.person_id)}
                alt={`Bust crop for track ${data.person_id}`}
                onError={(event) => (event.currentTarget.style.visibility = "hidden")}
              />
            ) : (
              <div className="profile-crop profile-crop-empty">No crop available</div>
            )}
          </div>

          <div className="profile-header-info">
            <div className="profile-kicker-row">
              <span className="panel-kicker">Corridor Track Dossier</span>
              <DataSourceBadge type="people" condensed={true} />
            </div>
            <h2 id="profile-title" className="profile-title">
              Track ID #{data.person_id}
            </h2>
            <span className={`badge profile-quality ${source.className}`}>{source.label}</span>
            <p className="profile-source-desc">{source.description}</p>
          </div>
        </div>

        {/* Scientific Disclosure */}
        <div className="profile-disclosure">
          <strong>Scientific Methodology:</strong> Attributes are generated using YOLOv8 bounding boxes, FairFace multi-task demographic networks, and K-Means fabric color extraction. They represent statistical visual classifications, not personal identity.
        </div>

        {/* Demographic & Visual Attributes */}
        <div className="profile-section">
          <h3 className="profile-section-title">Classified Demographic & Visual Attributes</h3>
          <div className="profile-attrs-grid">
            <Attribute label="Gender" value={data.gender} />
            <Attribute label="Age Bracket" value={data.age} />
            <Attribute
              label="Appearance Group"
              value={data.race ? data.race.replace("Latino_Hispanic", "Hispanic / Latino") : ""}
            />
            <Attribute label="Shirt Fabric Color" value={data.clothing_color} />
          </div>
        </div>

        {/* Temporal & Quality Provenance */}
        <div className="profile-section">
          <h3 className="profile-section-title">Temporal Observation & Quality Evidence</h3>
          <Confidence label="Gender Classification Confidence" value={data.gender_conf} />

          <div className="profile-attrs-grid profile-observation-grid">
            <Attribute
              label="First Observed"
              value={`Frame ${firstFrame}`}
              subtext={`Session timestamp ${(firstFrame / fps).toFixed(1)}s`}
            />
            <Attribute
              label="Last Observed"
              value={`Frame ${lastFrame}`}
              subtext={`Session timestamp ${(lastFrame / fps).toFixed(1)}s`}
            />
            <Attribute
              label="Total Duration"
              value={`${durationSec}s`}
              subtext={`${frameSpan} video frames`}
            />
            <Attribute
              label="Source Video"
              value="close_range_crowd.mp4"
              subtext="Close-range corridor view"
            />
          </div>
        </div>

        {/* Raw Inferences Log Details */}
        {(detail?.raw_attempts?.length > 0 || detail?.low_quality_attempts?.length > 0) && (
          <details className="profile-details">
            <summary>Inspect Multi-Frame Verification Logs</summary>
            <div className="attempt-logs-content">
              {detail?.raw_attempts?.length > 0 && (
                <div className="attempt-log-section">
                  <h4>Quality-Accepted Predictions ({detail.raw_attempts.length})</h4>
                  <ul className="attempt-list">
                    {detail.raw_attempts.map((att, i) => (
                      <li key={i}>
                        Frame {att.frame}: {att.gender} ({att.gender_conf?.toFixed(0)}%) · {att.age} · {(att.race || "").replace("Latino_Hispanic", "Hispanic / Latino")}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {detail?.low_quality_attempts?.length > 0 && (
                <div className="attempt-log-section">
                  <h4>Quality-Rejected Frames ({detail.low_quality_attempts.length})</h4>
                  <p className="log-note">Filtered out due to motion blur, sharpness thresholds, or boundary occlusion.</p>
                </div>
              )}
            </div>
          </details>
        )}
      </section>
    </div>
  );
}
