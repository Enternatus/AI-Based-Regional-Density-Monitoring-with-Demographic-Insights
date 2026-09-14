import React, { useState, useEffect } from "react";
import { Card, StatusPill, Mono, Divider } from "../components/ui.jsx";
import { cropUrl } from "../api/crowdsense.js";

const ratioOptions = [
  { id: "30/70", label: "Demographics Focus", desc: "30 / 70", left: 30, right: 70 },
  { id: "20/80", label: "Demographics Max", desc: "20 / 80", left: 20, right: 80 },
  { id: "50/50", label: "Equal", desc: "50 / 50", left: 50, right: 50 },
];

function PanelHeader({ label, sub, variant }) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#1e2733] shrink-0 bg-[#0d1117]">
      <div className="flex items-center gap-2.5">
        <span
          className={`w-1.5 h-1.5 rounded-full ${
            variant === "density" ? "bg-cyan-400" : "bg-violet-400"
          } animate-pulse`}
        />
        <div>
          <p
            className={`text-[11px] font-semibold ${
              variant === "density" ? "text-cyan-400" : "text-violet-400"
            }`}
          >
            {label}
          </p>
          <p className="text-[10px] text-slate-600">{sub}</p>
        </div>
      </div>
      <StatusPill variant={variant === "density" ? "cyan" : "violet"}>
        {variant === "density" ? "Spatial Pipeline" : "Demographic Pipeline"}
      </StatusPill>
    </div>
  );
}

function DensityPanel({ density, history }) {
  const currentTotal = density?.current_total ?? "--";
  const regions = density?.regions || [];
  const sourceVideo = density?.source_video || "sample_crowd.mp4";

  return (
    <div className="h-full flex flex-col bg-[#090b0e] border border-[#1e2733] rounded overflow-hidden">
      <PanelHeader
        label="Wide-Angle Spatial Density"
        sub="Crowd counting · Zone monitoring"
        variant="density"
      />
      {/* Live Stream or High-res source */}
      <div className="flex-1 bg-[#060809] relative overflow-hidden flex items-center justify-center">
        <img
          src="http://127.0.0.1:8000/api/stream/density"
          alt="Wide-Angle Camera Stream"
          className="w-full h-full object-contain"
          onError={(e) => {
            e.target.style.display = "none";
            e.target.nextSibling.style.display = "flex";
          }}
        />
        <div className="hidden w-full h-full flex-col items-center justify-center p-6 text-center text-slate-500">
          <span className="text-3xl mb-2">📹</span>
          <p className="font-mono text-xs text-cyan-400 mb-1">DENSITY MONITOR · WIDE-ANGLE</p>
          <p className="text-[11px] text-slate-600">{sourceVideo} · Fixed Perspective</p>
        </div>
      </div>
      {/* Metadata strip */}
      <div className="flex items-center gap-4 px-4 py-2 bg-[#0d1117] border-t border-[#1e2733] shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-mono tracking-widest uppercase text-slate-600">TOTAL</span>
          <span className="text-sm font-semibold font-mono text-cyan-400 tabular-nums">
            {currentTotal}
          </span>
        </div>
        <Divider className="h-4 border-l border-t-0 border-[#1e2733]" />
        <Mono className="text-slate-500 truncate">
          {regions.length > 0
            ? regions
                .map((r) => `${r.name || r.region_id}: ${r.count}`)
                .join(" · ")
            : "Zones active"}
        </Mono>
      </div>
    </div>
  );
}

