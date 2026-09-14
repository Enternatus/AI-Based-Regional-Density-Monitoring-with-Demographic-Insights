import React from "react";

// ── Status pill ──────────────────────────────────────────────────────────────
const pillStyles = {
  live: "bg-green-950/60 text-green-400 border-green-800/60",
  warning: "bg-amber-950/60 text-amber-400 border-amber-800/60",
  critical: "bg-red-950/60 text-red-400 border-red-800/60",
  muted: "bg-slate-800/60 text-slate-400 border-slate-700/60",
  violet: "bg-violet-950/60 text-violet-400 border-violet-800/60",
  cyan: "bg-cyan-950/60 text-cyan-400 border-cyan-800/60",
};

export function StatusPill({ variant = "live", children }) {
  const dotColor =
    variant === "live"
      ? "bg-green-400 animate-pulse"
      : variant === "warning"
      ? "bg-amber-400"
      : variant === "critical"
      ? "bg-red-400"
      : variant === "violet"
      ? "bg-violet-400"
      : variant === "cyan"
      ? "bg-cyan-400"
      : "bg-slate-500";

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono font-medium uppercase tracking-widest border ${
        pillStyles[variant] || pillStyles.muted
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
      {children}
    </span>
  );
}

// ── Density badge ────────────────────────────────────────────────────────────
const densityMap = {
  low: { label: "Low", variant: "live" },
  medium: { label: "Medium", variant: "warning" },
  moderate: { label: "Moderate", variant: "warning" },
  high: { label: "High", variant: "critical" },
  critical: { label: "Critical", variant: "critical" },
};

export function DensityBadge({ state = "low" }) {
  const d = densityMap[state?.toLowerCase()] ?? densityMap.low;
  return <StatusPill variant={d.variant}>{d.label}</StatusPill>;
}

// ── Quality badge ────────────────────────────────────────────────────────────
const qualityMap = {
  settled: { label: "Confirmed", variant: "live" },
  confirmed: { label: "Confirmed", variant: "live" },
  best_raw: { label: "Best Available", variant: "warning" },
  best_available: { label: "Best Available", variant: "warning" },
  last_resort: { label: "Low-Quality Guess", variant: "critical" },
  low_quality: { label: "Low Quality", variant: "critical" },
};

export function QualityBadge({ state = "confirmed" }) {
  const q = qualityMap[state?.toLowerCase()] ?? qualityMap.confirmed;
  return <StatusPill variant={q.variant}>{q.label}</StatusPill>;
}

// ── Card ─────────────────────────────────────────────────────────────────────
export function Card({ children, className = "", onClick }) {
  return (
    <div
      className={`bg-[#0f1318] border border-[#1e2733] rounded ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

// ── Section label ─────────────────────────────────────────────────────────────
export function SectionLabel({ children }) {
  return (
    <p className="text-[10px] font-mono font-medium tracking-[0.15em] uppercase text-slate-500 mb-3">
      {children}
    </p>
  );
}

// ── Divider ───────────────────────────────────────────────────────────────────
export function Divider({ className = "" }) {
  return <div className={`border-t border-[#1e2733] ${className}`} />;
}

// ── Mono text ─────────────────────────────────────────────────────────────────
export function Mono({ children, className = "" }) {
  return (
    <span className={`font-mono text-[11px] text-slate-400 ${className}`}>
      {children}
    </span>
  );
}

// ── Trend indicator ───────────────────────────────────────────────────────────
export function TrendIndicator({ value = 0 }) {
  if (value === 0 || value === "stable")
    return <span className="text-slate-500 text-xs font-mono">▬ Stable</span>;
  if (value === "rising" || (typeof value === "number" && value > 0)) {
    return (
      <span className="text-xs font-mono font-medium text-amber-400">
        ▲ {typeof value === "number" ? `+${value}` : "Rising"}
      </span>
    );
  }
  return (
    <span className="text-xs font-mono font-medium text-green-400">
      ▼ {typeof value === "number" ? `${value}` : "Falling"}
    </span>
  );
}

// ── Mini bar ──────────────────────────────────────────────────────────────────
export function MiniBar({ pct = 0, color = "cyan" }) {
  const colorMap = {
    cyan: "bg-cyan-500",
    green: "bg-green-500",
    amber: "bg-amber-500",
    red: "bg-red-500",
    violet: "bg-violet-500",
    slate: "bg-slate-600",
  };
  return (
    <div className="h-1 w-full bg-slate-800 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full ${colorMap[color] ?? "bg-cyan-500"}`}
        style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
      />
    </div>
  );
}

// ── Button ────────────────────────────────────────────────────────────────────
export function Button({
  children,
  variant = "secondary",
  onClick,
  className = "",
  disabled = false,
  type = "button",
  title,
}) {
  const base =
    "inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-500 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer";
  const variants = {
    primary: "bg-cyan-500 text-slate-950 hover:bg-cyan-400 active:bg-cyan-600",
    secondary:
      "bg-[#161b22] border border-[#1e2733] text-slate-300 hover:border-slate-600 hover:text-slate-100 active:bg-[#0f1318]",
    ghost: "text-slate-400 hover:text-slate-200 hover:bg-white/5 active:bg-white/10",
  };
  return (
    <button
      type={type}
      className={`${base} ${variants[variant] || variants.secondary} ${className}`}
      onClick={onClick}
      disabled={disabled}
      title={title}
    >
      {children}
    </button>
  );
}

// ── Icon helpers (SVG) ─────────────────────────────────────────────────
export function IconArrowUp({ className = "w-3 h-3" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 16 16">
      <path
        d="M8 12V4M4 8l4-4 4 4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconArrowDown({ className = "w-3 h-3" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 16 16">
      <path
        d="M8 4v8M4 8l4 4 4-4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconSearch({ className = "w-4 h-4" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 20 20">
      <path
        d="M13 13l3.5 3.5M8.5 15a6.5 6.5 0 100-13 6.5 6.5 0 000 13z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function IconGrid({ className = "w-4 h-4" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 16 16">
      <rect x="2" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" />
      <rect x="9" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" />
      <rect x="2" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" />
      <rect x="9" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

export function IconTable({ className = "w-4 h-4" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 16 16">
      <path
        d="M2 4h12M2 8h12M2 12h12M6 3v10M10 3v10"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function IconChevronDown({ className = "w-3.5 h-3.5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 12 12">
      <path
        d="M3 4.5l3 3 3-3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconDownload({ className = "w-3.5 h-3.5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 16 16">
      <path
        d="M8 3v7M5 7l3 3 3-3M3 12h10"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconInfo({ className = "w-3.5 h-3.5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 16 16">
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.2" />
      <path
        d="M8 7v4M8 5.5v.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}
