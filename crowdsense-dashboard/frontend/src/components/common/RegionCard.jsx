import React from "react";

function regionLabel(id = "") {
  return id.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function RegionCard({
  region,
  thresholds = { low: 3, high: 8 },
  summary,
  recentHistory = [],
}) {
  const lowThresh = thresholds?.low ?? 3;
  const highThresh = thresholds?.high ?? 8;
  const count = region?.count ?? 0;

  let level = "low";
  let levelText = "LOW";
  if (count > highThresh) {
    level = "high";
    levelText = "HIGH";
  } else if (count > lowThresh) {
    level = "medium";
    levelText = "MEDIUM";
  }

  // Max scale for bar (at least highThresh * 1.5)
  const maxScale = Math.max(12, highThresh * 1.5);
  const barPercent = Math.min(100, Math.round((count / maxScale) * 100));

  // Max recent for sparkline
  const maxRecent = Math.max(1, ...recentHistory);

  return (
    <div className={`region-card density-${level}`}>
      <div className="region-card-top">
        <div className="region-info">
          <h3 className="region-title">{regionLabel(region?.name || region?.region_id)}</h3>
          <span className={`level-badge level-${level}`}>{levelText}</span>
        </div>
        <div className="region-count-hero">{count}</div>
      </div>

      <div className="region-progress-track">
        <div className={`region-progress-fill fill-${level}`} style={{ width: `${barPercent}%` }} />
      </div>

      <div className="region-card-footer">
        {summary ? (
          <div className="region-stats">
            <span>Peak: <strong>{summary.peak ?? count}</strong></span>
            <span>Avg: <strong>{summary.average ?? count}</strong></span>
          </div>
        ) : (
          <span className="region-threshold-guide">
            Threshold: &le;{lowThresh} Low · &le;{highThresh} Med · &gt;{highThresh} High
          </span>
        )}

        {recentHistory.length > 1 && (
          <div className="region-sparkline" title="Recent activity trend">
            {recentHistory.map((val, idx) => (
              <span
                key={idx}
                className="sparkline-bar"
                style={{ height: `${Math.max(15, (val / maxRecent) * 100)}%` }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
