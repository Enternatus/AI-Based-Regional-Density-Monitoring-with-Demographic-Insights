import React, { useEffect, useMemo, useState } from "react";
import { getPeople, cropUrl } from "../api/crowdsense.js";
import DataSourceBadge from "./common/DataSourceBadge.jsx";
import PersonProfile from "./PersonProfile.jsx";

const FIELD_LABELS = {
  gender: "Gender",
  age: "Age",
  race: "Appearance Group",
  clothing_color: "Shirt Color",
};

const SOURCE_INFO = {
  settled: { label: "Confirmed", className: "badge-settled" },
  best_raw: { label: "Best Available", className: "badge-raw" },
  last_resort: { label: "Low-Quality Guess", className: "badge-guess" },
};

const QUICK_SEARCHES = [
  "man in grey shirt",
  "woman in a black shirt",
  "person in red",
  "indian man",
];

function SourceBadge({ source }) {
  const info = SOURCE_INFO[source] ?? { label: "Unresolved", className: "badge-locked" };
  return <span className={`badge ${info.className}`}>{info.label}</span>;
}

export default function SearchPanel() {
  const [text, setText] = useState("");
  const [filters, setFilters] = useState({});
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [qualityFilter, setQualityFilter] = useState("all");
  const [viewMode, setViewMode] = useState("grid"); // "grid" | "table"

  // Dropdown filter state
  const [filterGender, setFilterGender] = useState("all");
  const [filterAge, setFilterAge] = useState("all");
  const [filterRace, setFilterRace] = useState("all");
  const [filterColor, setFilterColor] = useState("all");

  async function runSearch(overrides = {}, query = text) {
    setLoading(true);
    setError(null);
    try {
      const merged = { ...filters, ...overrides };
      const data = await getPeople(query, merged);
      setFilters(data.parsed_filters ?? {});
      setResults(data);
    } catch {
      setError("Could not reach the dashboard backend. Start the local API, then try again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    runSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function removeChip(field) {
    runSearch({ ...filters, [field]: null });
  }

  function useQuickSearch(query) {
    setText(query);
    runSearch({}, query);
  }

  function clearSearch() {
    const resetFilters = Object.fromEntries(Object.keys(filters).map((field) => [field, null]));
    setText("");
    setFilterGender("all");
    setFilterAge("all");
    setFilterRace("all");
    setFilterColor("all");
    setQualityFilter("all");
    runSearch(resetFilters, "");
  }

  // Filter visible records based on both natural language chips, quality filter, and dropdown filters
  const visibleResults = useMemo(() => {
    let records = results?.results ?? [];

    if (qualityFilter !== "all") {
      records = records.filter((r) => r.source === qualityFilter);
    }
    if (filterGender !== "all") {
      records = records.filter((r) => (r.gender || "").toLowerCase() === filterGender.toLowerCase());
    }
    if (filterAge !== "all") {
      records = records.filter((r) => r.age === filterAge);
    }
    if (filterRace !== "all") {
      records = records.filter((r) => {
        const norm = (r.race || "").replace("Latino_Hispanic", "Hispanic / Latino");
        return norm.toLowerCase() === filterRace.toLowerCase();
      });
    }
    if (filterColor !== "all") {
      records = records.filter((r) => (r.clothing_color || "").toLowerCase() === filterColor.toLowerCase());
    }

    return records;
  }, [results, qualityFilter, filterGender, filterAge, filterRace, filterColor]);

  // Overall metrics across loaded dataset
  const sourceCounts = useMemo(() => {
    const records = results?.results ?? [];
    return {
      all: records.length,
      settled: records.filter((r) => r.source === "settled").length,
      best_raw: records.filter((r) => r.source === "best_raw").length,
      last_resort: records.filter((r) => r.source === "last_resort").length,
    };
  }, [results]);

  // Export handlers
  function exportCSV() {
    if (!visibleResults.length) return;
    const headers = ["Track ID", "Gender", "Gender Confidence %", "Age Bracket", "Appearance Group", "Shirt Color", "Quality Source", "First Frame", "Last Frame"];
    const rows = visibleResults.map((r) => [
      r.person_id,
      r.gender || "",
      r.gender_conf != null ? r.gender_conf.toFixed(1) : "",
      r.age || "",
      (r.race || "").replace("Latino_Hispanic", "Hispanic / Latino"),
      r.clothing_color || "",
      r.source || "",
      r.first_seen_frame ?? "",
      r.last_seen_frame ?? "",
    ]);

    const csvContent = [headers.join(","), ...rows.map((row) => row.map((val) => `"${val}"`).join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `crowdsense_people_export_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function exportJSON() {
    if (!visibleResults.length) return;
    const jsonContent = JSON.stringify(visibleResults, null, 2);
    const blob = new Blob([jsonContent], { type: "application/json;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `crowdsense_people_export_${Date.now()}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  const activeChips = Object.entries(filters).filter(([, value]) => value);

  return (
    <div className="panel people-panel">
      {/* Header */}
      <div className="panel-header people-header">
        <div>
          <span className="panel-kicker">Multi-Attribute Demographic Telemetry</span>
          <h1 className="panel-title panel-title-large">People Explorer</h1>
        </div>
        <div className="header-meta-group">
          <DataSourceBadge type="people" />
        </div>
      </div>

      {/* Summary KPI Strip */}
      <div className="people-kpi-strip">
        <div className="kpi-mini-card">
          <span className="kpi-mini-label">Total Indexed</span>
          <strong className="kpi-mini-val">{sourceCounts.all}</strong>
        </div>
        <div className="kpi-mini-card kpi-settled">
          <span className="kpi-mini-label">Confirmed (Settled)</span>
          <strong className="kpi-mini-val">{sourceCounts.settled}</strong>
        </div>
        <div className="kpi-mini-card kpi-raw">
          <span className="kpi-mini-label">Best Available</span>
          <strong className="kpi-mini-val">{sourceCounts.best_raw}</strong>
        </div>
        <div className="kpi-mini-card kpi-guess">
          <span className="kpi-mini-label">Low-Quality Guesses</span>
          <strong className="kpi-mini-val">{sourceCounts.last_resort}</strong>
        </div>
      </div>

      {/* Scientific Disclosure Notice */}
      <div className="people-disclosure">
        <span className="disclosure-icon">ℹ️</span>
        <span>
          <strong>Ethical & Accuracy Notice:</strong> Demographic attributes (gender, age bracket, appearance group) and clothing color are derived from multi-frame computer vision estimates. Use the quality provenance badges to gauge reliability.
        </span>
      </div>

      {/* Search Input Bar */}
      <div className="search-input-row">
        <label className="visually-hidden" htmlFor="person-search">Search people records</label>
        <input
          id="person-search"
          className="search-input"
          placeholder='Describe attributes (e.g. "young man in black shirt", "person in red")'
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && runSearch()}
        />
        <button className="search-button" onClick={() => runSearch()} disabled={loading} type="button">
          {loading ? "Searching..." : "Search"}
        </button>
      </div>

      {/* Quick Search Chips */}
      <div className="quick-searches" aria-label="Example searches">
        <span className="quick-label">Suggestions:</span>
        {QUICK_SEARCHES.map((query) => (
          <button key={query} type="button" onClick={() => useQuickSearch(query)} className="quick-search-btn">
            {query}
          </button>
        ))}
        {(text || activeChips.length > 0 || filterGender !== "all" || filterAge !== "all" || filterRace !== "all" || filterColor !== "all" || qualityFilter !== "all") && (
          <button className="clear-search-btn" type="button" onClick={clearSearch}>
            Reset Filters
          </button>
        )}
      </div>

      {/* Multi-Attribute Filter Bar */}
      <div className="filter-controls-bar">
        <div className="dropdown-filter-group">
          <label>Gender:</label>
          <select value={filterGender} onChange={(e) => setFilterGender(e.target.value)}>
            <option value="all">All Genders</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
          </select>
        </div>

        <div className="dropdown-filter-group">
          <label>Age:</label>
          <select value={filterAge} onChange={(e) => setFilterAge(e.target.value)}>
            <option value="all">All Ages</option>
            <option value="10-19">10-19</option>
            <option value="20-29">20-29</option>
            <option value="30-39">30-39</option>
            <option value="40-49">40-49</option>
          </select>
        </div>

        <div className="dropdown-filter-group">
          <label>Group:</label>
          <select value={filterRace} onChange={(e) => setFilterRace(e.target.value)}>
            <option value="all">All Groups</option>
            <option value="White">White</option>
            <option value="East Asian">East Asian</option>
            <option value="Indian">Indian</option>
            <option value="Middle Eastern">Middle Eastern</option>
            <option value="Hispanic / Latino">Hispanic / Latino</option>
          </select>
        </div>

        <div className="dropdown-filter-group">
          <label>Shirt Color:</label>
          <select value={filterColor} onChange={(e) => setFilterColor(e.target.value)}>
            <option value="all">All Colors</option>
            <option value="black">Black</option>
            <option value="grey">Grey</option>
            <option value="white">White</option>
            <option value="red">Red</option>
            <option value="blue">Blue</option>
            <option value="green">Green</option>
            <option value="yellow">Yellow</option>
          </select>
        </div>

        {/* View Mode & Export Toolbar */}
        <div className="view-mode-toolbar">
          <div className="view-mode-toggle">
            <button
              type="button"
              className={`toggle-btn ${viewMode === "grid" ? "active" : ""}`}
              onClick={() => setViewMode("grid")}
              title="Grid View"
            >
              ⊞ Cards
            </button>
            <button
              type="button"
              className={`toggle-btn ${viewMode === "table" ? "active" : ""}`}
              onClick={() => setViewMode("table")}
              title="Table View"
            >
              ☰ Table
            </button>
          </div>

          <div className="export-btn-group">
            <button type="button" className="export-btn" onClick={exportCSV} title="Export CSV spreadsheet">
              📥 CSV
            </button>
            <button type="button" className="export-btn" onClick={exportJSON} title="Export JSON dataset">
              📥 JSON
            </button>
          </div>
        </div>
      </div>

      {/* Active Natural-Language Filter Chips */}
      {activeChips.length > 0 && (
        <div className="chips-row" aria-label="Active search filters">
          <span className="chips-label">Search Query Filters:</span>
          {activeChips.map(([field, value]) => (
            <span className="chip" key={field}>
              <span className="chip-field">{FIELD_LABELS[field] ?? field}:</span> {value}
              <button className="chip-remove" onClick={() => removeChip(field)} type="button" aria-label={`Remove ${FIELD_LABELS[field] ?? field} filter`}>
                &times;
              </button>
            </span>
          ))}
        </div>
      )}

      {error && <div className="error-banner" role="alert">{error}</div>}

      {/* Results Header & Quality Filter Tabs */}
      {results && (
        <>
          <div className="people-results-header">
            <div>
              {filterGender !== "all" || filterAge !== "all" || filterRace !== "all" || filterColor !== "all" || qualityFilter !== "all" ? (
                <>
                  <strong>{visibleResults.length}</strong> shown after local filters
                  <span className="results-meta"> (from {results.result_count} search match{results.result_count === 1 ? "" : "es"})</span>
                </>
              ) : (
                <>
                  <strong>{visibleResults.length}</strong> record{visibleResults.length === 1 ? "" : "s"} matched
                  <span className="results-meta"> (out of {results.result_count} indexed)</span>
                </>
              )}
            </div>
            <div className="quality-filters" aria-label="Filter records by quality">
              {[
                ["all", "All"],
                ["settled", "Confirmed"],
                ["best_raw", "Best Available"],
                ["last_resort", "Low-Quality"],
              ].map(([value, label]) => (
                <button
                  className={`quality-tab-btn ${qualityFilter === value ? "active" : ""}`}
                  key={value}
                  type="button"
                  onClick={() => setQualityFilter(value)}
                >
                  {label} ({sourceCounts[value]})
                </button>
              ))}
            </div>
          </div>

          {visibleResults.length === 0 ? (
            <div className="empty-state-card">
              <div className="empty-state-icon">🔎</div>
              <h3 className="empty-state-title">No matching person records found</h3>
              <p className="empty-state-message">Try adjusting your attribute filters or search keywords.</p>
              <button type="button" className="clear-search-btn" onClick={clearSearch}>
                Clear All Filters
              </button>
            </div>
          ) : viewMode === "grid" ? (
            /* Grid Mode */
            <div className="results-grid">
              {visibleResults.map((record) => (
                <button
                  className="result-card result-card-clickable"
                  key={record.person_id}
                  onClick={() => setSelectedPerson(record)}
                  type="button"
                >
                  {record.crop_path ? (
                    <img
                      className="result-crop"
                      src={cropUrl(record.person_id)}
                      alt={`Representative crop for record ${record.person_id}`}
                      loading="lazy"
                      onError={(event) => (event.currentTarget.style.visibility = "hidden")}
                    />
                  ) : (
                    <div className="result-crop result-crop-empty">No crop</div>
                  )}
                  <div className="result-meta">
                    <div className="result-card-heading">
                      <span className="result-id">Track #{record.person_id}</span>
                      <SourceBadge source={record.source} />
                    </div>
                    <div className="result-attrs">
                      <span className="attr-line">
                        <span className="attr-label">Gender:</span>{" "}
                        {record.gender === "Detecting..." ? (
                          <em className="no-estimate">No reliable estimate</em>
                        ) : (
                          record.gender || <em className="no-estimate">No estimate</em>
                        )}
                      </span>
                      <span className="attr-line">
                        <span className="attr-label">Age bracket:</span>{" "}
                        {record.age || <em className="no-estimate">No estimate</em>}
                      </span>
                      {record.race && (
                        <span className="attr-line">
                          <span className="attr-label">Appearance:</span>{" "}
                          {record.race.replace("Latino_Hispanic", "Hispanic / Latino")}
                        </span>
                      )}
                      {record.clothing_color && (
                        <span className="attr-line attr-labeled">
                          <span className="attr-label">Shirt:</span>{" "}
                          <span className="shirt-tag">{record.clothing_color}</span>
                        </span>
                      )}
                    </div>
                    <span className="record-action">Inspect Evidence &rarr;</span>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            /* Table / List Mode */
            <div className="table-responsive">
              <table className="people-data-table">
                <thead>
                  <tr>
                    <th>Track</th>
                    <th>Crop</th>
                    <th>Gender</th>
                    <th>Age</th>
                    <th>Appearance Group</th>
                    <th>Shirt Color</th>
                    <th>Quality Status</th>
                    <th>Frame Span</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleResults.map((record) => {
                    const firstF = record.first_seen_frame ?? 0;
                    const lastF = record.last_seen_frame ?? firstF;
                    return (
                      <tr key={record.person_id} onClick={() => setSelectedPerson(record)} className="table-row-clickable">
                        <td className="cell-id">#{record.person_id}</td>
                        <td className="cell-crop">
                          {record.crop_path ? (
                            <img
                              className="table-thumb"
                              src={cropUrl(record.person_id)}
                              alt={`Crop #${record.person_id}`}
                              loading="lazy"
                            />
                          ) : (
                            <div className="table-thumb-empty">--</div>
                          )}
                        </td>
                        <td>{record.gender || "--"}</td>
                        <td>{record.age || "--"}</td>
                        <td>{(record.race || "--").replace("Latino_Hispanic", "Hispanic / Latino")}</td>
                        <td>
                          {record.clothing_color ? (
                            <span className="table-color-pill">{record.clothing_color}</span>
                          ) : (
                            "--"
                          )}
                        </td>
                        <td>
                          <SourceBadge source={record.source} />
                        </td>
                        <td className="cell-span">
                          {firstF} – {lastF} ({Math.max(1, lastF - firstF)}f)
                        </td>
                        <td>
                          <button
                            type="button"
                            className="table-action-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedPerson(record);
                            }}
                          >
                            Evidence
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {selectedPerson && <PersonProfile person={selectedPerson} onClose={() => setSelectedPerson(null)} />}
    </div>
  );
}
