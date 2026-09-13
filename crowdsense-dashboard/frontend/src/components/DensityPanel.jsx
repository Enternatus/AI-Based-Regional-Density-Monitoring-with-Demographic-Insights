import React, { useMemo } from "react";
import StatusPill from "./common/StatusPill.jsx";
import DataSourceBadge from "./common/DataSourceBadge.jsx";
import MetricCard from "./common/MetricCard.jsx";
import RegionCard from "./common/RegionCard.jsx";
import TrendChart from "./common/TrendChart.jsx";

function regionLabel(id = "") {
  return id.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function DensityPanel({ data, historyProp = [], connected }) {
  // Use history passed directly from central App state; fallback to data.history if provided
  const historyList = historyProp && historyProp.length > 0 ? historyProp : (data?.history ?? []);

  const regions = data?.regions ?? [];
  const thresholds = data?.thresholds ?? { low: 3, high: 8 };
  const currentTotal = data?.current_total ?? regions.reduce((sum, r) => sum + r.count, 0);

  // Find busiest zone
  const busiestZone = useMemo(() => {
    if (!regions.length) return "--";
    const best = regions.reduce((max, r) => (r.count > (max?.count ?? -1) ? r : max), null);
    return best ? regionLabel(best.display_name || best.name || best.region_id) : "--";
  }, [regions]);

  // Session peak calculation from history
  const peakSeen = useMemo(() => {
    if (historyList.length > 0) {
      const totals = historyList.map((h) =>
        h.total != null ? h.total : (h.regions ?? []).reduce((s, r) => s + r.count, 0)
      );
      return Math.max(currentTotal, ...totals);
    }
    return currentTotal;
  }, [historyList, currentTotal]);

  // Summaries per region
  const regionSummaries = data?.summaries ?? {};

  // Build recent history for sparklines per region
  const regionSparklines = useMemo(() => {
    const spark = {};
    for (const r of regions) {
      spark[r.region_id] = historyList
        .map((h) => {
          const found = (h.regions ?? []).find((reg) => reg.region_id === r.region_id);
          return found ? found.count : 0;
        })
        .slice(-12);
    }
    return spark;
  }, [regions, historyList]);

  return (
    <div className="panel density-panel">
      {/* Header with explicit StatusPill and DataSource attribution */}
      <div className="panel-header density-header">
        <div>
          <span className="panel-kicker">Regional Crowd Telemetry</span>
          <h1 className="panel-title panel-title-large">Spatial Density</h1>
        </div>
        <div className="header-meta-group">
          <DataSourceBadge type="density" />
          <StatusPill
            status={data?.run_status ?? (connected ? "running" : "stopped")}
            updatedAt={data?.updated_at}
            frameIndex={data?.frame_index}
          />
        </div>
      </div>

      {/* Hero Metrics Row */}
      <div className="density-hero-grid">
        <MetricCard
          label="Current Occupancy"
          value={currentTotal}
          subtext="Total individuals detected across all zones"
          trend={data?.trend_direction ?? "stable"}
          isPrimary={true}
          badge="Live Count"
        />

        <MetricCard
          label="Peak Occupancy"
          value={peakSeen}
          subtext="Highest simultaneous count this session"
        />

        <MetricCard
          label="Busiest Zone"
          value={busiestZone}
          subtext="Zone with highest immediate density"
        />

        <MetricCard
          label="Zones Monitored"
          value={regions.length}
          subtext={`Thresholds: Low \u2264${thresholds.low} · High >${thresholds.high}`}
        />
      </div>

      {/* Threshold Reference Guide */}
      <div className="density-threshold-banner" role="region" aria-label="Density Level Thresholds">
        <div className="thresh-group">
          <span className="thresh-dot dot-low" />
          <span>Low: <strong>0 – {thresholds.low}</strong></span>
        </div>
        <div className="thresh-group">
          <span className="thresh-dot dot-med" />
          <span>Medium: <strong>{thresholds.low + 1} – {thresholds.high}</strong></span>
        </div>
        <div className="thresh-group">
          <span className="thresh-dot dot-high" />
          <span>High: <strong>{thresholds.high + 1}+</strong></span>
        </div>
        <span className="thresh-notice">
          All zones are labeled textually for accessible operational monitoring.
        </span>
      </div>

      {/* Main Interactive Trend Chart */}
      <div className="density-chart-wrapper">
        <TrendChart
          history={historyList}
          thresholds={thresholds}
          height={260}
          showModeToggle={true}
          initialMode="total"
        />
      </div>

      {/* Region Status Section */}
      <div className="regions-section">
        <div className="regions-section-header">
          <div>
            <h2 className="section-title">Regional Occupancy Breakdown</h2>
            <span className="section-subtitle">
              Spatial polygon analysis with rolling averages and peak metrics
            </span>
          </div>
          <span className="section-status">
            {connected ? "Live telemetry synced (5s)" : "Offline / Stored data"}
          </span>
        </div>

        {regions.length === 0 ? (
          <div className="empty-state-card">
            <p>No regions configured yet. Run crowd_monitor.py or check regions.json.</p>
          </div>
        ) : (
          <div className="regions-grid">
            {regions.map((region) => (
              <RegionCard
                key={region.region_id}
                region={region}
                thresholds={thresholds}
                summary={regionSummaries[region.region_id]}
                recentHistory={regionSparklines[region.region_id] ?? []}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
