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

  // Calculate short-term trend from recent history
  let trend = "stable";
  let trendIcon = "▬";
  let trendLabel = "Stable";
  if (recentHistory.length >= 2) {
    const last = recentHistory[recentHistory.length - 1];
    const prev = recentHistory[recentHistory.length - 2];
    if (last > prev) {
      trend = "rising";
      trendIcon = "▲";
      trendLabel = "Rising";
    } else if (last < prev) {
      trend = "falling";
      trendIcon = "▼";
      trendLabel = "Falling";
    }
  }

  const avgVal = summary?.average != null ? summary.average : count;
  const peakVal = summary?.peak != null ? summary.peak : count;

  return (
    <div className={`region-card density-${level}`}>
      <div className="region-card-top">
        <div className="region-info">
          <h3 className="region-title">{regionLabel(region?.name || region?.region_id)}</h3>
          <div className="region-badges">
            <span className={`level-badge level-${level}`}>{levelText}</span>
            <span className={`region-trend-badge trend-${trend}`} title={`Short-term trend: ${trendLabel}`}>
              {trendIcon} {trendLabel}
            </span>
          </div>
        </div>
        <div className="region-count-hero" title="Current occupancy">
          {count}
        </div>
      </div>

      <div className="region-progress-track">
        <div className={`region-progress-fill fill-${level}`} style={{ width: `${barPercent}%` }} />
      </div>

      <div className="region-card-footer">
        <div className="region-stats">
          <span>Current: <strong>{count}</strong></span>
          <span>Avg: <strong>{avgVal}</strong></span>
          <span>Peak: <strong>{peakVal}</strong></span>
        </div>

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
