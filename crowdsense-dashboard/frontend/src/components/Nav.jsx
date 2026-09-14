import React from "react";

const tabs = [
  { id: "overview", label: "Overview" },
  { id: "density", label: "Density Monitor" },
  { id: "people", label: "Demographic Profiles" },
  { id: "split", label: "Split View" },
];

export default function Nav({ active, onChange }) {
  return (
    <nav className="flex items-center gap-0.5 px-5 h-10 bg-[#090b0e] border-b border-[#1e2733] shrink-0">
      {tabs.map((tab) => {
        const isActive = tab.id === active;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`px-3.5 h-7 rounded text-[12px] font-medium transition-all duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-500 cursor-pointer ${
              isActive
                ? "bg-cyan-500/10 border border-cyan-500/30 text-cyan-400"
                : "text-slate-500 hover:text-slate-300 hover:bg-white/[0.03] border border-transparent"
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}
