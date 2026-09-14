import React, { useEffect, useState } from "react";
import Header from "./components/Header.jsx";
import Nav from "./components/Nav.jsx";
import ErrorBoundary from "./components/common/ErrorBoundary.jsx";
import OverviewPage from "./pages/OverviewPage.jsx";
import DensityPage from "./pages/DensityPage.jsx";
import PeoplePage from "./pages/PeoplePage.jsx";
import SplitPage from "./pages/SplitPage.jsx";
import { getOverview, getDensity, getDensityHistory, getPeopleSummary } from "./api/crowdsense.js";

export default function App() {
  const [dashboardState, setDashboardState] = useState({
    overview: null,
    density: null,
    history: [],
    demographics: null,
    connected: false,
    loading: true,
  });

  const [view, setView] = useState("overview"); // "overview" | "density" | "people" | "split"

  // Centralized dashboard polling orchestrator: single periodic request stream (5s)
  useEffect(() => {
    let cancelled = false;

    async function pollDashboard() {
      try {
        const results = await Promise.allSettled([
          getOverview(),
          getDensity(),
          getDensityHistory(30),
          getPeopleSummary(),
        ]);

        if (cancelled) return;

        const [ovRes, densRes, histRes, demoRes] = results;
        const anySuccess = results.some((r) => r.status === "fulfilled");

        setDashboardState((prev) => {
          const nextOverview = ovRes.status === "fulfilled" ? ovRes.value : prev.overview;
          const nextDensity =
            densRes.status === "fulfilled"
              ? densRes.value
              : nextOverview?.density ?? prev.density;
          const nextHistory =
            histRes.status === "fulfilled"
              ? histRes.value?.history || histRes.value?.snapshots || []
              : prev.history;
          const nextDemographics =
            demoRes.status === "fulfilled" ? demoRes.value : prev.demographics;

          return {
            overview: nextOverview,
            density: nextDensity,
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
    // Poll every 1.0s for tight, responsive synchronization with crowd monitor
    const interval = setInterval(pollDashboard, 1000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="flex flex-col h-screen bg-[#090b0e] text-[#e2e8f0] overflow-hidden font-sans">
      <Header connected={dashboardState.connected} />
      <Nav active={view} onChange={setView} />
      <main className="flex-1 overflow-y-auto">
        <ErrorBoundary>
          {view === "overview" && (
            <OverviewPage dashboardState={dashboardState} onNavigate={setView} />
          )}
          {view === "density" && <DensityPage dashboardState={dashboardState} />}
          {view === "people" && <PeoplePage dashboardState={dashboardState} />}
          {view === "split" && <SplitPage dashboardState={dashboardState} />}
        </ErrorBoundary>
      </main>
    </div>
  );
}
