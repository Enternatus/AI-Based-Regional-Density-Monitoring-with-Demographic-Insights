import React, { useState, useMemo, useEffect } from "react";
import { getPeople, cropUrl } from "../api/crowdsense.js";
import {
  Card,
  SectionLabel,
  StatusPill,
  QualityBadge,
  Button,
  Divider,
  Mono,
  IconSearch,
  IconGrid,
  IconTable,
  IconChevronDown,
  IconDownload,
} from "../components/ui.jsx";

const genderOptions = ["All", "Male", "Female"];
const ageOptions = ["All", "10-19", "20-29", "30-39", "40-49"];
const groupOptions = [
  "All",
  "White",
  "East Asian",
  "Indian",
  "Middle Eastern",
  "Hispanic / Latino",
];
const colorOptions = ["All", "black", "grey", "white", "blue", "red", "green", "yellow"];
const qualityOptions = ["All", "settled", "best_raw", "last_resort"];

function FilterSelect({ label, options, value, onChange }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none pl-3 pr-8 py-1.5 bg-[#0d1117] border border-[#1e2733] rounded text-[11px] text-slate-300 font-mono focus:outline-none focus:border-cyan-700 cursor-pointer hover:border-slate-600 transition-colors"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o === "All" ? `${label}: All` : o}
          </option>
        ))}
      </select>
      <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-500">
        <IconChevronDown />
      </div>
    </div>
  );
}

function PersonGridCard({ p, onClick }) {
  const genderColor =
    p.gender === "Male"
      ? "bg-cyan-900/30 text-cyan-400"
      : p.gender === "Female"
      ? "bg-violet-900/30 text-violet-400"
      : "bg-slate-800/50 text-slate-400";

  const crop = cropUrl(p.person_id || p.id);

  return (
    <Card
      className="p-3 cursor-pointer hover:border-slate-600 transition-colors active:bg-white/[0.02] flex flex-col justify-between"
      onClick={onClick}
    >
      {/* Real Crop Image or SVG Silhouette fallback */}
      <div className="aspect-[3/4] bg-[#080b0f] rounded mb-3 overflow-hidden flex items-center justify-center border border-[#1e2733] relative">
        <img
          src={crop}
          alt={`Track ${p.person_id || p.id}`}
          className="w-full h-full object-cover object-top"
          onError={(e) => {
            e.target.style.display = "none";
            e.target.nextSibling.style.display = "flex";
          }}
        />
        <div className="hidden w-full h-full flex-col items-center justify-center bg-[#0d1117] text-slate-600">
          <svg viewBox="0 0 60 80" className="w-12 h-16 opacity-40">
            <rect x="15" y="10" width="30" height="35" rx="15" fill="#38bdf8" />
            <path d="M5 75 Q30 45 55 75 Z" fill="#38bdf8" />
          </svg>
          <span className="font-mono text-[9px] mt-1">TRK-{p.person_id || p.id}</span>
        </div>
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <Mono className="text-slate-200 font-medium">TRK-{p.person_id || p.id}</Mono>
          <QualityBadge state={p.source || p.quality} />
        </div>
        <div className="flex flex-wrap gap-1 mt-1">
          <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${genderColor}`}>
            {p.gender}
          </span>
          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-800/50 text-slate-400">
            {p.age}
          </span>
          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-800/50 text-slate-400">
            {p.race ? p.race.replace("Latino_Hispanic", "Hispanic / Latino") : p.appearance_group}
          </span>
        </div>
        <p className="text-[10px] text-slate-500 font-mono capitalize">
          Shirt: {p.clothing_color || "unknown"}
        </p>
      </div>
    </Card>
  );
}

function PersonTableRow({ p, onClick }) {
  return (
    <tr
      className="border-b border-[#1e2733] hover:bg-white/[0.02] cursor-pointer transition-colors"
      onClick={onClick}
    >
      <td className="px-3 py-2.5">
        <Mono className="text-slate-300">TRK-{p.person_id || p.id}</Mono>
      </td>
      <td className="px-3 py-2.5">
        <span className="text-[11px] text-slate-300">{p.gender}</span>
      </td>
      <td className="px-3 py-2.5">
        <span className="text-[11px] text-slate-400">{p.age}</span>
      </td>
      <td className="px-3 py-2.5">
        <span className="text-[11px] text-slate-400">
          {p.race ? p.race.replace("Latino_Hispanic", "Hispanic / Latino") : p.appearance_group}
        </span>
      </td>
      <td className="px-3 py-2.5">
        <span className="text-[11px] text-slate-400 capitalize">{p.clothing_color}</span>
      </td>
      <td className="px-3 py-2.5">
        <QualityBadge state={p.source || p.quality} />
      </td>
      <td className="px-3 py-2.5">
        <Mono className="text-slate-600">
          {p.first_seen_frame != null ? `#${p.first_seen_frame}` : "--"}
        </Mono>
      </td>
    </tr>
  );
}

