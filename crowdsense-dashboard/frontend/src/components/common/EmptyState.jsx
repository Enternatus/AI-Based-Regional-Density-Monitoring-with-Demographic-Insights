import React from "react";

export default function EmptyState({ icon = "🔍", title, message, actionText, onAction }) {
  return (
    <div className="empty-state-card">
      <div className="empty-state-icon">{icon}</div>
      <h3 className="empty-state-title">{title}</h3>
      {message && <p className="empty-state-message">{message}</p>}
      {actionText && onAction && (
        <button type="button" className="empty-state-btn" onClick={onAction}>
          {actionText}
        </button>
      )}
    </div>
  );
}
