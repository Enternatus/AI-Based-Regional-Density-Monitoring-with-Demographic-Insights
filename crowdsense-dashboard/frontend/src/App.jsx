import React, { useEffect, useState } from "react";
import OverviewPanel from "./components/OverviewPanel.jsx";
import DensityPanel from "./components/DensityPanel.jsx";
import SearchPanel from "./components/SearchPanel.jsx";
import DataSourceBadge from "./components/common/DataSourceBadge.jsx";
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

  // Centralized dashboard polling orchestrator: single periodic request stream
  useEffect(() => {
    let cancelled = false;

    async function pollDashboard() {
      try {
        const [ovData, histData, demoData] = await Promise.all([
          getOverview(),
          getDensityHistory(30),
          getPeopleSummary(),
        ]);
        if (!cancelled) {
          setDashboardState({
            overview: ovData,
            density: ovData?.density,
            history: histData?.history || [],
            demographics: demoData,
            connected: true,
            loading: false,
          });
        }
      } catch (err) {
        console.warn("Dashboard polling error:", err);
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
          <div className="split-view-container">
            {/* Left Module: Wide-Angle Density */}
            <div className="split-column split-left-column">
              <div className="split-column-header">
                <DataSourceBadge type="density" />
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

            {/* Right Module: Close-Range Demographic */}
            <div className="split-column split-right-column">
              <div className="split-column-header">
                <DataSourceBadge type="people" />
                <button
                  type="button"
                  className="split-nav-cta"
                  onClick={() => setView("people")}
                  title="Expand to full People Explorer"
                >
                  Full Explorer &rarr;
                </button>
              </div>
              <SearchPanel />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