function PersonDetailModal({ p, onClose }) {
  const qualityDesc = {
    settled: "High-confidence multi-frame smoothed prediction passing temporal stability gates.",
    confirmed: "High-confidence multi-frame smoothed prediction passing temporal stability gates.",
    best_raw: "Best available prediction from camera corridor before track exited observation window.",
    best_available: "Best available prediction from camera corridor before track exited observation window.",
    last_resort: "Low-quality fallback observation. Kept for visibility, treat as indicative only.",
    low_quality: "Low-quality fallback observation. Kept for visibility, treat as indicative only.",
  };

  const crop = cropUrl(p.person_id || p.id);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <Card className="w-full max-w-lg shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#1e2733]">
          <div>
            <p className="text-[9px] font-mono tracking-widest uppercase text-slate-500 mb-0.5">
              Demographic Track Record
            </p>
            <p className="text-sm font-semibold text-slate-100 font-mono">
              Track #{p.person_id || p.id}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-300 transition-colors text-lg leading-none cursor-pointer"
          >
            ✕
          </button>
        </div>
        <div className="p-5 grid grid-cols-[130px_1fr] gap-5">
          {/* High-res Crop Image */}
          <div className="aspect-[3/4] bg-[#080b0f] rounded border border-[#1e2733] overflow-hidden flex items-center justify-center relative">
            <img
              src={crop}
              alt={`Track ${p.person_id || p.id}`}
              className="w-full h-full object-cover object-top"
              onError={(e) => {
                e.target.style.display = "none";
                e.target.nextSibling.style.display = "flex";
              }}
            />
            <div className="hidden w-full h-full flex-col items-center justify-center bg-[#0d1117] text-slate-600">
              <span className="font-mono text-xs text-slate-500">No Image Crop</span>
            </div>
          </div>

          {/* Attributes breakdown */}
          <div className="space-y-3">
            {[
              {
                label: "GENDER",
                value: `${p.gender} ${p.gender_conf != null ? `(${p.gender_conf.toFixed(1)}%)` : ""}`,
              },
              {
                label: "AGE BRACKET",
                value: `${p.age} ${p.age_conf != null ? `(${p.age_conf.toFixed(1)}%)` : ""}`,
              },
              {
                label: "APPEARANCE GROUP",
                value: `${(p.race || p.appearance_group || "").replace("Latino_Hispanic", "Hispanic / Latino")} ${
                  p.race_conf != null ? `(${p.race_conf.toFixed(1)}%)` : ""
                }`,
              },
              {
                label: "SHIRT COLOR",
                value: p.clothing_color || "Unknown",
              },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-[9px] font-mono tracking-widest uppercase text-slate-600 mb-0.5">
                  {label}
                </p>
                <p className="text-[13px] text-slate-200 capitalize">{value}</p>
              </div>
            ))}
          </div>
        </div>
        <Divider />
        <div className="p-5 space-y-3">
          <div className="flex items-center gap-3">
            <QualityBadge state={p.source || p.quality} />
            <Mono className="text-slate-500">Source: {p.source || "settled"}</Mono>
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            {qualityDesc[p.source || p.quality] || qualityDesc.settled}
          </p>
          <Divider />
          <div className="flex gap-6">
            <div>
              <p className="text-[9px] font-mono tracking-widest uppercase text-slate-600 mb-0.5">
                FIRST SEEN
              </p>
              <Mono>Frame #{p.first_seen_frame ?? "--"}</Mono>
            </div>
            <div>
              <p className="text-[9px] font-mono tracking-widest uppercase text-slate-600 mb-0.5">
                LAST SEEN
              </p>
              <Mono>Frame #{p.last_seen_frame ?? "--"}</Mono>
            </div>
            <div>
              <p className="text-[9px] font-mono tracking-widest uppercase text-slate-600 mb-0.5">
                TRACK DURATION
              </p>
              <Mono>
                {p.last_seen_frame && p.first_seen_frame
                  ? `${p.last_seen_frame - p.first_seen_frame} frames`
                  : "--"}
              </Mono>
            </div>
          </div>
          <p className="text-[10px] text-slate-600 leading-relaxed pt-1 border-t border-[#1e2733]/50">
            ℹ️ Ethical disclosure: These demographic attributes are algorithmic inferences
            generated by computer vision models. They must not be treated as confirmed ground-truth
            personal identity.
          </p>
        </div>
      </Card>
    </div>
  );
}

