import React, { useState, useEffect, useRef } from "react";
import "./Styles/WidgetStyle.css";
import { fetchThingsBoardEntities } from "../Utils/thingsboardApi";

const POLL_INTERVAL = 30000;

function EntitiesTable() {
  const [entities,     setEntities]     = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error,        setError]        = useState("");
  const [lastUpdated,  setLastUpdated]  = useState(null);
  const [searchQuery,  setSearchQuery]  = useState("");
  const [sortKey,      setSortKey]      = useState("name");
  const [sortDir,      setSortDir]      = useState("asc");
  const [countdown,    setCountdown]    = useState(POLL_INTERVAL / 1000);

  const intervalRef  = useRef(null);
  const countdownRef = useRef(null);

  const fetchEntities = async (isManual = false) => {
    if (isManual) setIsRefreshing(true);
    else if (entities.length === 0) setLoading(true);
    setError("");
    try {
      const data = await fetchThingsBoardEntities();
      setEntities(data.entities || []);
      setLastUpdated(new Date());
      setCountdown(POLL_INTERVAL / 1000);
    } catch (err) {
      console.error("FETCH ERROR:", err);
      setError("Failed to load entities.");
    } finally {
      setLoading(false);
      if (isManual) setIsRefreshing(false);
    }
  };

  const handleRefresh = () => {
    if (isRefreshing) return;
    clearInterval(intervalRef.current);
    clearInterval(countdownRef.current);
    void fetchEntities(true);
    intervalRef.current  = setInterval(() => void fetchEntities(), POLL_INTERVAL);
    countdownRef.current = setInterval(() => setCountdown(c => c > 0 ? c - 1 : 0), 1000);
  };

  useEffect(() => {
    void fetchEntities();
    intervalRef.current  = setInterval(() => void fetchEntities(), POLL_INTERVAL);
    countdownRef.current = setInterval(() => setCountdown(c => c > 0 ? c - 1 : 0), 1000);
    return () => {
      clearInterval(intervalRef.current);
      clearInterval(countdownRef.current);
    };
  }, []);

  const formatTime = (date) => {
    if (!date) return null;
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  };

  /* ── Sort + filter ── */
  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };

  const displayed = [...entities]
    .filter(e => {
      const q = searchQuery.toLowerCase();
      return (
        (e.name  || "").toLowerCase().includes(q) ||
        (e.type  || "").toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      let av, bv;
      if (sortKey === "name")   { av = a.name  || ""; bv = b.name  || ""; }
      else if (sortKey === "type") { av = a.type  || ""; bv = b.type  || ""; }
      else {
        av = a.additionalInfo?.randomValue ?? -Infinity;
        bv = b.additionalInfo?.randomValue ?? -Infinity;
        return sortDir === "asc" ? av - bv : bv - av;
      }
      return sortDir === "asc"
        ? av.localeCompare(bv)
        : bv.localeCompare(av);
    });

  /* ── Sort chevron ── */
  const SortChevron = ({ col }) => (
    <span className={`et-chevron ${sortKey === col ? "et-chevron--active" : ""} ${sortKey === col && sortDir === "desc" ? "et-chevron--desc" : ""}`}>
      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </span>
  );

  /* ── Entity type color ── */
  const typeColor = (type = "") => {
    const t = type.toLowerCase();
    if (t.includes("device"))  return { bg: "rgba(52,199,89,0.1)",  border: "rgba(52,199,89,0.2)",  text: "#34c759" };
    if (t.includes("asset"))   return { bg: "rgba(10,132,255,0.1)", border: "rgba(10,132,255,0.2)", text: "#0a84ff" };
    if (t.includes("alarm"))   return { bg: "rgba(255,59,48,0.1)",  border: "rgba(255,59,48,0.2)",  text: "#ff3b30" };
    if (t.includes("user"))    return { bg: "rgba(255,159,10,0.1)", border: "rgba(255,159,10,0.2)", text: "#ff9f0a" };
    return { bg: "rgba(142,142,147,0.1)", border: "rgba(142,142,147,0.2)", text: "#8e8e93" };
  };

  return (
    <div className="cs-widget et-widget">
      {/* ── Header ── */}
      <div className="cs-header">
        <span className="cs-title">ENTITIES TABLE</span>
        <div className="et-header-right">
          <button
            className={`cw-refresh-btn ${isRefreshing ? "cw-refresh-btn--spinning" : ""}`}
            onClick={handleRefresh}
            disabled={isRefreshing}
            aria-label="Refresh"
            title="Refresh"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
          </button>
          <div className="cs-status-dot cs-status-dot--connected" />
        </div>
      </div>

      {/* ── Search bar ── */}
      <div className="et-search-wrap">
        <svg className="et-search-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
        </svg>
        <input
          className="et-search-input"
          type="text"
          placeholder="Search entities…"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          aria-label="Search entities"
        />
        {searchQuery && (
          <button className="et-search-clear" onClick={() => setSearchQuery("")} aria-label="Clear search">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        )}
      </div>

      {/* ── Body ── */}
      {loading ? (
        <div className="cs-state-view">
          <div className="cs-spinner"><div className="cs-spinner-arc" /></div>
          <p className="cs-state-label">Loading entities…</p>
        </div>
      ) : (
        <div className="et-body">
          {error && (
            <div className="cs-error">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              <span>{error}</span>
            </div>
          )}

          {/* Table */}
          <div className="et-table-wrap">
            <table className="et-table">
              <thead>
                <tr>
                  <th className="et-th et-th--sortable" onClick={() => handleSort("name")}>
                    Name <SortChevron col="name" />
                  </th>
                  <th className="et-th et-th--sortable" onClick={() => handleSort("type")}>
                    Type <SortChevron col="type" />
                  </th>
                  <th className="et-th et-th--sortable et-th--num" onClick={() => handleSort("random")}>
                    Value <SortChevron col="random" />
                  </th>
                </tr>
              </thead>

              <tbody>
                {displayed.length === 0 ? (
                  <tr>
                    <td colSpan="3" className="et-empty">
                      <span className="et-empty-icon">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
                        </svg>
                      </span>
                      {searchQuery ? `No results for "${searchQuery}"` : "No entities found"}
                    </td>
                  </tr>
                ) : (
                  displayed.map((entity, index) => {
                    const tc = typeColor(entity.type);
                    const rv = entity.additionalInfo?.randomValue;
                    return (
                      <tr key={entity.id?.id || index} className="et-row">
                        <td className="et-td et-td--name">
                          <div className="et-name-cell">
                            <span className="et-name-dot" />
                            <span className="et-name-text">{entity.name || "—"}</span>
                          </div>
                        </td>
                        <td className="et-td">
                          <span
                            className="et-type-chip"
                            style={{ background: tc.bg, borderColor: tc.border, color: tc.text }}
                          >
                            {entity.type || "Unknown"}
                          </span>
                        </td>
                        <td className="et-td et-td--num">
                          <span className={`et-value ${rv === undefined || rv === null ? "et-value--empty" : ""}`}>
                            {rv !== undefined && rv !== null ? Number(rv).toFixed(2) : "—"}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="et-footer">
            <span className="et-count-pill">
              {displayed.length} / {entities.length} entities
            </span>
            <div className="cw-live-badge">
              <span className="cw-live-dot" />
              <span>{lastUpdated ? `Updated ${formatTime(lastUpdated)}` : `Refresh in ${countdown}s`}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default EntitiesTable;