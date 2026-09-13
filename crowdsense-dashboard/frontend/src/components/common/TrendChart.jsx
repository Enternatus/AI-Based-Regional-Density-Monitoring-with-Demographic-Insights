import React, { useMemo, useState } from "react";

const PALETTE = ["#38bdf8", "#a855f7", "#f59e0b", "#10b981", "#ec4899", "#6366f1"];

function formatSnapshotTime(isoString, frameIndex) {
  if (frameIndex != null) return `Frame ${frameIndex}`;
  if (!isoString) return "--";
  try {
    const d = new Date(isoString.includes("T") ? isoString : isoString.replace(" ", "T"));
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch {
    return isoString;
  }
}

export default function TrendChart({
  history = [],
  thresholds = { low: 3, high: 8 },
  height = 240,
  showModeToggle = true,
  initialMode = "total", // "total" | "by_region"
}) {
  const [mode, setMode] = useState(initialMode);
  const [hoverIndex, setHoverIndex] = useState(null);

  const highThresh = thresholds?.high ?? 8;

  // Process data points and establish unified color map
  const chartData = useMemo(() => {
    if (!history || history.length === 0) return null;

    const width = 640;
    const padding = { top: 25, bottom: 25, left: 35, right: 35 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    // Extract all unique regions across history
    const allRegionIds = new Set();
    const regionColorMap = {};
    const regionNameMap = {};

    const snapshots = history.map((item, idx) => {
      const regionsList = item.regions ?? [];
      const byRegion = {};
      let total = 0;
      for (const r of regionsList) {
        byRegion[r.region_id] = r.count;
        total += r.count;
        allRegionIds.add(r.region_id);
        if (r.accent && !regionColorMap[r.region_id]) {
          regionColorMap[r.region_id] = r.accent;
        }
        if (r.display_name && !regionNameMap[r.region_id]) {
          regionNameMap[r.region_id] = r.display_name;
        }
      }
      return {
        idx,
        time: item.updated_at,
        frame: item.frame_index,
        total: item.total != null ? item.total : total,
        byRegion,
      };
    });

    const regionIds = Array.from(allRegionIds);

    // Fallback assignment for any missing colors or display names
    regionIds.forEach((rid, idx) => {
      if (!regionColorMap[rid]) {
        regionColorMap[rid] = PALETTE[idx % PALETTE.length];
      }
      if (!regionNameMap[rid]) {
        regionNameMap[rid] = rid.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      }
    });

    // Compute max value for Y scale
    let maxVal = highThresh + 2;
    for (const s of snapshots) {
      if (mode === "total") {
        if (s.total > maxVal) maxVal = s.total;
      } else {
        for (const rid of regionIds) {
          if ((s.byRegion[rid] ?? 0) > maxVal) maxVal = s.byRegion[rid];
        }
      }
    }
    maxVal = Math.max(maxVal, 1);

    const stepX = snapshots.length > 1 ? chartW / (snapshots.length - 1) : chartW / 2;

    const coordY = (val) => height - padding.bottom - (val / maxVal) * chartH;
    const coordX = (i) => padding.left + (snapshots.length > 1 ? i * stepX : chartW / 2);

    // Build paths
    let totalLinePath = "";
    let totalAreaPath = "";
    const totalPoints = snapshots.map((s, i) => {
      const x = coordX(i);
      const y = coordY(s.total);
      return { x, y, total: s.total, snapshot: s };
    });

    if (totalPoints.length > 0) {
      totalLinePath = totalPoints.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
      const lastP = totalPoints[totalPoints.length - 1];
      const firstP = totalPoints[0];
      const baseY = height - padding.bottom;
      totalAreaPath = `${totalLinePath} L ${lastP.x.toFixed(1)} ${baseY} L ${firstP.x.toFixed(1)} ${baseY} Z`;
    }

    // By region paths using consistent color map
    const regionTraces = regionIds.map((rid) => {
      const color = regionColorMap[rid];
      const name = regionNameMap[rid];
      const points = snapshots.map((s, i) => {
        const val = s.byRegion[rid] ?? 0;
        return {
          x: coordX(i),
          y: coordY(val),
          val,
          snapshot: s,
        };
      });
      const path = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
      return {
        regionId: rid,
        name,
        color,
        points,
        path,
      };
    });

    // High threshold line
    const threshY = coordY(highThresh);

    return {
      width,
      height,
      padding,
      maxVal,
      snapshots,
      regionIds,
      regionColorMap,
      regionNameMap,
      totalPoints,
      totalLinePath,
      totalAreaPath,
      regionTraces,
      threshY,
    };
  }, [history, highThresh, height, mode]);

  if (!chartData || chartData.snapshots.length === 0) {
    return (
      <div className="trend-chart-empty">
        <div className="empty-chart-icon">📈</div>
        <p>Awaiting monitoring session telemetry (no snapshots recorded yet).</p>
      </div>
    );
  }

  const latestSnapshot = chartData.snapshots[chartData.snapshots.length - 1];
  const activeSnapshot = hoverIndex != null ? chartData.snapshots[hoverIndex] : null;
  const activePoint = hoverIndex != null ? chartData.totalPoints[hoverIndex] : null;

  return (
    <div className="trend-chart-container">
      <div className="trend-chart-header">
        <div className="trend-chart-titles">
          <div className="trend-chart-title">
            {mode === "total" ? "Total Area Occupancy Trend" : "Multi-Zone Regional Comparison"}
          </div>
          <div className="trend-chart-subtitle">
            {latestSnapshot && (
              <span className="chart-latest-readout">
                Latest: <strong>{latestSnapshot.total} people</strong> ({formatSnapshotTime(latestSnapshot.time, latestSnapshot.frame)}) · {chartData.snapshots.length} snapshot{chartData.snapshots.length === 1 ? "" : "s"}
              </span>
            )}
          </div>
        </div>

        <div className="trend-chart-controls">
          {showModeToggle && (
            <div className="chart-mode-toggle">
              <button
                type="button"
                className={`mode-btn ${mode === "total" ? "active" : ""}`}
                onClick={() => setMode("total")}
              >
                Total
              </button>
              <button
                type="button"
                className={`mode-btn ${mode === "by_region" ? "active" : ""}`}
                onClick={() => setMode("by_region")}
              >
                By Region
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Region Legend when in by_region mode */}
      {mode === "by_region" && (
        <div className="chart-legend">
          {chartData.regionTraces.map((trace) => (
            <span key={trace.regionId} className="legend-item">
              <span className="legend-color-box" style={{ backgroundColor: trace.color }} />
              <span className="legend-name">{trace.name}</span>
            </span>
          ))}
        </div>
      )}

      {/* SVG Canvas */}
      <div className="svg-wrapper">
        <svg
          className="trend-chart-svg"
          viewBox={`0 0 ${chartData.width} ${chartData.height}`}
          preserveAspectRatio="none"
          onMouseLeave={() => setHoverIndex(null)}
        >
          <defs>
            <linearGradient id="totalAreaGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {[0.2, 0.5, 0.8].map((f) => {
            const y = chartData.padding.top + f * (chartData.height - chartData.padding.top - chartData.padding.bottom);
            return (
              <line
                key={f}
                className="chart-grid-line"
                x1={chartData.padding.left}
                x2={chartData.width - chartData.padding.right}
                y1={y}
                y2={y}
              />
            );
          })}

          {/* Lightweight X-axis time / frame labels */}
          {chartData.snapshots.length >= 2 && (
            <g className="chart-axis-labels" fill="#9ca3af" fontSize="9" fontFamily="monospace">
              <text x={chartData.padding.left} y={chartData.height - 6} textAnchor="start">
                {formatSnapshotTime(chartData.snapshots[0].time, chartData.snapshots[0].frame)}
              </text>
              {chartData.snapshots.length >= 4 && (
                <text x={chartData.width / 2} y={chartData.height - 6} textAnchor="middle">
                  {formatSnapshotTime(
                    chartData.snapshots[Math.floor(chartData.snapshots.length / 2)].time,
                    chartData.snapshots[Math.floor(chartData.snapshots.length / 2)].frame
                  )}
                </text>
              )}
              <text x={chartData.width - chartData.padding.right} y={chartData.height - 6} textAnchor="end">
                {formatSnapshotTime(latestSnapshot.time, latestSnapshot.frame)}
              </text>
            </g>
          )}

          {/* Threshold line */}
          {chartData.threshY >= chartData.padding.top && chartData.threshY <= chartData.height - chartData.padding.bottom && (
            <g className="chart-threshold-group">
              <line
                className="chart-threshold-line"
                x1={chartData.padding.left}
                x2={chartData.width - chartData.padding.right}
                y1={chartData.threshY}
                y2={chartData.threshY}
              />
              <text
                className="chart-threshold-text"
                x={chartData.width - chartData.padding.right - 4}
                y={chartData.threshY - 5}
                textAnchor="end"
              >
                High Threshold ({highThresh}+)
              </text>
            </g>
          )}

          {/* Mode rendering */}
          {mode === "total" ? (
            <>
              <path className="chart-total-area" d={chartData.totalAreaPath} fill="url(#totalAreaGradient)" />
              <path className="chart-total-line" d={chartData.totalLinePath} />
              {chartData.totalPoints.map((pt, i) => (
                <circle
                  key={i}
                  className={`chart-data-point ${hoverIndex === i ? "hovered" : ""}`}
                  cx={pt.x}
                  cy={pt.y}
                  r={hoverIndex === i ? 5.5 : 3.5}
                  onMouseEnter={() => setHoverIndex(i)}
                />
              ))}
            </>
          ) : (
            chartData.regionTraces.map((trace) => (
              <g key={trace.regionId}>
                <path className="chart-region-line" d={trace.path} stroke={trace.color} />
                {trace.points.map((pt, i) => (
                  <circle
                    key={i}
                    className={`chart-data-point ${hoverIndex === i ? "hovered" : ""}`}
                    cx={pt.x}
                    cy={pt.y}
                    r={hoverIndex === i ? 5 : 3}
                    fill={trace.color}
                    onMouseEnter={() => setHoverIndex(i)}
                  />
                ))}
              </g>
            ))
          )}

          {/* Vertical cursor guide ONLY when hovered */}
          {activePoint && (
            <line
              className="chart-cursor-line"
              x1={activePoint.x}
              x2={activePoint.x}
              y1={chartData.padding.top}
              y2={chartData.height - chartData.padding.bottom}
            />
          )}
        </svg>

        {/* Hover Tooltip Overlay ONLY rendered when hovering over a point */}
        {activeSnapshot && (
          <div className="chart-interactive-tooltip">
            <div className="tooltip-header">
              <span className="tooltip-time">
                {formatSnapshotTime(activeSnapshot.time, activeSnapshot.frame)}
              </span>
              <span className="tooltip-total">
                Total: <strong>{activeSnapshot.total}</strong>
              </span>
            </div>
            <div className="tooltip-regions">
              {Object.entries(activeSnapshot.byRegion).map(([rid, count]) => (
                <span key={rid} className="tooltip-region-row">
                  <span
                    className="tooltip-dot"
                    style={{ backgroundColor: chartData.regionColorMap[rid] || "#38bdf8" }}
                  />
                  <span className="tooltip-name">{chartData.regionNameMap[rid] || rid}:</span>
                  <strong className="tooltip-val">{count}</strong>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
