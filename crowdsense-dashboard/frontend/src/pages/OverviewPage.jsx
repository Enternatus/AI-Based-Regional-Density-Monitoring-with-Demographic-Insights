import React, { useMemo } from "react";
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
  demographicSnapshot as mockDemo,
  inferenceTypes as mockInference,
} from "../data/mockData.js";
import {
  Card,
  SectionLabel,
  StatusPill,
  DensityBadge,
  TrendIndicator,
  MiniBar,
  Mono,
  Button,
  Divider,
  IconInfo,
} from "../components/ui.jsx";

// ── Architecture Notice ───────────────────────────────────────────────────────
function ArchitectureNotice() {
  return (
    <div className="flex items-start gap-3 px-4 py-3 bg-[#0d1117] border border-[#1e2733] rounded">
      <div className="mt-0.5 shrink-0 w-5 h-5 rounded-full border border-cyan-700/50 bg-cyan-950/40 flex items-center justify-center">
        <IconInfo className="w-3 h-3 text-cyan-500" />
      </div>
      <div>
        <p className="text-[11px] font-mono font-medium tracking-widest uppercase text-cyan-500 mb-0.5">
          Dual-Pipeline Architecture
        </p>
        <p className="text-[12px] text-slate-400 leading-relaxed">
          CrowdSense operates two independent, task-optimized computer vision modules: a{" "}
          <span className="text-slate-300">wide-angle spatial density pipeline</span> for crowd
          counting and zone monitoring (`sample_crowd.mp4`), and a separate{" "}
          <span className="text-slate-300">close-range demographic inference pipeline</span> for
          attribute analysis (`close_range_crowd.mp4`). These pipelines process different source
          materials and operate independently — density counts and demographic tracks are not 1:1
          linked.
        </p>
      </div>
    </div>
  );
}

