import React, { useEffect, useState } from "react";
import OverviewPanel from "./components/OverviewPanel.jsx";
import DensityPanel from "./components/DensityPanel.jsx";
import SearchPanel from "./components/SearchPanel.jsx";
import DataSourceBadge from "./components/common/DataSourceBadge.jsx";
import { getDensity } from "./api/crowdsense.js";

export default function App() {
  const [density, setDensity] = useState(null);
  const [connected, setConnected] = useState(false);
  const [clock, setClock] = useState(new Date());
  const [view, setView] = useState("overview"); // "overview" | "density" | "people" | "split"

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const data = await getDensity();
        if (!cancelled) {
          setDensity(data);
          setConnected(true);
        }
      } catch {
        if (!cancelled) setConnected(false);
      }
    }

    poll();
    const interval = setInterval(poll, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="console">
      {/* Top Navbar */}
      <header className="topbar">
        <div className="topbar-left">
          <span className="topbar-title">CROWDSENSE</span>
          <span className="topbar-badge">v2.0</span>
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
          <OverviewPanel onNavigate={(dest) => setView(dest)} connected={connected} />
        )}

        {view === "density" && (
          <DensityPanel data={density} connected={connected} />
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
              <DensityPanel data={density} connected={connected} />
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
