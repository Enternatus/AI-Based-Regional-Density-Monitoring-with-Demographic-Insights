import React from "react";

export default function MetricCard({
  label,
  value,
  subtext,
  badge,
  trend, // "rising" | "falling" | "stable"
  isPrimary = false,
  className = "",
  onClick,
}) {
  const trendIcon =
    trend === "rising" ? "▲ Rising" : trend === "falling" ? "▼ Falling" : trend === "stable" ? "▬ Stable" : null;

  const trendClass =
    trend === "rising" ? "trend-rising" : trend === "falling" ? "trend-falling" : "trend-stable";

  return (
    <div
      className={`metric-card ${isPrimary ? "metric-card-primary" : ""} ${onClick ? "clickable" : ""} ${className}`}
      onClick={onClick}
    >
      <div className="metric-card-header">
        <span className="metric-card-label">{label}</span>
        {badge && <span className="metric-card-badge">{badge}</span>}
      </div>

      <div className="metric-card-body">
        <span className="metric-card-value">{value ?? "--"}</span>
        {trendIcon && <span className={`metric-card-trend ${trendClass}`}>{trendIcon}</span>}
      </div>

      {subtext && <div className="metric-card-subtext">{subtext}</div>}
    </div>
  );
}
