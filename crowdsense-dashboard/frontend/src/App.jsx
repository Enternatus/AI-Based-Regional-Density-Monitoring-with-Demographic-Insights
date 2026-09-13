import React, { useEffect, useState } from "react";
import OverviewPanel from "./components/OverviewPanel.jsx";
import DensityPanel from "./components/DensityPanel.jsx";
import SearchPanel from "./components/SearchPanel.jsx";
import DataSourceBadge from "./components/common/DataSourceBadge.jsx";
import ErrorBoundary from "./components/common/ErrorBoundary.jsx";
import { getOverview, getDensityHistory, getPeopleSummary } from "./api/crowdsense.js";

export default function App() {
  const [dashboardState, setDashboardState] = useState({
    overview: null,
    density: null,
    history: [],
    demographics: null,
    connected: false,
    loading: true,
  });
  const [clock, setClock] = useState(new Date());
  const [view, setView] = useState("overview"); // "overview" | "density" | "people" | "split"
  const [splitRatio, setSplitRatio] = useState(() => {
    try {
      return localStorage.getItem("crowdsense_split_ratio") || "focus";
    } catch {
      return "focus";
    }
  });

  function handleSplitRatio(ratio) {
    setSplitRatio(ratio);
    try {
      localStorage.setItem("crowdsense_split_ratio", ratio);
    } catch {
      /* ignore */
    }
  }

  // Centralized dashboard polling orchestrator: single periodic request stream
  useEffect(() => {
    let cancelled = false;

    async function pollDashboard() {
      try {
        const results = await Promise.allSettled([
          getOverview(),
          getDensityHistory(30),
          getPeopleSummary(),
        ]);

        if (cancelled) return;

        const [ovRes, histRes, demoRes] = results;
        const anySuccess = results.some((r) => r.status === "fulfilled");

        setDashboardState((prev) => {
          const nextOverview = ovRes.status === "fulfilled" ? ovRes.value : prev.overview;
          const nextHistory = histRes.status === "fulfilled" ? (histRes.value?.history || []) : prev.history;
          const nextDemographics = demoRes.status === "fulfilled" ? demoRes.value : prev.demographics;

          return {
            overview: nextOverview,
            density: nextOverview?.density ?? prev.density,
            history: nextHistory,
            demographics: nextDemographics,
            connected: anySuccess,
            loading: false,
          };
        });
      } catch (err) {
        console.warn("Dashboard polling orchestrator error:", err);
        if (!cancelled) {
          setDashboardState((prev) => ({
            ...prev,
            connected: false,
            loading: false,
          }));
        }
      }
    }

    pollDashboard();
    const interval = setInterval(pollDashboard, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const { overview, density, history, demographics, connected, loading } = dashboardState;

  return (
    <div className="console">
      {/* Top Navbar */}
      <header className="topbar">
        <div className="topbar-left">
          <span className="topbar-title">CROWDSENSE</span>
          <span className="topbar-badge">v2.1</span>
          <span className="topbar-subtitle">Operational Crowd & Demographic Intelligence</span>
        </div>
        <div className="topbar-right">
          <span className="connection-status">
            <span className={`live-dot ${connected ? "" : "stale"}`} />
            {connected ? "Backend Connected (Port 8000)" : "Backend Offline / Retrying"}
          </span>
          <span className="system-clock">{clock.toLocaleTimeString()}</span>
        </div>
      </header>

      {/* Primary Navigation Tabs */}
      <nav className="view-switcher" aria-label="Main Navigation">
        <button
          type="button"
          className={`view-button ${view === "overview" ? "active" : ""}`}
          onClick={() => setView("overview")}
        >
          <span className="btn-icon">📊</span> Overview
        </button>
        <button
          type="button"
          className={`view-button ${view === "density" ? "active" : ""}`}
          onClick={() => setView("density")}
        >
          <span className="btn-icon">📈</span> Density Monitor
        </button>
        <button
          type="button"
          className={`view-button ${view === "people" ? "active" : ""}`}
          onClick={() => setView("people")}
        >
          <span className="btn-icon">👤</span> People Explorer
        </button>
        <button
          type="button"
          className={`view-button ${view === "split" ? "active" : ""}`}
          onClick={() => setView("split")}
        >
          <span className="btn-icon">⚇</span> Split View
        </button>
      </nav>

      {/* Main View Port */}
      <main className={`main ${view === "split" ? "main-split" : "main-full"}`}>
        <ErrorBoundary onReset={() => setView("overview")}>
          {view === "overview" && (
            <OverviewPanel
              overview={overview}
              demographics={demographics}
              history={history}
              connected={connected}
              loading={loading}
              onNavigate={(dest) => setView(dest)}
            />
          )}

          {view === "density" && (
            <DensityPanel
              data={density}
              historyProp={history}
              connected={connected}
            />
          )}

          {view === "people" && (
            <SearchPanel />
          )}

          {view === "split" && (
            <div className="split-view-wrapper">
              {/* Split Screen Allocation Toolbar */}
              <div className="split-view-toolbar">
                <div className="split-toolbar-info">
                  <span className="split-toolbar-badge">DUAL STREAM</span>
                  <span className="split-toolbar-title">
                    Density Telemetry (Wide-Angle) + Gender &amp; Demographic Tracking (Close-Range)
                  </span>
                </div>
                <div className="split-ratio-controls" role="group" aria-label="Split Screen Allocation">
                  <span className="split-ratio-label">Screen Share:</span>
                  <button
                    type="button"
                    className={`split-ratio-btn ${splitRatio === "focus" ? "active" : ""}`}
                    onClick={() => handleSplitRatio("focus")}
                    title="Allocates ~70% screen to Gender Monitor & Demographics (Recommended)"
                  >
                    Demographics Focus (30 / 70)
                  </button>
                  <button
                    type="button"
                    className={`split-ratio-btn ${splitRatio === "max" ? "active" : ""}`}
                    onClick={() => handleSplitRatio("max")}
                    title="Allocates ~80% screen to Gender Monitor & Demographics (Max Cards)"
                  >
                    Demographics Max (20 / 80)
                  </button>
                  <button
                    type="button"
                    className={`split-ratio-btn ${splitRatio === "balanced" ? "active" : ""}`}
                    onClick={() => handleSplitRatio("balanced")}
                    title="Equal 50 / 50 split"
                  >
                    Equal (50 / 50)
                  </button>
                </div>
              </div>

              <div className={`split-view-container ratio-${splitRatio}`}>
                {/* Left Module: Wide-Angle Density */}
                <div className="split-column split-left-column">
                  <div className="split-column-header">
                    <span className="split-column-tag">Spatial Density (Wide-Angle)</span>
                    <button
                      type="button"
                      className="split-nav-cta"
                      onClick={() => setView("density")}
                      title="Expand to full Density Monitor"
                    >
                      Full Density &rarr;
                    </button>
                  </div>
                  <DensityPanel
                    data={density}
                    historyProp={history}
                    connected={connected}
                  />
                </div>

                {/* Right Module: Close-Range Demographic & Gender Monitor */}
                <div className="split-column split-right-column">
                  <div className="split-column-header">
                    <span className="split-column-tag tag-demo">Demographic &amp; Gender Monitor (Close-Range)</span>
                    <button
                      type="button"
                      className="split-nav-cta"
                      onClick={() => setView("people")}
                      title="Expand to full Demographic & Gender Explorer"
                    >
                      Full Explorer &rarr;
                    </button>
                  </div>
                  <SearchPanel />
                </div>
              </div>
            </div>
          )}
        </ErrorBoundary>
      </main>
    </div>
  );
}
