import React from "react";

function timeAgo(isoString) {
  if (!isoString) return "never";
  const then = new Date(isoString.includes("T") ? isoString : isoString.replace(" ", "T"));
  if (Number.isNaN(then.getTime())) return isoString;
  const seconds = Math.max(0, Math.round((Date.now() - then.getTime()) / 1000));
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  return `${Math.round(seconds / 60)}m ago`;
}

export default function StatusPill({ status = "idle", updatedAt, frameIndex }) {
  const ago = timeAgo(updatedAt);

  if (status === "running") {
    return (
      <span className="status-pill status-pill-running" title="Pipeline is actively processing frames">
        <span className="status-dot status-dot-running" />
        <span className="status-text">LIVE · updated {ago}</span>
      </span>
    );
  }

  if (status === "completed") {
    return (
      <span className="status-pill status-pill-completed" title="Video stream processing finished">
        <span className="status-dot status-dot-completed" />
        <span className="status-text">RUN COMPLETED · {frameIndex ? `frame ${frameIndex} · ` : ""}{ago}</span>
      </span>
    );
  }

  if (status === "stopped") {
    return (
      <span className="status-pill status-pill-stopped" title="Pipeline was paused or stopped">
        <span className="status-dot status-dot-stopped" />
        <span className="status-text">PAUSED · last update {ago}</span>
      </span>
    );
  }

  return (
    <span className="status-pill status-pill-idle" title="No active pipeline run">
      <span className="status-dot status-dot-idle" />
      <span className="status-text">IDLE · waiting for feed</span>
    </span>
  );
}
