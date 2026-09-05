import { useEffect, useMemo, useRef, useState } from "react";

// Mirrors LOW_THRESHOLD / HIGH_THRESHOLD in crowd_monitor.py. If you tune
// those in the pipeline, update these two numbers to match -- there's no
// shared source of truth between the two right now.
const LOW_THRESHOLD = 3;
const HIGH_THRESHOLD = 8;

const HISTORY_LENGTH = 30; // ~2.5 min of history at a 5s poll interval

function regionLabel(id) {
  return id.replace(/_/g, " ");
}

function densityLevel(count) {
  if (count <= LOW_THRESHOLD) return "low";
  if (count <= HIGH_THRESHOLD) return "medium";
  return "high";
}

function levelText(level) {
  return { low: "Low", medium: "Medium", high: "High" }[level];
}

function timeAgo(isoString) {
  if (!isoString) return "never";
  const then = new Date(isoString.includes("T") ? isoString : isoString.replace(" ", "T"));
  if (Number.isNaN(then.getTime())) return isoString;
  const seconds = Math.max(0, Math.round((Date.now() - then.getTime()) / 1000));
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  return `${Math.round(seconds / 60)}m ago`;
}

export default function DensityPanel({ data, connected }) {
  const [history, setHistory] = useState([]); // [{ t, total, byRegion: {name: count} }]
  const lastFrameRef = useRef(null);

  const regions = data?.regions ?? [];
  const total = regions.reduce((sum, r) => sum + r.count, 0);
  const peak = regions.reduce((best, r) => (r.count > (best?.count ?? -1) ? r : best), null);
  const isLive = data?.source === "live_snapshot";

  // Append a history point whenever a genuinely new snapshot arrives (not
  // every 5s poll if the frame_index hasn't moved), so the trend reflects
  // real changes rather than re-plotting the same value repeatedly.
  useEffect(() => {
    if (!data) return;
    const frameKey = data.frame_index ?? data.updated_at;
    if (frameKey === lastFrameRef.current) return;
    lastFrameRef.current = frameKey;

    const byRegion = {};
    for (const r of regions) byRegion[r.region_id] = r.count;

    setHistory((prev) => {
      const next = [...prev, { t: Date.now(), total, byRegion }];
      return next.length > HISTORY_LENGTH ? next.slice(next.length - HISTORY_LENGTH) : next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const chartPoints = useMemo(() => {
    if (history.length < 2) return null;
    const width = 640;
    const height = 220;
    const padding = 20;
    const maxVal = Math.max(1, ...history.map((h) => h.total));
    const stepX = (width - padding * 2) / (history.length - 1);
    const points = history.map((h, i) => {
      const x = padding + i * stepX;
      const y = height - padding - (h.total / maxVal) * (height - padding * 2);
      return { x, y, total: h.total };
    });
    const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
    const areaPath = `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${height - padding} L ${points[0].x.toFixed(1)} ${height - padding} Z`;
    return { points, linePath, areaPath, width, height, maxVal };
  }, [history]);

  const peakSeen = useMemo(
    () => history.reduce((max, h) => Math.max(max, h.total), 0),
    [history]
  );

  return (
    <div className="panel density-panel">
      <div className="panel-header density-header">
        <div>
          <span className="panel-kicker">Live monitoring</span>
          <h1 className="panel-title panel-title-large">Density</h1>
        </div>
      <span className="status-pill">
          {(() => {
            const ago = data?.updated_at ? timeAgo(data.updated_at) : null;
            const seconds = data?.updated_at
              ? Math.max(0, Math.round((Date.now() - new Date(data.updated_at.includes("T") ? data.updated_at : data.updated_at.replace(" ", "T")).getTime()) / 1000))
              : Infinity;
            if (!data?.source) return <><span className="status-dot stale" /><span className="status-stale">No data yet</span></>;
            if (seconds < 10) return <><span className="status-dot" /><span className="status-live">Live · updated {ago}</span></>;
            if (seconds < 120) return <><span className="status-dot stale" /><span className="status-stale">⏸ Run stopped · last update {ago}</span></>;
            return <><span className="status-dot stale" /><span className="status-stale">⏹ Video complete · frame {data.frame_index ?? "?"} · {ago}</span></>;
          })()}
        </span>
      </div>

      <div className="density-metrics">
        <div className="density-metric">
          <span>People tracked</span>
          <strong>{total}</strong>
        </div>
        <div className="density-metric">
          <span>Regions monitored</span>
          <strong>{regions.length}</strong>
        </div>
        <div className="density-metric">
          <span>Busiest zone</span>
          <strong>{peak ? regionLabel(peak.region_id) : "--"}</strong>
        </div>
        <div className="density-metric">
          <span>Peak seen (session)</span>
          <strong>{peakSeen}</strong>
        </div>
      </div>

      <div className="density-legend">
        <span><i className="level-low" />Low: 0-{LOW_THRESHOLD}</span>
        <span><i className="level-medium" />Medium: {LOW_THRESHOLD + 1}-{HIGH_THRESHOLD}</span>
        <span><i className="level-high" />High: {HIGH_THRESHOLD}+</span>
        <span style={{ marginLeft: "auto" }}>Levels are always labeled in text, not color alone</span>
      </div>

      {chartPoints ? (
        <div className="crowd-trend-card">
          <div className="crowd-trend-heading">
            <div>
              <div className="crowd-trend-title">Total people, all regions</div>
              <div className="crowd-trend-subtitle">Last {history.length} snapshot(s) this session</div>
            </div>
            <div className="crowd-trend-key">
              <span>Current: <strong>{total}</strong></span>
            </div>
          </div>
          <svg className="crowd-trend-chart" viewBox={`0 0 ${chartPoints.width} ${chartPoints.height}`} preserveAspectRatio="none">
            {[0.25, 0.5, 0.75].map((f) => (
              <line
                key={f}
                className="chart-grid"
                x1={20}
                x2={chartPoints.width - 20}
                y1={20 + f * (chartPoints.height - 40)}
                y2={20 + f * (chartPoints.height - 40)}
              />
            ))}
            {/* Threshold annotation — dashed line at HIGH_THRESHOLD */}
            {chartPoints.maxVal >= HIGH_THRESHOLD && (() => {
              const threshY = chartPoints.height - 20 - (HIGH_THRESHOLD / chartPoints.maxVal) * (chartPoints.height - 40);
              return <>
                <line className="chart-threshold" x1={20} x2={chartPoints.width - 20} y1={threshY} y2={threshY} />
                <text className="chart-threshold-label" x={chartPoints.width - 22} y={threshY - 4} textAnchor="end">High: {HIGH_THRESHOLD}+</text>
              </>;
            })()}
            <path className="chart-area" d={chartPoints.areaPath} />
            <path className="chart-line" d={chartPoints.linePath} />
            {chartPoints.points.length > 0 && (
              <circle
                className="chart-current-dot"
                r="4"
                cx={chartPoints.points[chartPoints.points.length - 1].x}
                cy={chartPoints.points[chartPoints.points.length - 1].y}
              />
            )}
          </svg>
          <p className="chart-summary">Peak this session: {peakSeen} people</p>
        </div>
      ) : (
        <div className="crowd-trend-empty">
          Collecting trend data -- needs at least two live snapshots from crowd_monitor.py
        </div>
      )}

      <div className="region-list">
        <div className="region-list-heading">
          <h2>Regions</h2>
          <span>{connected ? "Polling every 5s" : "Backend unreachable"}</span>
        </div>

        {regions.length === 0 && <div className="empty-state">No regions configured yet</div>}

        {regions.map((r) => {
          const level = densityLevel(r.count);
          const recent = history.map((h) => h.byRegion[r.region_id] ?? 0).slice(-10);
          const maxRecent = Math.max(1, ...recent);
          return (
            <div className={`region-row density-${level}`} key={r.region_id}>
              <div className="region-row-label">
                <div>
                  <span className="region-name">{regionLabel(r.region_id)}</span>
                  <span className="region-level">{levelText(level)}</span>
                </div>
                <span className="region-count">{r.count}</span>
              </div>
              <div className="region-bar-track">
                <div
                  className="region-bar-fill"
                  style={{ width: `${Math.min(100, (r.count / (HIGH_THRESHOLD * 1.5)) * 100)}%` }}
                />
              </div>
              <div className="region-summary">
                <span>Threshold: Low 0-{LOW_THRESHOLD} / Med {LOW_THRESHOLD + 1}-{HIGH_THRESHOLD} / High {HIGH_THRESHOLD}+</span>
                {recent.length > 1 ? (
                  <div className="region-trend" aria-label={`Recent trend for ${regionLabel(r.region_id)}`}>
                    {recent.map((v, i) => (
                      <span key={i} style={{ height: `${Math.max(10, (v / maxRecent) * 100)}%` }} />
                    ))}
                  </div>
                ) : (
                  <span className="trend-empty">--</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="density-total">
        <div className="density-total-value">{total}</div>
        <div className="density-total-label">people tracked, all regions right now</div>
      </div>
    </div>
  );
}
