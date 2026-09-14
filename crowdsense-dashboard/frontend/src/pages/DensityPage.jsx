import React, { useState, useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import {
  runData as mockRun,
  kpiData as mockKpi,
  regions as mockRegions,
  trendSnapshots as mockSnapshots,
} from "../data/mockData.js";
import {
  Card,
  SectionLabel,
  StatusPill,
  DensityBadge,
  TrendIndicator,
  MiniBar,
  Mono,
  Divider,
} from "../components/ui.jsx";

const feedOptions = [
  { id: "chart", label: "📊 Trend Chart", sub: "Historical density telemetry" },
  { id: "annotated", label: "📹 Live Annotated Stream", sub: "Wide-Angle Density · MJPEG Stream" },
  { id: "raw", label: "▶️ Raw Source Video", sub: "Unannotated perspective video" },
];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#0f1318] border border-[#1e2733] rounded p-2.5 text-[11px] font-mono">
      <p className="text-slate-500 mb-1.5">T · {label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  );
};

function FeedSwitcher({ active, onChange }) {
  return (
    <div className="flex gap-1 p-0.5 bg-[#0d1117] border border-[#1e2733] rounded w-fit">
      {feedOptions.map((f) => (
        <button
          key={f.id}
          type="button"
          onClick={() => onChange(f.id)}
          className={`px-3.5 py-1.5 rounded text-[11px] font-medium transition-all duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-500 cursor-pointer ${
            active === f.id
              ? "bg-cyan-500/10 border border-cyan-500/30 text-cyan-400"
              : "text-slate-500 hover:text-slate-300 border border-transparent"
          }`}
        >
          {f.label}
        </button>
      ))}
    </div>
  );
}

