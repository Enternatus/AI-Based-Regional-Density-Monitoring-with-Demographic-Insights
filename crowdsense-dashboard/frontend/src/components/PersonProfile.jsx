import { useEffect, useRef, useState } from "react";
import { cropUrl, fetchPerson } from "../api.js";

const SOURCE_INFO = {
  settled: {
    label: "Confirmed pipeline result",
    description: "This estimate passed the configured image-quality checks and remained stable over multiple frames.",
    className: "badge-settled",
  },
  best_raw: {
    label: "Best available result",
    description: "This estimate came from an acceptable frame but did not remain long enough to settle as confirmed.",
    className: "badge-raw",
  },
  last_resort: {
    label: "Low-quality guess",
    description: "This estimate was selected from a blurry or poorly positioned crop. Treat it as unreliable.",
    className: "badge-guess",
  },
};

function Attribute({ label, value }) {
  return <div className="profile-attr"><span className="profile-attr-label">{label}</span><span className="profile-attr-value">{value || "No reliable estimate"}</span></div>;
}

function Confidence({ value }) {
  if (!(value > 0)) return null;
  return (
    <div className="confidence-card">
      <div><span>Gender score</span><strong>{value.toFixed(1)}%</strong></div>
      <div className="conf-bar-track"><div className="conf-bar-fill" style={{ width: `${Math.min(value, 100)}%` }} /></div>
      <p>This is the model score for this record, not a guarantee that the estimate is correct.</p>
    </div>
  );
}

export default function PersonProfile({ person, onClose }) {
  const [detail, setDetail] = useState(null);
  const closeButton = useRef(null);

  useEffect(() => {
    let cancelled = false;
    fetchPerson(person.person_id).then((data) => {
      if (!cancelled) setDetail(data);
    }).catch(() => {});
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
    label: "No reliable estimate",
    description: "The pipeline did not retain enough usable evidence for a trustworthy estimate.",
    className: "badge-locked",
  };
  const fps = 30;
  const firstFrame = data.first_seen_frame ?? 0;
  const lastFrame = data.last_seen_frame ?? firstFrame;
  const duration = Math.max(0, lastFrame - firstFrame);

  return (
    <div className="profile-overlay" onClick={onClose}>
      <section className="profile-modal" role="dialog" aria-modal="true" aria-labelledby="profile-title" onClick={(event) => event.stopPropagation()}>
        <button ref={closeButton} className="profile-close" onClick={onClose} type="button" aria-label="Close record details">Close</button>
        <div className="profile-top">
          <div className="profile-crop-wrap">
            {data.crop_path ? <img className="profile-crop" src={cropUrl(data.person_id)} alt={`Representative crop for record ${data.person_id}`} onError={(event) => (event.currentTarget.style.visibility = "hidden")} /> : <div className="profile-crop profile-crop-empty">No representative crop</div>}
          </div>
          <div className="profile-header-info">
            <span className="panel-kicker">Person record</span>
            <h2 id="profile-title" className="profile-title">Record {data.person_id}</h2>
            <span className={`badge profile-quality ${source.className}`}>{source.label}</span>
            <p className="profile-source-desc">{source.description}</p>
          </div>
        </div>

        <div className="profile-disclosure">All visible attributes below are model estimates from the recorded video, not confirmed identity information.</div>

        <div className="profile-section">
          <h3 className="profile-section-title">Estimated attributes</h3>
          <div className="profile-attrs-grid">
            <Attribute label="Gender estimate" value={data.gender} />
            <Attribute label="Age range estimate" value={data.age} />
            <Attribute label="Appearance group estimate" value={data.race} />
            <Attribute label="Shirt color estimate" value={data.clothing_color} />
            <Attribute label="Height estimate" value={data.height_bucket} />
          </div>
        </div>

        <div className="profile-section">
          <h3 className="profile-section-title">Evidence quality</h3>
          <Confidence value={data.gender_conf} />
          <div className="profile-attrs-grid profile-observation-grid">
            <Attribute label="First observed" value={`Frame ${firstFrame} (${(firstFrame / fps).toFixed(1)}s)`} />
            <Attribute label="Last observed" value={`Frame ${lastFrame} (${(lastFrame / fps).toFixed(1)}s)`} />
            <Attribute label="Observed for" value={`${duration} frames (${(duration / fps).toFixed(1)}s)`} />
          </div>
        </div>

        {(detail?.raw_attempts?.length > 0 || detail?.low_quality_attempts?.length > 0) && (
          <details className="profile-details">
            <summary>Inspect retained frame evidence</summary>
            {detail?.raw_attempts?.length > 0 && <p className="profile-attempt-summary">{detail.raw_attempts.length} quality-accepted prediction attempt(s)</p>}
            {detail?.low_quality_attempts?.length > 0 && <p className="profile-attempt-summary">{detail.low_quality_attempts.length} rejected-crop prediction attempt(s)</p>}
          </details>
        )}
      </section>
    </div>
  );
}