function DemoPanel({ demographics }) {
  const totalAnalyzed = demographics?.total_records ?? demographics?.total ?? 0;
  const genderBreak = demographics?.gender || {};
  const totalG = (genderBreak.Male || 0) + (genderBreak.Female || 0) || 1;
  const mPct = Math.round(((genderBreak.Male || 0) / totalG) * 100);
  const fPct = Math.round(((genderBreak.Female || 0) / totalG) * 100);

  // Dynamic demographic metrics from active pipeline
  const ageBreak = demographics?.age || {};
  const topAge = Object.entries(ageBreak).sort((a, b) => b[1] - a[1])[0]?.[0] || "20-29";
  const raceBreak = demographics?.race || {};
  const topRaces = Object.keys(raceBreak).slice(0, 2).join(" / ") || "White / East Asian";
  const colorBreak = demographics?.clothing_color || {};
  const topColors =
    Object.keys(colorBreak)
      .slice(0, 2)
      .map((c) => c.charAt(0).toUpperCase() + c.slice(1))
      .join(" / ") || "Black / Grey";

  // Dynamic recent persons list from real-time monitoring feed
  const livePersons = demographics?.recent_persons || [];
  const displayPersons =
    livePersons.length > 0
      ? livePersons.slice(0, 12)
      : [1, 3, 5, 8, 12, 16].map((id) => ({
          person_id: String(id),
          id: String(id),
          gender: id === 8 || id === 16 ? "Female" : "Male",
          age: "20-29",
          clothing_color: id === 8 ? "red" : id === 5 ? "yellow" : "black",
        }));

  return (
    <div className="h-full flex flex-col bg-[#090b0e] border border-[#1e2733] rounded overflow-hidden">
      <PanelHeader
        label="Close-Range Demographic & Gender Monitor"
        sub="Attribute inference · Close-range corridor"
        variant="demo"
      />
      <div className="flex-1 bg-[#060809] p-4 overflow-y-auto">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
          {displayPersons.map((p) => {
            const id = p.person_id || p.id;
            const genderColor =
              p.gender === "Male"
                ? "text-cyan-400"
                : p.gender === "Female"
                ? "text-violet-400"
                : "text-slate-400";
            return (
              <div
                key={id}
                className="bg-[#0f1318] border border-[#1e2733] rounded p-2 flex flex-col items-center hover:border-slate-600 transition-colors"
              >
                <div className="w-full aspect-[3/4] bg-[#090b0e] rounded overflow-hidden mb-2 relative">
                  <img
                    src={cropUrl(id)}
                    alt={`Person ${id}`}
                    className="w-full h-full object-cover object-top"
                    onLoad={(e) => {
                      e.target.style.opacity = "1";
                    }}
                    onError={(e) => {
                      e.target.style.opacity = "0.2";
                    }}
                  />
                </div>
                <span className="font-mono text-[10px] text-slate-200 font-semibold">TRK-{id}</span>
                <span className={`font-mono text-[9px] ${genderColor}`}>
                  {p.gender || "Detecting"} {p.age ? `· ${p.age}` : ""}
                </span>
                <span className="font-mono text-[8px] text-slate-500 capitalize">
                  {p.clothing_color ? `Shirt: ${p.clothing_color}` : ""}
                </span>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#0d1117] p-3 rounded border border-[#1e2733]">
          <div>
            <span className="text-[9px] font-mono uppercase text-slate-500 block">
              GENDER RATIO
            </span>
            <span className="font-mono text-xs text-slate-200">
              Male {mPct}% · Female {fPct}%
            </span>
          </div>
          <div>
            <span className="text-[9px] font-mono uppercase text-slate-500 block">TOP BRACKET</span>
            <span className="font-mono text-xs text-slate-200">{topAge} Years</span>
          </div>
          <div>
            <span className="text-[9px] font-mono uppercase text-slate-500 block">
              TOP APPEARANCE
            </span>
            <span className="font-mono text-xs text-slate-200">{topRaces}</span>
          </div>
          <div>
            <span className="text-[9px] font-mono uppercase text-slate-500 block">
              COMMON CLOTHING
            </span>
            <span className="font-mono text-xs text-slate-200">{topColors}</span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-4 px-4 py-2 bg-[#0d1117] border-t border-[#1e2733] shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-mono tracking-widest uppercase text-slate-600">
            ANALYZED
          </span>
          <span className="text-sm font-semibold font-mono text-violet-400 tabular-nums">
            {totalAnalyzed}
          </span>
        </div>
        <Divider className="h-4 border-l border-t-0 border-[#1e2733]" />
        <Mono className="text-slate-500">
          Male: {mPct}% · Female: {fPct}%
        </Mono>
      </div>
    </div>
  );
}

export default function SplitPage({ dashboardState = {} }) {
  const [ratio, setRatio] = useState(() => {
    return localStorage.getItem("crowdsense_split_ratio") || "30/70";
  });

  useEffect(() => {
    localStorage.setItem("crowdsense_split_ratio", ratio);
  }, [ratio]);

  const active = ratioOptions.find((r) => r.id === ratio) || ratioOptions[0];

  return (
    <div className="p-5 flex flex-col gap-4 h-full max-w-[1440px] mx-auto">
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div>
          <p className="text-[9px] font-mono tracking-widest uppercase text-slate-500 mb-0.5">
            Split View — Dual Pipeline Monitor
          </p>
          <p className="text-[11px] text-slate-500">
            Two independent video analysis modules displayed simultaneously.
          </p>
        </div>
        {/* Ratio selector */}
        <div className="flex items-center gap-1 bg-[#0d1117] border border-[#1e2733] rounded p-0.5">
          {ratioOptions.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setRatio(r.id)}
              className={`px-3 py-1.5 rounded text-[11px] font-mono transition-all cursor-pointer ${
                ratio === r.id
                  ? "bg-cyan-500/10 border border-cyan-500/30 text-cyan-400"
                  : "text-slate-500 hover:text-slate-300 border border-transparent"
              }`}
            >
              {r.label} <span className="opacity-60">({r.desc})</span>
            </button>
          ))}
        </div>
      </div>

      {/* Split panels */}
      <div className="flex gap-3 flex-1 min-h-0" style={{ minHeight: 480 }}>
        <div style={{ flex: active.left }} className="min-w-0">
          <DensityPanel
            density={dashboardState.density}
            history={dashboardState.history}
          />
        </div>
        <div style={{ flex: active.right }} className="min-w-0">
          <DemoPanel demographics={dashboardState.demographics} />
        </div>
      </div>

      {/* Pipeline independence notice */}
      <div className="flex items-start gap-3 px-4 py-3 bg-[#0d1117] border border-[#1e2733] rounded shrink-0">
        <span className="text-[10px] font-mono tracking-widest uppercase text-slate-600 mt-0.5 shrink-0">
          Pipeline Note
        </span>
        <p className="text-[11px] text-slate-500 leading-relaxed">
          These panels display independent video pipelines. The left feed uses a wide-angle lens for
          spatial crowd density; the right uses close-range captures for demographic attribute
          inference. Counts and tracks are not cross-referenced — do not treat them as linked records.
        </p>
      </div>
    </div>
  );
}