function TrendFeed({ historyData }) {
  const chartData = useMemo(() => {
    if (!historyData || historyData.length === 0) return mockSnapshots;
    return historyData.map((h, i) => {
      const timeStr = h.timestamp
        ? new Date(h.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        : `T-${historyData.length - i}`;
      const rc = h.region_counts || {};
      const regKeys = Object.keys(rc);
      return {
        frame: h.frame_index ?? i * 30,
        time: timeStr,
        total: h.total_count ?? 0,
        zone_a: rc[regKeys[0]] ?? 0,
        zone_b: rc[regKeys[1]] ?? 0,
        zone_c: rc[regKeys[2]] ?? 0,
      };
    });
  }, [historyData]);

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          {[
            ["Total", "#06b6d4"],
            ["Zone A", "#f59e0b"],
            ["Zone B", "#8b5cf6"],
            ["Zone C", "#22c55e"],
          ].map(([name, color]) => (
            <div key={name} className="flex items-center gap-1.5">
              <span
                className="w-2 h-0.5 rounded-full inline-block"
                style={{ backgroundColor: color }}
              />
              <span className="text-[10px] font-mono text-slate-500">{name}</span>
            </div>
          ))}
        </div>
        <Mono className="text-slate-600">{chartData.length} snapshots · Active Session</Mono>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
          <defs>
            {[
              ["gTotal", "#06b6d4"],
              ["gA", "#f59e0b"],
              ["gB", "#8b5cf6"],
              ["gC", "#22c55e"],
            ].map(([id, color]) => (
              <linearGradient key={id} id={id} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.12} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray="2 4" stroke="#1e2733" vertical={false} />
          <XAxis
            dataKey="time"
            tick={{ fill: "#475569", fontSize: 10, fontFamily: "JetBrains Mono" }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fill: "#475569", fontSize: 10, fontFamily: "JetBrains Mono" }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine
            y={8}
            stroke="#ef444450"
            strokeDasharray="3 3"
            label={{
              value: "Zone High Threshold (8)",
              fill: "#ef4444",
              fontSize: 9,
              fontFamily: "monospace",
            }}
          />
          <Area
            type="monotone"
            dataKey="total"
            name="Total"
            stroke="#06b6d4"
            strokeWidth={1.5}
            fill="url(#gTotal)"
            dot={false}
          />
          <Area
            type="monotone"
            dataKey="zone_a"
            name="Zone A"
            stroke="#f59e0b"
            strokeWidth={1}
            fill="url(#gA)"
            dot={false}
          />
          <Area
            type="monotone"
            dataKey="zone_b"
            name="Zone B"
            stroke="#8b5cf6"
            strokeWidth={1}
            fill="url(#gB)"
            dot={false}
          />
          <Area
            type="monotone"
            dataKey="zone_c"
            name="Zone C"
            stroke="#22c55e"
            strokeWidth={1}
            fill="url(#gC)"
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </Card>
  );
}

export default function DensityPage({ dashboardState = {} }) {
  const [feed, setFeed] = useState("chart");
  const { density, history } = dashboardState;

  const runMeta = useMemo(() => {
    return {
      run_status: density?.run_status || "live",
      run_id: density?.run_id || "session_active",
      source_video: density?.source_video || "sample_crowd.mp4",
      video_fps: density?.video_fps || 30,
      frame_index: density?.frame_index ?? 450,
    };
  }, [density]);

  const currentTotal = density?.current_total ?? mockKpi.current_total;
  const peakSeen = density?.peak_total ?? mockKpi.peak_session;
  const busiestZone = density?.busiest_region ?? "Zone A";
  const regionsList = density?.regions?.length ? density.regions : mockRegions;

  return (
    <div className="p-5 space-y-5 max-w-[1440px] mx-auto">
      {/* Run metadata strip */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2.5 bg-[#0d1117] border border-[#1e2733] rounded">
        <StatusPill variant={runMeta.run_status === "live" ? "live" : "cyan"}>
          {runMeta.run_status.toUpperCase()}
        </StatusPill>
        {[
          { k: "SOURCE", v: runMeta.source_video },
          { k: "FPS", v: runMeta.video_fps },
          { k: "FRAME", v: runMeta.frame_index ? `#${runMeta.frame_index.toLocaleString()}` : "--" },
          { k: "RUN", v: runMeta.run_id },
        ].map(({ k, v }) => (
          <div key={k} className="flex items-center gap-2">
            <span className="text-[9px] font-mono tracking-widest uppercase text-slate-600">
              {k}
            </span>
            <Mono>{v}</Mono>
          </div>
        ))}
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Current Occupancy", value: currentTotal, accent: true },
          { label: "Peak Session", value: peakSeen },
          { label: "Busiest Zone", value: busiestZone },
          {
            label: "Threshold Status",
            value: currentTotal > 15 ? "High Density" : "Nominal",
            badge: (
              <StatusPill variant={currentTotal > 15 ? "critical" : "live"}>
                {currentTotal > 15 ? "Above Threshold" : "Within Bounds"}
              </StatusPill>
            ),
          },
        ].map(({ label, value, accent, badge }) => (
          <Card key={label} className="p-4">
            <p className="text-[9px] font-mono tracking-[0.18em] uppercase text-slate-500 mb-2">
              {label}
            </p>
            <p
              className={`text-2xl font-semibold tabular-nums leading-none ${
                accent ? "text-cyan-400" : "text-slate-100"
              }`}
            >
              {typeof value === "number" ? value.toLocaleString() : value}
            </p>
            {badge && <div className="mt-2">{badge}</div>}
          </Card>
        ))}
      </div>

      {/* Feed switcher */}
      <div className="flex items-center justify-between">
        <SectionLabel>Monitoring Feed</SectionLabel>
        <FeedSwitcher active={feed} onChange={setFeed} />
      </div>

      {/* Feed area: Chart vs Real Live MJPEG Stream vs Real MP4 Video */}
      {feed === "chart" && <TrendFeed historyData={history} />}

      {feed === "annotated" && (
        <Card className="overflow-hidden">
          <div className="bg-[#060809] flex flex-col items-center justify-center relative min-h-[380px] max-h-[520px]">
            <img
              src="http://127.0.0.1:8000/api/stream/density"
              alt="Live Annotated Camera Stream"
              className="w-full h-full max-h-[500px] object-contain block"
              onError={(e) => {
                e.target.style.display = "none";
                e.target.nextSibling.style.display = "flex";
              }}
            />
            <div className="hidden flex-col items-center justify-center p-8 text-center text-slate-500">
              <span className="text-2xl mb-2">📹</span>
              <p className="font-mono text-xs text-slate-400 mb-1">
                Stream connecting or backend offline
              </p>
              <p className="text-[11px] text-slate-600">
                Ensure FastAPI server is running on port 8000
              </p>
            </div>
          </div>
          <div className="flex items-center justify-between px-3 py-2 border-t border-[#1e2733] bg-[#0d1117]">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              <Mono className="text-slate-300">Live Annotated Stream</Mono>
              <span className="text-[10px] text-slate-600">·</span>
              <Mono className="text-slate-600">Spatial polygon overlays active</Mono>
            </div>
            <div className="flex items-center gap-2">
              <Mono>Source: {runMeta.source_video}</Mono>
              <span className="text-[10px] text-slate-600">·</span>
              <Mono>{runMeta.video_fps} FPS</Mono>
            </div>
          </div>
        </Card>
      )}

      {feed === "raw" && (
        <Card className="overflow-hidden">
          <div className="bg-[#060809] flex flex-col items-center justify-center relative min-h-[380px] max-h-[520px]">
            <video
              src="http://127.0.0.1:8000/api/video/density"
              controls
              autoPlay
              loop
              muted
              playsInline
              className="w-full h-full max-h-[500px] object-contain block"
            />
          </div>
          <div className="flex items-center justify-between px-3 py-2 border-t border-[#1e2733] bg-[#0d1117]">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
              <Mono className="text-slate-300">Raw Source Video</Mono>
              <span className="text-[10px] text-slate-600">·</span>
              <Mono className="text-slate-600">Native fixed wide-angle view</Mono>
            </div>
            <div className="flex items-center gap-2">
              <Mono>Source: {runMeta.source_video}</Mono>
            </div>
          </div>
        </Card>
      )}

      {/* Regional cards */}
      <div>
        <SectionLabel>Regional Occupancy Breakdown</SectionLabel>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {regionsList.map((r) => {
            const count = r.count ?? r.current ?? 0;
            const avg = r.session_avg ?? count;
            const peak = r.peak ?? Math.max(count, 8);
            const state = r.density_level || r.density_state || "low";
            const trend = r.trend ?? 0;

            return (
              <Card key={r.region_id || r.id} className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-200">
                      {r.display_name || r.name || r.label || r.region_id}
                    </p>
                    <p className="text-[11px] text-slate-500">{r.sublabel || "Spatial Zone"}</p>
                  </div>
                  <DensityBadge state={state} />
                </div>
                <div className="grid grid-cols-3 gap-3 mb-3">
                  {[
                    { l: "CURRENT", v: count },
                    { l: "SESSION AVG", v: avg },
                    { l: "PEAK", v: peak },
                  ].map(({ l, v }) => (
                    <div key={l}>
                      <p className="text-[9px] font-mono tracking-widest uppercase text-slate-600 mb-0.5">
                        {l}
                      </p>
                      <p className="text-xl font-semibold tabular-nums text-slate-100 leading-none">
                        {v}
                      </p>
                    </div>
                  ))}
                </div>
                <MiniBar
                  pct={(count / Math.max(1, peak)) * 100}
                  color={state === "low" ? "green" : state === "high" ? "red" : "amber"}
                />
                <div className="flex items-center justify-between mt-2">
                  <Mono className="text-slate-600">
                    Threshold: {r.threshold_low ?? 3}–{r.threshold_high ?? 8}
                  </Mono>
                  <TrendIndicator value={trend} />
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
