import React from "react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("CrowdSense caught a UI error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            padding: "40px 24px",
            textAlign: "center",
            maxWidth: "600px",
            margin: "60px auto",
            background: "var(--panel, #111827)",
            border: "1px solid var(--border, #1f2937)",
            borderRadius: "8px",
            color: "var(--text, #f9fafb)",
          }}
        >
          <div style={{ fontSize: "36px", marginBottom: "12px" }}>⚠️</div>
          <h2 style={{ fontSize: "18px", marginBottom: "8px", color: "var(--amber, #f59e0b)" }}>
            Something went wrong rendering this view
          </h2>
          <p style={{ fontSize: "13px", color: "var(--text-dim, #9ca3af)", marginBottom: "20px" }}>
            {this.state.error?.message || "An unexpected error occurred."}
          </p>
          <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
            <button
              type="button"
              onClick={() => {
                this.setState({ hasError: false, error: null });
                if (this.props.onReset) this.props.onReset();
              }}
              style={{
                background: "var(--panel-raised, #1f2937)",
                border: "1px solid var(--cyan, #38bdf8)",
                color: "var(--cyan, #38bdf8)",
                padding: "8px 16px",
                borderRadius: "4px",
                cursor: "pointer",
                fontSize: "12px",
              }}
            >
              Try Again
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                background: "var(--panel-raised, #1f2937)",
                border: "1px solid var(--border, #374151)",
                color: "var(--text, #f9fafb)",
                padding: "8px 16px",
                borderRadius: "4px",
                cursor: "pointer",
                fontSize: "12px",
              }}
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