// ── Run Telemetry Strip ───────────────────────────────────────────────────────
function RunStrip({ runMeta, onNavigate }) {
  const status = runMeta.run_status || "live";
  const pillVariant =
    status === "live" || status === "running"
      ? "live"
      : status === "completed"
      ? "cyan"
      : status === "paused"
      ? "warning"
      : "muted";

  const items = [
    {
      key: "STATUS",
      value: (
        <StatusPill variant={pillVariant}>
          {status.toUpperCase()}
        </StatusPill>
      ),
    },
    { key: "SOURCE", value: <Mono>{runMeta.source_video || "sample_crowd.mp4"}</Mono> },
    { key: "FPS", value: <Mono>{runMeta.video_fps || 30}</Mono> },
    {
      key: "FRAME",
      value: (
        <Mono>
          {runMeta.frame_index != null ? `#${runMeta.frame_index.toLocaleString()}` : "--"}
        </Mono>
      ),
    },
    {
      key: "RUN ID",
      value: <Mono className="text-slate-500">{runMeta.run_id || "session_active"}</Mono>,
    },
  ];

  return (
    <div className="flex items-center justify-between gap-2 px-4 py-2.5 bg-[#0d1117] border border-[#1e2733] rounded">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        {items.map(({ key, value }) => (
          <div key={key} className="flex items-center gap-2">
            <span className="text-[9px] font-mono tracking-widest uppercase text-slate-600">
              {key}
            </span>
            {value}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Button variant="ghost" onClick={() => onNavigate?.("density")}>
          <span className="text-[11px]">Density &rarr;</span>
        </Button>
        <Button variant="ghost" onClick={() => onNavigate?.("people")}>
          <span className="text-[11px]">Profiles &rarr;</span>
        </Button>
        <Button variant="ghost" onClick={() => onNavigate?.("split")}>
          <span className="text-[11px]">Split &rarr;</span>
        </Button>
      </div>
    </div>
  );
}

// ── KPI Cards ─────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, accent = false, badge }) {
  return (
    <Card className="p-4 flex flex-col gap-2">
      <p className="text-[9px] font-mono tracking-[0.18em] uppercase text-slate-500">{label}</p>
      <p
        className={`text-3xl font-semibold tracking-tight leading-none tabular-nums ${
          accent ? "text-cyan-400" : "text-slate-100"
        }`}
      >
        {typeof value === "number" ? value.toLocaleString() : value ?? "--"}
      </p>
      <div className="flex items-center gap-2 mt-auto">
        {sub && <span className="text-[11px] text-slate-500">{sub}</span>}
        {badge}
      </div>
    </Card>
  );
}

// ── Zone Map ──────────────────────────────────────────────────────────────────
function ZoneMap({ regionsList = [] }) {
  const zoneColors = {
    low: "#22c55e",
    medium: "#f59e0b",
    moderate: "#f59e0b",
    high: "#ef4444",
  };

  const zA = regionsList[0] || { name: "Left Walkway", count: 4, status: "low" };
  const zB = regionsList[1] || { name: "Center Plaza", count: 7, status: "medium" };
  const zC = regionsList[2] || { name: "Right Walkway", count: 3, status: "low" };

  const colA = zoneColors[zA.density_level?.toLowerCase() || zA.status?.toLowerCase()] || zoneColors.low;
  const colB = zoneColors[zB.density_level?.toLowerCase() || zB.status?.toLowerCase()] || zoneColors.medium;
  const colC = zoneColors[zC.density_level?.toLowerCase() || zC.status?.toLowerCase()] || zoneColors.low;

  return (
    <div className="flex flex-col gap-3">
      <SectionLabel>Spatial Monitoring · Camera Perspective</SectionLabel>
      <div
        className="relative bg-[#080b0f] border border-[#1e2733] rounded overflow-hidden"
        style={{ aspectRatio: "4/3" }}
      >
        <svg viewBox="0 0 400 300" className="w-full h-full">
          {Array.from({ length: 6 }, (_, i) => (
            <line key={`vg${i}`} x1={i * 80} y1="0" x2={i * 80} y2="300" stroke="#1e2733" strokeWidth="0.5" />
          ))}
          {Array.from({ length: 5 }, (_, i) => (
            <line key={`hg${i}`} x1="0" y1={i * 75} x2="400" y2={i * 75} stroke="#1e2733" strokeWidth="0.5" />
          ))}
          {[0, 80, 160, 240, 320, 400].map((x, i) => (
            <line key={`p${i}`} x1={x} y1="300" x2="200" y2="40" stroke="#1e2733" strokeWidth="0.8" opacity="0.5" />
          ))}

          {/* Zone A — Top polygon */}
          <polygon
            points="130,40 270,40 240,110 160,110"
            fill={`${colA}18`}
            stroke={colA}
            strokeWidth="1.5"
          />
          <text x="200" y="80" textAnchor="middle" fill={colA} fontSize="10" fontFamily="monospace">
            {zA.name || zA.region_id || "ZONE A"}
          </text>
          <text x="200" y="96" textAnchor="middle" fill={colA} fontSize="11" fontWeight="bold" fontFamily="monospace">
            {zA.count ?? 0}
          </text>

          {/* Zone B — Middle polygon */}
          <polygon
            points="100,120 300,120 340,200 60,200"
            fill={`${colB}18`}
            stroke={colB}
            strokeWidth="1.5"
          />
          <text x="200" y="160" textAnchor="middle" fill={colB} fontSize="10" fontFamily="monospace">
            {zB.name || zB.region_id || "ZONE B"}
          </text>
          <text x="200" y="178" textAnchor="middle" fill={colB} fontSize="11" fontWeight="bold" fontFamily="monospace">
            {zB.count ?? 0}
          </text>

          {/* Zone C — Bottom polygon */}
          <polygon
            points="30,215 370,215 400,290 0,290"
            fill={`${colC}18`}
            stroke={colC}
            strokeWidth="1.5"
          />
          <text x="200" y="250" textAnchor="middle" fill={colC} fontSize="10" fontFamily="monospace">
            {zC.name || zC.region_id || "ZONE C"}
          </text>
          <text x="200" y="268" textAnchor="middle" fill={colC} fontSize="11" fontWeight="bold" fontFamily="monospace">
            {zC.count ?? 0}
          </text>

          {/* Camera origin icon */}
          <circle cx="200" cy="20" r="8" fill="#06b6d4" opacity="0.15" stroke="#06b6d4" strokeWidth="1" />
          <text x="200" y="24" textAnchor="middle" fill="#06b6d4" fontSize="9">
            CAM
          </text>
        </svg>
      </div>
      <p className="text-[10px] text-slate-600 leading-relaxed">
        Illustrative camera perspective view. Zone boundaries are operationally defined — not a
        metrically calibrated floor plane.
      </p>
    </div>
  );
}

// ── Region Cards ──────────────────────────────────────────────────────────────
function RegionCards({ regionsList = [] }) {
  const displayList = regionsList.length > 0 ? regionsList : mockRegions;

  return (
    <div className="flex flex-col gap-3">
      <SectionLabel>Live Regional State</SectionLabel>
      {displayList.map((r) => {
        const count = r.count ?? r.current ?? 0;
        const avg = r.session_avg ?? count;
        const peak = r.peak ?? Math.max(count, 8);
        const state = r.density_level || r.density_state || "low";
        const trend = r.trend ?? 0;

        return (
          <Card key={r.region_id || r.id} className="p-3.5">
            <div className="flex items-start justify-between mb-2.5">
              <div>
                <p className="text-[11px] font-medium text-slate-200">
                  {r.display_name || r.name || r.label || r.region_id}
                </p>
                <p className="text-[10px] text-slate-500">{r.sublabel || "Spatial Zone"}</p>
              </div>
              <DensityBadge state={state} />
            </div>
            <div className="grid grid-cols-3 gap-3 mb-2.5">
              {[
                { label: "NOW", value: count },
                { label: "AVG", value: avg },
                { label: "PEAK", value: peak },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="text-[9px] font-mono tracking-widest uppercase text-slate-600 mb-0.5">
                    {label}
                  </p>
                  <p className="text-lg font-semibold tabular-nums text-slate-100 leading-none">
                    {value}
                  </p>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between">
              <MiniBar
                pct={(count / Math.max(1, peak)) * 100}
                color={state === "low" ? "green" : state === "high" ? "red" : "amber"}
              />
              <div className="ml-3 shrink-0">
                <TrendIndicator value={trend} />
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

// ── Trend Chart ───────────────────────────────────────────────────────────────
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

function TrendChartSection({ historyData = [] }) {
  const chartData = useMemo(() => {
    if (!historyData || historyData.length === 0) return mockSnapshots;
    return historyData.map((h, i) => {
      let timeStr = `T-${historyData.length - i}`;
      const rawTime = h.timestamp || h.updated_at;
      if (rawTime) {
        try {
          timeStr = new Date(rawTime).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          });
        } catch {
          /* fallback */
        }
      } else if (h.frame_index != null) {
        timeStr = `#${h.frame_index}`;
      }

      let zoneA = 0;
      let zoneB = 0;
      let zoneC = 0;
      let calculatedTotal = 0;

      if (Array.isArray(h.regions)) {
        h.regions.forEach((r, idx) => {
          const cnt = r.count ?? 0;
          calculatedTotal += cnt;
          const id = (r.region_id || r.name || "").toLowerCase();
          if (id.includes("left") || idx === 0) zoneA = cnt;
          else if (id.includes("cent") || idx === 1) zoneB = cnt;
          else if (id.includes("right") || idx === 2) zoneC = cnt;
        });
      } else if (h.regions && typeof h.regions === "object") {
        const vals = Object.values(h.regions);
        zoneA = vals[0] ?? 0;
        zoneB = vals[1] ?? 0;
        zoneC = vals[2] ?? 0;
        calculatedTotal = zoneA + zoneB + zoneC;
      } else if (h.region_counts && typeof h.region_counts === "object") {
        const vals = Object.values(h.region_counts);
        zoneA = vals[0] ?? 0;
        zoneB = vals[1] ?? 0;
        zoneC = vals[2] ?? 0;
        calculatedTotal = zoneA + zoneB + zoneC;
      }

      const total = h.total ?? h.total_count ?? calculatedTotal;

      return {
        frame: h.frame_index ?? i * 30,
        time: timeStr,
        total: total,
        zone_a: zoneA,
        zone_b: zoneB,
        zone_c: zoneC,
      };
    });
  }, [historyData]);

  const latest = chartData[chartData.length - 1] || { time: "--", frame: 0, total: 0 };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <SectionLabel>Occupancy Trend</SectionLabel>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-0.5 bg-cyan-500 rounded-full inline-block" />
            <span className="text-[10px] text-slate-500 font-mono">Total</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-0.5 bg-amber-500 rounded-full inline-block" />
            <span className="text-[10px] text-slate-500 font-mono">Left Walkway</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-0.5 bg-violet-500 rounded-full inline-block" />
            <span className="text-[10px] text-slate-500 font-mono">Central Plaza</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-0.5 bg-emerald-500 rounded-full inline-block" />
            <span className="text-[10px] text-slate-500 font-mono">Right Walkway</span>
          </div>
        </div>
      </div>
      <Card className="p-4">
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={chartData} margin={{ top: 4, right: 0, bottom: 0, left: -20 }}>
            <defs>
              <linearGradient id="gTotal" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gA" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.1} />
                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gB" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.1} />
                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gC" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22c55e" stopOpacity={0.1} />
                <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="2 4" stroke="#1e2733" vertical={false} />
            <XAxis
              dataKey="time"
              tick={{ fill: "#475569", fontSize: 10, fontFamily: "JetBrains Mono" }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              domain={[0, "auto"]}
              tick={{ fill: "#475569", fontSize: 10, fontFamily: "JetBrains Mono" }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={8} stroke="#ef444440" strokeDasharray="3 3" />
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
              name="Left Walkway"
              stroke="#f59e0b"
              strokeWidth={1}
              fill="url(#gA)"
              dot={false}
            />
            <Area
              type="monotone"
              dataKey="zone_b"
              name="Central Plaza"
              stroke="#8b5cf6"
              strokeWidth={1}
              fill="url(#gB)"
              dot={false}
            />
            <Area
              type="monotone"
              dataKey="zone_c"
              name="Right Walkway"
              stroke="#22c55e"
              strokeWidth={1}
              fill="url(#gC)"
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
        <Divider className="mt-3 mb-3" />
        <div className="flex flex-wrap gap-x-6 gap-y-1.5">
          {[
            {
              label: "LATEST SNAPSHOT",
              value: `${latest.time} · Frame ${latest.frame?.toLocaleString() ?? "--"}`,
            },
            { label: "TOTAL", value: latest.total },
            { label: "THRESHOLD", value: "High: 8+ per zone" },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center gap-2">
              <span className="text-[9px] font-mono tracking-widest uppercase text-slate-600">
                {label}
              </span>
              <Mono>{value}</Mono>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ── Demographic Snapshot ──────────────────────────────────────────────────────
function DemographicPanel({ demoSummary }) {
  const d = useMemo(() => {
    if (!demoSummary) return mockDemo;
    const gBreak = demoSummary.gender || {};
    const totalG = (gBreak.Male || 0) + (gBreak.Female || 0) || 1;
    const mPct = Math.round(((gBreak.Male || 0) / totalG) * 100);
    const fPct = Math.round(((gBreak.Female || 0) / totalG) * 100);

    const aBreak = demoSummary.age_groups || {};
    const totalA = Object.values(aBreak).reduce((a, b) => a + b, 0) || 1;
    const ageDist = Object.entries(aBreak).map(([range, count]) => ({
      range,
      pct: Math.round((count / totalA) * 100),
    }));

    return {
      predominant_gender: (gBreak.Male || 0) >= (gBreak.Female || 0) ? "Male" : "Female",
      gender_dist: { male: mPct, female: fPct },
      primary_age_bracket:
        Object.entries(aBreak).sort((a, b) => b[1] - a[1])[0]?.[0] || "20-29",
      appearance_group:
        Object.entries(demoSummary.appearance_groups || {}).sort((a, b) => b[1] - a[1])[0]?.[0] ||
        "White",
      common_clothing_color:
        Object.entries(demoSummary.clothing_colors || {}).sort((a, b) => b[1] - a[1])[0]?.[0] ||
        "Black",
      age_dist: ageDist.length > 0 ? ageDist : mockDemo.age_dist,
    };
  }, [demoSummary]);

  return (
    <div>
      <SectionLabel>Demographic Snapshot · Close-Range Pipeline</SectionLabel>
      <Card className="p-4 space-y-4">
        {/* Summary attributes */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-3">
          {[
            { label: "PREDOMINANT GENDER", value: d.predominant_gender },
            { label: "PRIMARY AGE BRACKET", value: d.primary_age_bracket },
            { label: "APPEARANCE GROUP", value: d.appearance_group },
            { label: "COMMON CLOTHING", value: d.common_clothing_color },
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="text-[9px] font-mono tracking-widest uppercase text-slate-600 mb-0.5">
                {label}
              </p>
              <p className="text-[13px] font-medium text-slate-200 capitalize">{value}</p>
            </div>
          ))}
        </div>
        <Divider />
        {/* Gender distribution */}
        <div>
          <p className="text-[9px] font-mono tracking-widest uppercase text-slate-600 mb-2">
            Gender Distribution
          </p>
          <div className="flex gap-2 items-end">
            {Object.entries(d.gender_dist).map(([key, pct]) => {
              const colorMap = {
                male: "bg-cyan-500",
                female: "bg-violet-500",
              };
              return (
                <div key={key} className="flex-1">
                  <p className="text-[9px] font-mono text-slate-500 mb-1 capitalize">
                    {key} {pct}%
                  </p>
                  <div
                    className="bg-slate-800 rounded-sm overflow-hidden"
                    style={{ height: `${pct * 0.6}px`, minHeight: 4 }}
                  >
                    <div className={`w-full h-full ${colorMap[key] || "bg-slate-600"}`} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <Divider />
        {/* Age distribution */}
        <div>
          <p className="text-[9px] font-mono tracking-widest uppercase text-slate-600 mb-2">
            Age Distribution
          </p>
          <div className="space-y-1.5">
            {d.age_dist.map(({ range, pct }) => (
              <div key={range} className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-slate-500 w-16 shrink-0">{range}</span>
                <MiniBar
                  pct={pct}
                  color={pct === Math.max(...d.age_dist.map((a) => a.pct)) ? "cyan" : "slate"}
                />
                <span className="text-[10px] font-mono text-slate-500 w-6 text-right shrink-0">
                  {pct}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}

// ── Inference Provenance ──────────────────────────────────────────────────────
const colorMap = {
  live: { pill: "live", bar: "bg-green-500", text: "text-green-400" },
  warning: { pill: "warning", bar: "bg-amber-500", text: "text-amber-400" },
  critical: { pill: "critical", bar: "bg-red-500", text: "text-red-400" },
};

function InferencePanel({ demoSummary }) {
  const types = useMemo(() => {
    const q = demoSummary?.data_quality;
    if (!q) return mockInference;
    return [
      {
        key: "settled",
        label: "Confirmed / Settled",
        count: q.settled ?? 12,
        color: "live",
        description:
          "Multi-frame temporally smoothed prediction passing quality and stability gates.",
      },
      {
        key: "best_raw",
        label: "Best Available",
        count: q.best_raw ?? 10,
        color: "warning",
        description:
          "Highest-confidence raw prediction when track was not observed long enough to settle.",
      },
      {
        key: "last_resort",
        label: "Low-Quality Estimate",
        count: q.last_resort ?? 5,
        color: "critical",
        description:
          "Filtered low-quality observation. Kept for visibility, treat as indicative only.",
      },
    ];
  }, [demoSummary]);

  const total = types.reduce((s, t) => s + t.count, 0);

  return (
    <div>
      <SectionLabel>Inference Provenance &amp; Quality</SectionLabel>
      <Card className="p-4 space-y-4">
        <p className="text-[11px] text-slate-500 leading-relaxed">
          All demographic outputs are model inferences. Confidence and provenance classification is
          displayed to support appropriate interpretation.
        </p>
        {types.map((t) => {
          const c = colorMap[t.color] || colorMap.warning;
          const pct = total > 0 ? Math.round((t.count / total) * 100) : 0;
          return (
            <div key={t.key}>
              <div className="flex items-center justify-between mb-1.5">
                <StatusPill variant={c.pill}>{t.label}</StatusPill>
                <span className={`font-mono text-sm font-semibold tabular-nums ${c.text}`}>
                  {t.count.toLocaleString()}
                </span>
              </div>
              <MiniBar
                pct={pct}
                color={t.color === "live" ? "green" : t.color === "warning" ? "amber" : "red"}
              />
              <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">{t.description}</p>
              <Divider className="mt-3" />
            </div>
          );
        })}
        <p className="text-[10px] font-mono text-slate-600">
          Total analyzed: {total.toLocaleString()} tracks · Active session
        </p>
      </Card>
    </div>
  );
}

// ── Main Page Component ───────────────────────────────────────────────────────
export default function OverviewPage({
  dashboardState = {},
  onNavigate,
}) {
  const { overview, density, history, demographics } = dashboardState;

  const runMeta = useMemo(() => {
    return {
      run_status: density?.run_status || overview?.density?.run_status || "live",
      run_id: density?.run_id || overview?.density?.run_id || "session_active",
      source_video: density?.source_video || overview?.density?.source_video || "sample_crowd.mp4",
      video_fps: density?.video_fps || overview?.density?.video_fps || 30,
      frame_index: density?.frame_index ?? overview?.density?.frame_index ?? 450,
    };
  }, [density, overview]);

  const kpis = useMemo(() => {
    return {
      current: density?.current_total ?? overview?.density?.current_total ?? mockKpi.current_total,
      peak: density?.peak_total ?? overview?.density?.peak_total ?? mockKpi.peak_session,
      busiest: density?.busiest_region ?? overview?.density?.busiest_region ?? "Zone A",
      analyzed: demographics?.total ?? overview?.demographics?.total_detected ?? mockKpi.people_analyzed,
    };
  }, [density, overview, demographics]);

  const regionsList = density?.regions || [];

  return (
    <div className="p-5 space-y-5 max-w-[1440px] mx-auto">
      <ArchitectureNotice />
      <RunStrip runMeta={runMeta} onNavigate={onNavigate} />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label="Current Occupancy"
          value={kpis.current}
          sub="persons detected"
          accent
          badge={<StatusPill variant="live">Live</StatusPill>}
        />
        <KpiCard label="Peak This Session" value={kpis.peak} sub="session maximum" />
        <KpiCard label="Busiest Zone" value={kpis.busiest} sub="spatial hotspot" />
        <KpiCard label="People Analyzed" value={kpis.analyzed} sub="demographic records" />
      </div>

      {/* Spatial section */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4">
        <ZoneMap regionsList={regionsList} />
        <RegionCards regionsList={regionsList} />
      </div>

      {/* Trend chart */}
      <TrendChartSection historyData={history} />

      {/* Bottom analytical */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DemographicPanel demoSummary={demographics} />
        <InferencePanel demoSummary={demographics} />
      </div>
    </div>
  );
}
