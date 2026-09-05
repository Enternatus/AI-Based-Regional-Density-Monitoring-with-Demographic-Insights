import { useEffect, useMemo, useState } from "react";
import { searchPersons, cropUrl } from "../api.js";
import PersonProfile from "./PersonProfile.jsx";

const FIELD_LABELS = {
  gender: "Gender",
  age: "Age",
  race: "Appearance group",
  clothing_color: "Shirt color",
  height_bucket: "Height estimate",
};

const SOURCE_INFO = {
  settled: { label: "Confirmed", className: "badge-settled" },
  best_raw: { label: "Best available", className: "badge-raw" },
  last_resort: { label: "Low-quality guess", className: "badge-guess" },
};

const QUICK_SEARCHES = [
  "young man",
  "woman in a black shirt",
  "tall person",
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

  async function runSearch(overrides = {}, query = text) {
    setLoading(true);
    setError(null);
    try {
      const merged = { ...filters, ...overrides };
      const data = await searchPersons(query, merged);
      setFilters(data.parsed_filters);
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
    runSearch(resetFilters, "");
  }

  const activeChips = Object.entries(filters).filter(([, value]) => value);
  const visibleResults = useMemo(() => {
    const records = results?.results ?? [];
    if (qualityFilter === "all") return records;
    return records.filter((record) => record.source === qualityFilter);
  }, [results, qualityFilter]);
  const sourceCounts = useMemo(() => {
    const records = results?.results ?? [];
    return {
      all: records.length,
      settled: records.filter((record) => record.source === "settled").length,
      best_raw: records.filter((record) => record.source === "best_raw").length,
      last_resort: records.filter((record) => record.source === "last_resort").length,
    };
  }, [results]);

  return (
    <div className="panel people-panel">
      <div className="panel-header people-header">
        <div>
          <span className="panel-kicker">Research records</span>
          <h1 className="panel-title panel-title-large">People</h1>
        </div>
        <span className="panel-meta">Click a record for its evidence and quality details</span>
      </div>

      <div className="people-disclosure">
        <strong>Interpret carefully.</strong> Attributes are model estimates from video frames, not verified identities. Use the quality label before relying on a result.
      </div>

      <div className="search-input-row">
        <label className="visually-hidden" htmlFor="person-search">Search people records</label>
        <input
          id="person-search"
          className="search-input"
          placeholder='Describe a record, for example: "tall young man in a red shirt"'
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && runSearch()}
        />
        <button className="search-button" onClick={() => runSearch()} disabled={loading} type="button">
          {loading ? "Searching..." : "Search"}
        </button>
      </div>

      <div className="quick-searches" aria-label="Example searches">
        <span>Try:</span>
        {QUICK_SEARCHES.map((query) => <button key={query} type="button" onClick={() => useQuickSearch(query)}>{query}</button>)}
        {(text || activeChips.length > 0) && <button className="clear-search" type="button" onClick={clearSearch}>Clear search</button>}
      </div>

      <div className="chips-row" aria-label="Active search filters">
        {activeChips.length === 0 && <span className="chips-empty">No attribute filters applied</span>}
        {activeChips.map(([field, value]) => (
          <span className="chip" key={field}>
            <span className="chip-field">{FIELD_LABELS[field] ?? field}:</span>{value}
            <button className="chip-remove" onClick={() => removeChip(field)} type="button" aria-label={`Remove ${FIELD_LABELS[field] ?? field} filter`}>x</button>
          </span>
        ))}
      </div>

      {error && <div className="error-banner" role="alert">{error}</div>}

      {results && (
        <>
          <div className="people-results-header">
            <div><strong>{visibleResults.length}</strong> visible record{visibleResults.length === 1 ? "" : "s"}<span className="results-meta"> from {results.result_count} search match{results.result_count === 1 ? "" : "es"}</span></div>
            <div className="quality-filters" aria-label="Filter records by quality">
              {[
                ["all", "All"],
                ["settled", "Confirmed"],
                ["best_raw", "Best available"],
                ["last_resort", "Low-quality guesses"],
              ].map(([value, label]) => (
                <button className={qualityFilter === value ? "active" : ""} key={value} type="button" onClick={() => setQualityFilter(value)}>{label} ({sourceCounts[value]})</button>
              ))}
            </div>
          </div>

          {visibleResults.length === 0 ? (
            <div className="empty-state">No records match this search and quality filter.</div>
          ) : (
            <div className="results-grid">
              {visibleResults.map((record) => (
                <button className="result-card result-card-clickable" key={record.person_id} onClick={() => setSelectedPerson(record)} type="button">
                  {record.crop_path ? (
                    <img className="result-crop" src={cropUrl(record.person_id)} alt={`Representative crop for record ${record.person_id}`} loading="lazy" onError={(event) => (event.currentTarget.style.visibility = "hidden")} />
                  ) : <div className="result-crop result-crop-empty">No representative crop</div>}
                  <div className="result-meta">
                    <div className="result-card-heading"><span className="result-id">Record {record.person_id}</span><SourceBadge source={record.source} /></div>
                    <div className="result-attrs">
                      <span className="attr-line"><span className="attr-label">Gender:</span> {record.gender === "Detecting..." ? <em className="no-estimate">No reliable estimate</em> : (record.gender || <em className="no-estimate">No reliable estimate</em>)}</span>
                      <span className="attr-line"><span className="attr-label">Age range:</span> {record.age || <em className="no-estimate">No reliable estimate</em>}</span>
                      {record.race && <span className="attr-line"><span className="attr-label">Appearance group:</span> {record.race}</span>}
                      {(record.clothing_color || record.height_bucket) && <span className="attr-line attr-labeled">{record.clothing_color && <><span className="attr-label">Shirt:</span> {record.clothing_color}</>}{record.clothing_color && record.height_bucket && " / "}{record.height_bucket && <><span className="attr-label">Height:</span> {record.height_bucket}</>}</span>}
                    </div>
                    <span className="record-action">View evidence</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {selectedPerson && <PersonProfile person={selectedPerson} onClose={() => setSelectedPerson(null)} />}
    </div>
  );
}