export default function PeoplePage() {
  const [query, setQuery] = useState("");
  const [matchMode, setMatchMode] = useState("all"); // "all" (strict AND) | "any" (flexible OR)
  const [gender, setGender] = useState("All");
  const [age, setAge] = useState("All");
  const [group, setGroup] = useState("All");
  const [color, setColor] = useState("All");
  const [quality, setQuality] = useState("All");
  const [viewMode, setViewMode] = useState("grid");
  const [selected, setSelected] = useState(null);

  const [rawResults, setRawResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function fetchSearchResults(overrideQuery = query, mode = matchMode) {
    setLoading(true);
    setError(null);
    try {
      const data = await getPeople(overrideQuery, { match_mode: mode });
      setRawResults(data.results || []);
    } catch (err) {
      console.error(err);
      setError("Failed to fetch people records from backend.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchSearchResults();
  }, []);

  function handleSearchSubmit(e) {
    if (e) e.preventDefault();
    fetchSearchResults(query, matchMode);
  }

  function handleMatchModeToggle(mode) {
    setMatchMode(mode);
    fetchSearchResults(query, mode);
  }

  // Client-side filtering on dropdowns
  const filtered = useMemo(() => {
    return rawResults.filter((p) => {
      if (gender !== "All" && (p.gender || "").toLowerCase() !== gender.toLowerCase()) return false;
      if (age !== "All" && p.age !== age) return false;
      if (group !== "All") {
        const norm = (p.race || p.appearance_group || "").replace(
          "Latino_Hispanic",
          "Hispanic / Latino"
        );
        if (norm.toLowerCase() !== group.toLowerCase()) return false;
      }
      if (color !== "All" && (p.clothing_color || "").toLowerCase() !== color.toLowerCase())
        return false;
      if (quality !== "All" && (p.source || p.quality) !== quality) return false;
      return true;
    });
  }, [rawResults, gender, age, group, color, quality]);

  // Export CSV
  function exportCSV() {
    if (!filtered.length) return;
    const headers = [
      "Track ID",
      "Gender",
      "Age",
      "Appearance Group",
      "Clothing Color",
      "Quality",
      "First Frame",
      "Last Frame",
    ];
    const rows = filtered.map((r) => [
      r.person_id || r.id,
      r.gender || "",
      r.age || "",
      (r.race || r.appearance_group || "").replace("Latino_Hispanic", "Hispanic / Latino"),
      r.clothing_color || "",
      r.source || r.quality || "",
      r.first_seen_frame ?? "",
      r.last_seen_frame ?? "",
    ]);

    const csvContent = [headers.join(","), ...rows.map((row) => row.map((val) => `"${val}"`).join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `crowdsense_demographics_${Date.now()}.csv`;
    link.click();
  }

  // Export JSON
  function exportJSON() {
    if (!filtered.length) return;
    const blob = new Blob([JSON.stringify(filtered, null, 2)], {
      type: "application/json;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `crowdsense_demographics_${Date.now()}.json`;
    link.click();
  }

  function clearAll() {
    setGender("All");
    setAge("All");
    setGroup("All");
    setColor("All");
    setQuality("All");
    setQuery("");
    fetchSearchResults("", matchMode);
  }

  return (
    <div className="p-5 space-y-4 max-w-[1440px] mx-auto">
      {selected && <PersonDetailModal p={selected} onClose={() => setSelected(null)} />}

      {/* Search Input Bar with Mode Switcher */}
      <form onSubmit={handleSearchSubmit} className="flex gap-2 items-center">
        <div className="flex-1 relative">
          <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder='Query records — e.g. "woman in a black shirt", "young man in grey"'
            className="w-full pl-9 pr-4 py-2 bg-[#0d1117] border border-[#1e2733] rounded text-[12px] text-slate-200 placeholder:text-slate-600 font-mono focus:outline-none focus:border-cyan-700 transition-colors"
          />
        </div>
        <div className="flex items-center gap-1 bg-[#0d1117] border border-[#1e2733] rounded p-0.5">
          {["all", "any"].map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => handleMatchModeToggle(m)}
              title={
                m === "all"
                  ? "ALL: match every attribute (strict boolean AND)"
                  : "ANY: match any attribute (flexible OR)"
              }
              className={`px-3 py-1 rounded text-[11px] font-mono font-medium transition-all cursor-pointer ${
                matchMode === m
                  ? "bg-cyan-500/10 border border-cyan-500/30 text-cyan-400"
                  : "text-slate-500 hover:text-slate-300 border border-transparent"
              }`}
            >
              {m.toUpperCase()}
            </button>
          ))}
        </div>
        <Button variant="primary" type="submit" disabled={loading}>
          {loading ? "Searching..." : "Search"}
        </Button>
      </form>

      <p className="text-[10px] text-slate-600 font-mono -mt-2">
        Match Mode — ALL: strict AND · ANY: flexible OR. Query against: gender, age, shirt color,
        appearance group.
      </p>

      {/* Filters Bar */}
      <div className="flex flex-wrap gap-2 items-center">
        <FilterSelect label="Gender" options={genderOptions} value={gender} onChange={setGender} />
        <FilterSelect label="Age" options={ageOptions} value={age} onChange={setAge} />
        <FilterSelect label="Group" options={groupOptions} value={group} onChange={setGroup} />
        <FilterSelect label="Color" options={colorOptions} value={color} onChange={setColor} />
        <FilterSelect label="Quality" options={qualityOptions} value={quality} onChange={setQuality} />
        <Button variant="ghost" onClick={clearAll}>
          Reset
        </Button>
      </div>

      {error && (
        <div className="px-4 py-2 bg-red-950/40 border border-red-800/50 rounded text-red-400 text-xs font-mono">
          {error}
        </div>
      )}

      {/* Result Status Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-slate-400">
            <span className="text-slate-100 font-semibold">{filtered.length}</span>
            <span className="text-slate-500"> of {rawResults.length} records</span>
          </span>
          <StatusPill variant="muted">Close-range demographic pipeline</StatusPill>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={exportCSV} title="Export CSV spreadsheet">
            <IconDownload />
            CSV
          </Button>
          <Button variant="ghost" onClick={exportJSON} title="Export JSON dataset">
            <IconDownload />
            JSON
          </Button>
          <div className="flex items-center gap-0.5 bg-[#0d1117] border border-[#1e2733] rounded p-0.5">
            {["grid", "table"].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setViewMode(m)}
                className={`p-1.5 rounded transition-all cursor-pointer ${
                  viewMode === m ? "bg-cyan-500/10 text-cyan-400" : "text-slate-500 hover:text-slate-300"
                }`}
              >
                {m === "grid" ? <IconGrid /> : <IconTable />}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Results View */}
      {filtered.length === 0 ? (
        <Card className="p-12 flex flex-col items-center gap-3">
          <p className="text-slate-500 text-[13px]">No records match the current filters.</p>
          <Button variant="secondary" onClick={clearAll}>
            Reset filters
          </Button>
        </Card>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
          {filtered.map((p) => (
            <PersonGridCard key={p.person_id || p.id} p={p} onClick={() => setSelected(p)} />
          ))}
        </div>
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#1e2733]">
                {["Track ID", "Gender", "Age", "Group", "Clothing", "Quality", "First Frame"].map(
                  (h) => (
                    <th
                      key={h}
                      className="px-3 py-2 text-left text-[9px] font-mono tracking-widest uppercase text-slate-600"
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <PersonTableRow key={p.person_id || p.id} p={p} onClick={() => setSelected(p)} />
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
