import React, { useState, useEffect, useRef } from "react";
import "./Styles/WidgetStyle.css";
import { fetchThingsBoardCounts } from "../Utils/thingsboardApi";

function CountWidgets({ title = "SYSTEM COUNTS" }) {
  const POLL_INTERVAL = 30000;

  const [alarmCount,  setAlarmCount]  = useState(null);
  const [entityCount, setEntityCount] = useState(null);
  const [isLoading,   setIsLoading]   = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error,       setError]       = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [countdown,   setCountdown]   = useState(POLL_INTERVAL / 1000);

  const intervalRef  = useRef(null);
  const countdownRef = useRef(null);

  const fetchCounts = async (isManual = false) => {
    if (isManual) setIsRefreshing(true);
    try {
      const data = await fetchThingsBoardCounts();
      setAlarmCount(data.alarmCount  ?? 0);
      setEntityCount(data.entityCount ?? 0);
      setError(null);
      setLastUpdated(new Date());
      setCountdown(POLL_INTERVAL / 1000);
    } catch (err) {
      console.error("Count fetch error:", err);
      setError("Failed to load counts.");
    } finally {
      setIsLoading(false);
      if (isManual) setIsRefreshing(false);
    }
  };

  const handleRefresh = () => {
    if (isRefreshing) return;
    // reset polling cadence on manual refresh
    clearInterval(intervalRef.current);
    clearInterval(countdownRef.current);
    void fetchCounts(true);
    intervalRef.current  = setInterval(() => void fetchCounts(), POLL_INTERVAL);
    countdownRef.current = setInterval(() => setCountdown(c => c > 0 ? c - 1 : 0), 1000);
  };

  useEffect(() => {
    void fetchCounts();
    intervalRef.current  = setInterval(() => void fetchCounts(), POLL_INTERVAL);
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

  // Alarm severity coloring
  const alarmColor = (() => {
    if (alarmCount === null) return "#aeaeb2";
    if (alarmCount === 0)   return "#34c759";
    if (alarmCount < 5)     return "#ff9f0a";
    return "#ff3b30";
  })();

  const alarmGlow = `${alarmColor}28`;

  return (
    <div className="cs-widget cw-widget">
      {/* ── Header ── */}
      <div className="cs-header">
        <span className="cs-title">{title}</span>
        <div className="cw-header-right">
          {/* Refresh button */}
          <button
            className={`cw-refresh-btn ${isRefreshing ? "cw-refresh-btn--spinning" : ""}`}
            onClick={handleRefresh}
            disabled={isRefreshing}
            aria-label="Refresh counts"
            title="Refresh"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
          </button>
          {/* Live dot */}
          <div className="cs-status-dot cs-status-dot--connected" />
        </div>
      </div>

      {/* ── Body ── */}
      {isLoading ? (
        <div className="cs-state-view">
          <div className="cs-spinner"><div className="cs-spinner-arc" /></div>
          <p className="cs-state-label">Loading counts…</p>
        </div>
      ) : (
        <div className="cs-body cw-body">

          {/* ── Two stat cards ── */}
          <div className="cw-grid">

            {/* Alarms card */}
            <div className="cw-card" style={{ "--cw-accent": alarmColor, "--cw-glow": alarmGlow }}>
              <div className="cw-card-header">
                {/* Bell icon */}
                <div className="cw-icon-bubble">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                  </svg>
                </div>
                <span className="cw-card-label">Active Alarms</span>
              </div>

              <div className="cw-card-value-row">
                <span className="cw-card-value">{alarmCount ?? "—"}</span>
                {alarmCount !== null && (
                  <span className="cw-card-chip" style={{ "--chip-c": alarmColor }}>
                    <span className="cw-chip-dot" style={{ background: alarmColor }} />
                    {alarmCount === 0 ? "Clear" : alarmCount < 5 ? "Warning" : "Critical"}
                  </span>
                )}
              </div>

              {/* Thin accent bar at bottom */}
              <div className="cw-card-accent-bar" style={{ background: alarmColor }} />
            </div>

            {/* Entities card */}
            <div className="cw-card" style={{ "--cw-accent": "#980000", "--cw-glow": "rgba(152,0,0,0.12)" }}>
              <div className="cw-card-header">
                {/* Layers icon */}
                <div className="cw-icon-bubble">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="12 2 2 7 12 12 22 7 12 2" />
                    <polyline points="2 17 12 22 22 17" />
                    <polyline points="2 12 12 17 22 12" />
                  </svg>
                </div>
                <span className="cw-card-label">Total Entities</span>
              </div>

              <div className="cw-card-value-row">
                <span className="cw-card-value">{entityCount ?? "—"}</span>
                <span className="cw-card-chip" style={{ "--chip-c": "#980000" }}>
                  <span className="cw-chip-dot" style={{ background: "#980000" }} />
                  Devices
                </span>
              </div>

              <div className="cw-card-accent-bar" style={{ background: "#980000" }} />
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="cs-error">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {/* ── Footer: last updated + countdown ── */}
          <div className="cw-footer">
            {lastUpdated && (
              <span className="cw-updated">Updated {formatTime(lastUpdated)}</span>
            )}
            <div className="cw-live-badge">
              <span className="cw-live-dot" />
              <span>Refresh in {countdown}s</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CountWidgets;