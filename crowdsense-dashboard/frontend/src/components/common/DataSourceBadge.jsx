import React from "react";

export default function DataSourceBadge({ type = "density", condensed = false }) {
  if (type === "density") {
    return (
      <div className={`data-source-badge density-source ${condensed ? "condensed" : ""}`}>
        <span className="source-tag">Wide-Angle Source</span>
        <span className="source-detail">
          {condensed ? "sample_crowd.mp4" : "sample_crowd.mp4 · Multi-Zone Spatial Detection"}
        </span>
      </div>
    );
  }

  return (
    <div className={`data-source-badge people-source ${condensed ? "condensed" : ""}`}>
      <span className="source-tag">Close-Range Source</span>
      <span className="source-detail">
        {condensed ? "close_range_crowd.mp4" : "close_range_crowd.mp4 · FairFace Corridor Tracking"}
      </span>
    </div>
  );
}
