import React, { useEffect, useState } from "react";

export default function Header({ connected = true }) {
  const [clock, setClock] = useState("");

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setClock(now.toLocaleTimeString("en-GB", { hour12: false }));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <header className="flex items-center justify-between px-5 h-12 bg-[#090b0e] border-b border-[#1e2733] shrink-0 z-50">
      {/* Left — wordmark */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          {/* Geometric logo mark */}
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <rect x="1" y="1" width="8" height="8" rx="1" stroke="#06b6d4" strokeWidth="1.4" />
            <rect x="11" y="1" width="8" height="8" rx="1" stroke="#06b6d4" strokeWidth="1.4" opacity="0.5" />
            <rect x="1" y="11" width="8" height="8" rx="1" stroke="#06b6d4" strokeWidth="1.4" opacity="0.5" />
            <rect x="11" y="11" width="8" height="8" rx="1" fill="#06b6d4" opacity="0.2" stroke="#06b6d4" strokeWidth="1.4" />
          </svg>
          <span className="text-sm font-semibold tracking-tight text-slate-100">CrowdSense</span>
        </div>
        <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-cyan-950/50 border border-cyan-800/50 text-cyan-400 tracking-widest">
          V2.1
        </span>
        <span className="hidden sm:block text-[11px] text-slate-500 border-l border-[#1e2733] pl-3 ml-0">
          Operational Crowd &amp; Demographic Intelligence
        </span>
      </div>

      {/* Right — system indicators */}
      <div className="flex items-center gap-4">
        {/* Connection indicator */}
        <div className="flex items-center gap-1.5">
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              connected ? "bg-green-400 animate-pulse" : "bg-amber-400"
            }`}
          />
          <span
            className={`font-mono text-[10px] uppercase tracking-widest ${
              connected ? "text-green-400" : "text-amber-400"
            }`}
          >
            {connected ? "Backend · Connected" : "Backend · Retrying"}
          </span>
        </div>
        <div className="h-3.5 border-l border-[#1e2733]" />
        {/* Clock */}
        <span className="font-mono text-[11px] text-slate-400 tabular-nums">{clock}</span>
      </div>
    </header>
  );
}
