import React from "react";
import StatusPill from "./common/StatusPill.jsx";
import DataSourceBadge from "./common/DataSourceBadge.jsx";
import MetricCard from "./common/MetricCard.jsx";
import RegionCard from "./common/RegionCard.jsx";
import TrendChart from "./common/TrendChart.jsx";
import DensityZoneMap from "./common/DensityZoneMap.jsx";

function regionLabel(id = "") {
  return id.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function OverviewPanel({
  overview,
  demographics,
  history = [],
  connected,
  loading,
  onNavigate,
}) {
  const density = overview?.density;
  const people = overview?.people;
  const thresholds = density?.thresholds ?? { low: 3, high: 8 };
  const regions = density?.regions ?? [];

  const totalPeople = people?.total_records ?? "--";
  const settledCount = people?.settled ?? "--";
  const bestRawCount = people?.best_raw ?? "--";
  const lastResortCount = people?.last_resort ?? "--";

  const topGender = people?.top_demographics?.gender ?? "--";
  const topAge = people?.top_demographics?.age ?? "--";
  const topRace = people?.top_demographics?.race ?? "--";
  const topColor = people?.top_demographics?.clothing_color ?? "--";

  return (
    <div className="panel overview-panel">
      {/* Top Banner with Prototype Architecture Notice */}
      <div className="overview-notice-banner">
        <div className="notice-icon">ℹ️</div>
        <div className="notice-text">
          <strong>CrowdSense Dual Architecture:</strong> Spatial density monitoring and demographic profiling are operated as independent, task-optimized video modules. People detected in density zones are not 1:1 mapped to demographic face tracks.
        </div>
      </div>

      {/* Header with explicit StatusPill */}
      <div className="panel-header overview-header">
        <div>
          <span className="panel-kicker">Unified Operational Console</span>
          <h1 className="panel-title panel-title-large">System Overview</h1>
        </div>
        <div className="header-meta-group">
          <StatusPill
            status={density?.run_status ?? (connected ? "running" : "stopped")}
            updatedAt={density?.updated_at}
          />
        </div>
      </div>

      {/* 1. Primary KPI Row */}
      <div className="overview-hero-grid">
        <MetricCard
          label="Current Occupancy"
          value={density?.current_total ?? "--"}
          subtext="Total count across all monitored zones"
          trend={density?.trend_direction ?? "stable"}
          isPrimary={true}
          badge="Live Spatial"
        />

        <MetricCard
          label="Peak Occupancy"
          value={density?.peak_session ?? "--"}
          subtext="Max crowd volume recorded in session"
        />

        <MetricCard
          label="Busiest Zone"
          value={density?.busiest_zone ? regionLabel(density.busiest_zone) : "--"}
          subtext="Zone with highest immediate density"
        />

        <MetricCard
          label="People Analyzed"
          value={totalPeople}
          subtext="Demographic person profiles indexed"
          badge="Corridor Feed"
          onClick={() => onNavigate && onNavigate("people")}
        />
      </div>

      {/* 2. Middle Row: Visual Density Map (Left) + Live Regional State (Right) */}
      <div className="overview-spatial-row">
        {/* Left: Interactive Perspective Floor Zone Map */}
        <div className="spatial-col-map">
          <DensityZoneMap regions={regions} thresholds={thresholds} />
        </div>

        {/* Right: Live Regional State Cards */}
        <div className="spatial-col-cards">
          <div className="spatial-cards-header">
            <div>
              <h2 className="section-title">Live Regional State</h2>
              <span className="section-subtitle">Real-time zone occupancy vs safety thresholds</span>
            </div>
            <button
              type="button"
              className="section-nav-link"
              onClick={() => onNavigate && onNavigate("density")}
            >
              Full Density View &rarr;
            </button>
          </div>

          <div className="spatial-region-cards-list">
            {regions.map((reg) => (
              <RegionCard
                key={reg.region_id}
                region={reg}
                thresholds={thresholds}
              />
            ))}
          </div>
        </div>
      </div>

      {/* 3. Occupancy Trend Preview */}
      <div className="overview-section">
        <div className="overview-section-header">
          <div>
            <h2 className="section-title">Occupancy Trend</h2>
            <span className="section-subtitle">Real-time telemetry from active monitoring session</span>
          </div>
          <button
            type="button"
            className="section-nav-link"
            onClick={() => onNavigate && onNavigate("density")}
          >
            Multi-Zone Comparison &rarr;
          </button>
        </div>

        <div className="overview-chart-card">
          <TrendChart
            history={history}
            thresholds={thresholds}
            height={210}
            showModeToggle={false}
            initialMode="total"
          />
        </div>
      </div>

      {/* 4. Bottom Row: Demographic Snapshot (Left) + Inference Quality (Right) */}
      <div className="overview-two-col">
        {/* Left Col: Demographic Distribution Snapshot */}
        <div className="overview-card demographic-summary-card">
          <div className="overview-card-header">
            <div>
              <h3 className="card-title">Demographic Snapshot</h3>
              <span className="card-subtitle">Corridor face & clothing recognition overview</span>
            </div>
            <DataSourceBadge type="people" condensed={true} />
          </div>

          <div className="demographic-stats-grid">
            <div className="stat-pill">
              <span className="stat-label">Predominant Gender</span>
              <strong className="stat-value">{topGender}</strong>
            </div>
            <div className="stat-pill">
              <span className="stat-label">Primary Age Bracket</span>
              <strong className="stat-value">{topAge}</strong>
            </div>
            <div className="stat-pill">
              <span className="stat-label">Appearance Group</span>
              <strong className="stat-value">{topRace}</strong>
            </div>
            <div className="stat-pill">
              <span className="stat-label">Common Clothing Color</span>
              <strong className="stat-value">{topColor}</strong>
            </div>
          </div>

          {demographics && (
            <div className="demographic-distribution-bars">
              <div className="dist-group">
                <span className="dist-title">Gender Distribution</span>
                <div className="dist-bar-wrap">
                  {Object.entries(demographics.gender || {}).map(([key, count]) => {
                    const totalNum = typeof people?.total_records === "number" ? people.total_records : 0;
                    const pct = totalNum > 0 ? Math.round((count / totalNum) * 100) : 0;
                    return (
                      <div
                        key={key}
                        className={`dist-segment segment-${key.toLowerCase()}`}
                        style={{ width: `${pct}%` }}
                        title={`${key}: ${count} (${pct}%)`}
                      >
                        {pct > 15 && `${key} ${pct}%`}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="dist-group">
                <span className="dist-title">Age Brackets</span>
                <div className="age-tags">
                  {Object.entries(demographics.age || {}).map(([bracket, count]) => (
                    <span key={bracket} className="age-tag">
                      {bracket}: <strong>{count}</strong>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="card-footer-action">
            <button
              type="button"
              className="overview-action-btn"
              onClick={() => onNavigate && onNavigate("people")}
            >
              Explore Demographic Profiles &rarr;
            </button>
          </div>
        </div>

        {/* Right Col: Evidence & Quality Provenance */}
        <div className="overview-card quality-summary-card">
          <div className="overview-card-header">
            <div>
              <h3 className="card-title">Inference Provenance & Quality</h3>
              <span className="card-subtitle">Multi-frame temporal verification metrics</span>
            </div>
            <span className="badge badge-locked">{totalPeople !== "--" ? `${totalPeople} Tracks Indexed` : "Indexed Tracks"}</span>
          </div>

          <div className="quality-breakdown">
            <div className="quality-row quality-row-settled">
              <div className="quality-info">
                <span className="badge badge-settled">Confirmed (Settled)</span>
                <span className="quality-desc">Passed all quality checks and multi-frame stability gates</span>
              </div>
              <strong className="quality-num">{settledCount}</strong>
            </div>

            <div className="quality-row quality-row-raw">
              <div className="quality-info">
                <span className="badge badge-raw">Best Available</span>
                <span className="quality-desc">Acceptable sharpness but track departed before settling</span>
              </div>
              <strong className="quality-num">{bestRawCount}</strong>
            </div>

            <div className="quality-row quality-row-guess">
              <div className="quality-info">
                <span className="badge badge-guess">Low-Quality Guess</span>
                <span className="quality-desc">Brief or partially occluded track; marked low confidence</span>
              </div>
              <strong className="quality-num">{lastResortCount}</strong>
            </div>
          </div>

          <div className="provenance-advisory">
            <span className="advisory-icon">🔒</span>
            <p className="advisory-text">
              All demographic estimates are derived from research computer vision models (YOLOv8 + FairFace) and are intended for aggregate statistical analysis.
            </p>
          </div>

          <div className="card-footer-action">
            <button
              type="button"
              className="overview-action-btn"
              onClick={() => onNavigate && onNavigate("split")}
            >
              Open Split Console View &rarr;
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
