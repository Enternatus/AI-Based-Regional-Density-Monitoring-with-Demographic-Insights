import React from "react";

export default function DensityZoneMap({ regions = [], thresholds = { low: 3, high: 8 } }) {
  const lowThresh = thresholds?.low ?? 3;
  const highThresh = thresholds?.high ?? 8;

  function getLevel(count) {
    if (count > highThresh) return "high";
    if (count > lowThresh) return "medium";
    return "low";
  }

  // Look up region by id or fallback to empty
  const leftReg = regions.find((r) => r.region_id === "left_walkway") || regions[0] || { display_name: "Left Walkway", count: 0 };
  const centerReg = regions.find((r) => r.region_id === "central_plaza") || regions[1] || { display_name: "Central Plaza", count: 0 };
  const rightReg = regions.find((r) => r.region_id === "right_walkway") || regions[2] || { display_name: "Right Walkway", count: 0 };

  const leftLevel = getLevel(leftReg.count);
  const centerLevel = getLevel(centerReg.count);
  const rightLevel = getLevel(rightReg.count);

  return (
    <div className="density-zone-map-card">
      <div className="zone-map-header">
        <div>
          <span className="zone-map-kicker">Spatial Camera Projection</span>
          <h3 className="zone-map-title">Floor Zone Map</h3>
        </div>
        <span className="zone-map-badge">Perspective Grid</span>
      </div>

      <div className="zone-map-canvas">
        {/* Perspective floor grid lines in background */}
        <div className="zone-grid-background" />

        <div className="zones-container">
          {/* Left Walkway Zone Box */}
          <div className={`zone-box zone-${leftLevel}`} style={{ borderColor: leftReg.accent || "#38bdf8" }}>
            <div className="zone-box-label">{leftReg.display_name || "Left Walkway"}</div>
            <div className="zone-box-count">{leftReg.count}</div>
            <span className={`zone-box-pill pill-${leftLevel}`}>{leftLevel.toUpperCase()}</span>
          </div>

          {/* Central Plaza Zone Box */}
          <div className={`zone-box zone-${centerLevel}`} style={{ borderColor: centerReg.accent || "#a855f7" }}>
            <div className="zone-box-label">{centerReg.display_name || "Central Plaza"}</div>
            <div className="zone-box-count">{centerReg.count}</div>
            <span className={`zone-box-pill pill-${centerLevel}`}>{centerLevel.toUpperCase()}</span>
          </div>

          {/* Right Walkway Zone Box */}
          <div className={`zone-box zone-${rightLevel}`} style={{ borderColor: rightReg.accent || "#f59e0b" }}>
            <div className="zone-box-label">{rightReg.display_name || "Right Walkway"}</div>
            <div className="zone-box-count">{rightReg.count}</div>
            <span className={`zone-box-pill pill-${rightLevel}`}>{rightLevel.toUpperCase()}</span>
          </div>
        </div>

        {/* Camera perspective directional indicator */}
        <div className="camera-projection-origin">
          <span className="camera-icon">📷</span>
          <span className="camera-label">Fixed Monocular Camera Vector</span>
        </div>
      </div>
    </div>
  );
}
