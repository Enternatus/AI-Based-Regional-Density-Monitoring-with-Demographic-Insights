import { useEffect, useState } from "react";
import DensityPanel from "./components/DensityPanel.jsx";
import SearchPanel from "./components/SearchPanel.jsx";
import { fetchDensity } from "./api.js";

export default function App() {
  const [density, setDensity] = useState(null);
  const [connected, setConnected] = useState(false);
  const [clock, setClock] = useState(new Date());
  const [view, setView] = useState("split"); // "density" | "people" | "split"

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const data = await fetchDensity();
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
      <div className="topbar">
        <div className="topbar-left">
          <span className="topbar-title">CROWDSENSE</span>
          <span className="topbar-subtitle">ops console</span>
        </div>
        <div className="topbar-right">
          <span>
            <span className={`live-dot ${connected ? "" : "stale"}`} />
            {connected ? "backend connected" : "backend unreachable"}
          </span>
          <span>{clock.toLocaleTimeString()}</span>
        </div>
      </div>

      <div className="view-switcher">
        <button className={`view-button ${view === "split" ? "active" : ""}`} onClick={() => setView("split")}>
          Split View
        </button>
        <button className={`view-button ${view === "density" ? "active" : ""}`} onClick={() => setView("density")}>
          Density
        </button>
        <button className={`view-button ${view === "people" ? "active" : ""}`} onClick={() => setView("people")}>
          People
        </button>
      </div>

      <div className={`main ${view === "split" ? "main-split" : "main-full"}`}>
        {(view === "density" || view === "split") && (
          <div className={view === "split" ? "split-left" : ""}>
            <DensityPanel data={density} connected={connected} />
          </div>
        )}
        {(view === "people" || view === "split") && (
          <div className={view === "split" ? "split-right" : ""}>
            <SearchPanel />
          </div>
        )}
      </div>
    </div>
  );
}
