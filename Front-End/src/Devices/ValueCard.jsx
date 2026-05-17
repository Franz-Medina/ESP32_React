import React, { useEffect, useState, useRef, useCallback } from "react";
import "./Styles/WidgetStyle.css";
import { fetchLatestTelemetry } from "../Utils/thingsboardApi";

function ValueCard({
  title         = "Value Card",
  dataKey       = "value",
  label         = "Value",
  unit          = "",
  decimals      = 1,
  pollingMs     = 5000,
  showSparkline = true,
  showTrend     = true,
  deviceId: assignedDeviceId = "",
  thresholds    = [
    { value: 0,  color: "#34c759", label: "Normal"   },
    { value: 70, color: "#ff9f0a", label: "Warning"  },
    { value: 90, color: "#ff3b30", label: "Critical" },
  ],
}) {
  const STORAGE_KEY  = "avinya_devices";
  const SETTINGS_KEY = `vc2_${title.replace(/\W+/g, "_")}`;
  const MAX_HISTORY  = 24;

  const loadSettings = () => {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return null;
  };

  const saved = loadSettings();

  const [cfg, setCfg] = useState({
    title,
    dataKey,
    label,
    unit,
    decimals,
    pollingMs,
    showSparkline,
    showTrend,
    thresholds,
    ...saved,
  });

  const [deviceId, setDeviceId]       = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [value, setValue]             = useState(null);
  const [history, setHistory]         = useState([]);
  const [isLoading, setIsLoading]     = useState(true);
  const [error, setError]             = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [draft, setDraft]             = useState(cfg);
  const intervalRef                   = useRef(null);

  useEffect(() => {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(cfg)); } catch {}
  }, [cfg]);

  const loadDefaultDevice = () => {
    if (assignedDeviceId) return assignedDeviceId;

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw).defaultId ?? null;
    } catch {
      return null;
    }
  };

  const fetchValue = useCallback(async (devId, key) => {
    if (!devId || !key) return;
    const { data } = await fetchLatestTelemetry({ deviceId: devId, keys: [key] });
    const raw = data[key]?.[0]?.value;
    if (raw !== undefined) {
      const n = parseFloat(raw);
      if (!isNaN(n)) {
        setValue(n);
        setHistory(h => [...h.slice(-(MAX_HISTORY - 1)), n]);
      }
    }
  }, []);

  const connectToDefault = useCallback(async (key) => {
    const defaultId = loadDefaultDevice();
    if (!defaultId) {
      setError("No default device set. Go to Devices page to set one.");
      setIsConnected(false);
      setIsLoading(false);
      return;
    }
    setDeviceId(defaultId);
    setIsLoading(true);
    setError(null);
    try {
      await fetchValue(defaultId, key);
      setIsConnected(true);
    } catch (err) {
      let msg = "Failed to connect.";
      if (err.message.includes("401") || err.message.includes("403")) msg = "Invalid or expired session.";
      else if (err.message.includes("404"))                            msg = "Device not found.";
      else if (err.message.includes("Failed to fetch"))               msg = "Unable to reach server.";
      else if (err.message)                                            msg = err.message;
      setError(msg);
      setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  }, [fetchValue]);

  useEffect(() => {
    void connectToDefault(cfg.dataKey);
  }, [assignedDeviceId, cfg.dataKey, connectToDefault]);

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (!isConnected || !deviceId) return;
    intervalRef.current = setInterval(() => {
      fetchValue(deviceId, cfg.dataKey).catch(console.error);
    }, cfg.pollingMs);
    return () => clearInterval(intervalRef.current);
  }, [isConnected, deviceId, cfg.dataKey, cfg.pollingMs, fetchValue]);

  useEffect(() => {
    const onStorage = (e) => {
      if (e.key !== STORAGE_KEY) return;
      const newId = loadDefaultDevice();
      if (newId && newId !== deviceId) {
        setDeviceId(newId);
        setIsConnected(false);
        setTimeout(() => void connectToDefault(cfg.dataKey), 300);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [deviceId, cfg.dataKey, assignedDeviceId, connectToDefault]);

  const handleReconnect = () => {
    setIsConnected(false);
    setError(null);
    void connectToDefault(cfg.dataKey);
  };

  const openSettings  = () => { setDraft({ ...cfg }); setShowSettings(true); };
  const closeSettings = () => setShowSettings(false);

  const applySettings = () => {
    const next = {
      ...draft,
      decimals:   Math.max(0, Math.min(6, parseInt(draft.decimals, 10) || 0)),
      pollingMs:  Math.max(1000, parseInt(draft.pollingMs, 10) || 5000),
      thresholds: [...draft.thresholds]
        .map(t => ({ ...t, value: parseFloat(t.value) || 0 }))
        .sort((a, b) => a.value - b.value),
    };
    const keyChanged = next.dataKey !== cfg.dataKey;
    setCfg(next);
    setShowSettings(false);
    if (keyChanged) {
      setValue(null);
      setHistory([]);
      void connectToDefault(next.dataKey);
    }
  };

  const addThreshold = () =>
    setDraft(d => ({ ...d, thresholds: [...d.thresholds, { value: 0, color: "#34c759", label: "New" }] }));

  const removeThreshold = (i) =>
    setDraft(d => ({ ...d, thresholds: d.thresholds.filter((_, idx) => idx !== i) }));

  const updateThreshold = (i, field, val) =>
    setDraft(d => ({
      ...d,
      thresholds: d.thresholds.map((t, idx) => idx === i ? { ...t, [field]: val } : t),
    }));

  /* ── Derived display values ── */
  const shortDeviceId = deviceId
    ? deviceId.length > 16 ? `${deviceId.slice(0, 8)}…${deviceId.slice(-6)}` : deviceId
    : null;

  const getActive = (v) => {
    if (!cfg.thresholds?.length) return { color: "#980000", label: null };
    let a = cfg.thresholds[0];
    for (const t of cfg.thresholds) { if (v !== null && v >= t.value) a = t; }
    return a;
  };
  const active      = getActive(value);
  const activeColor = active.color;
  const activeLabel = active.label;

  const trend = (() => {
    if (!cfg.showTrend || history.length < 2) return null;
    const d = history[history.length - 1] - history[history.length - 2];
    return Math.abs(d) < 0.001 ? null : d > 0 ? "up" : "down";
  })();

  const Sparkline = ({ data, color }) => {
    if (data.length < 2) return null;
    const W = 150, H = 34, P = 4;
    const mn = Math.min(...data), mx = Math.max(...data), range = mx - mn || 1;
    const pts = data.map((v, i) => {
      const x = P + (i / (data.length - 1)) * (W - P * 2);
      const y = H - P - ((v - mn) / range) * (H - P * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    const fill = [...pts, `${(W - P).toFixed(1)},${H}`, `${P},${H}`].join(" ");
    const [lx, ly] = pts[pts.length - 1].split(",").map(Number);
    return (
      <svg viewBox={`0 0 ${W} ${H}`} className="vc2-spark-svg" aria-hidden="true">
        <defs>
          <linearGradient id="vc2-g" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={color} stopOpacity="0.2" />
            <stop offset="100%" stopColor={color} stopOpacity="0"   />
          </linearGradient>
        </defs>
        <polygon points={fill} fill="url(#vc2-g)" />
        <polyline points={pts.join(" ")} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={lx} cy={ly} r="2.5" fill={color} />
      </svg>
    );
  };

  const ThresholdBar = ({ v, ts }) => {
    if (!ts?.length) return null;
    const maxVal = (ts[ts.length - 1].value > 0 ? ts[ts.length - 1].value : 100) * 1.1;
    const pct = v !== null ? Math.max(0, Math.min(100, (v / maxVal) * 100)) : 0;
    return (
      <div className="vc2-tbar">
        {ts.map((t, i) => {
          const next = i < ts.length - 1 ? ts[i + 1].value : maxVal;
          return <div key={i} className="vc2-tbar-seg" style={{ background: t.color, flex: Math.max(next - t.value, 1) }} />;
        })}
        <div className="vc2-tbar-tick" style={{ left: `${pct}%` }} />
      </div>
    );
  };

  return (
    <div className="cs-widget vc2-widget" style={{ "--vc2-color": activeColor }}>

      <div className="cs-header">
        <span className="cs-title">{cfg.title}</span>
        <div className="vc2-header-right">
          <button className="vc2-gear-btn" onClick={openSettings} aria-label="Widget settings" title="Settings">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
          <div className={`cs-status-dot ${isConnected ? "cs-status-dot--connected" : ""}`} />
        </div>
      </div>

      {showSettings && (
        <div className="vc2-settings-wrap">
          <div className="vc2-sp-header">
            <span className="vc2-sp-title">Widget Settings</span>
            <button className="vc2-sp-close" onClick={closeSettings} aria-label="Close">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          </div>

          <div className="vc2-sp-body">
            <label className="vc2-sp-label">Card title
              <input className="vc2-sp-input" value={draft.title}
                onChange={e => setDraft(d => ({ ...d, title: e.target.value }))} placeholder="e.g. Room Temperature" />
            </label>

            <label className="vc2-sp-label">Telemetry key
              <input className="vc2-sp-input vc2-mono" value={draft.dataKey}
                onChange={e => setDraft(d => ({ ...d, dataKey: e.target.value }))} placeholder="e.g. temperature" />
            </label>

            <label className="vc2-sp-label">Label
              <input className="vc2-sp-input" value={draft.label}
                onChange={e => setDraft(d => ({ ...d, label: e.target.value }))} placeholder="e.g. Temperature" />
            </label>

            <label className="vc2-sp-label">Unit
              <input className="vc2-sp-input" value={draft.unit}
                onChange={e => setDraft(d => ({ ...d, unit: e.target.value }))} placeholder="e.g. °C  %  km/h" />
            </label>

            <div className="vc2-sp-row2">
              <label className="vc2-sp-label">Decimals
                <input className="vc2-sp-input" type="number" min="0" max="6" value={draft.decimals}
                  onChange={e => setDraft(d => ({ ...d, decimals: e.target.value }))} />
              </label>
              <label className="vc2-sp-label">Poll interval (ms)
                <input className="vc2-sp-input" type="number" min="1000" step="500" value={draft.pollingMs}
                  onChange={e => setDraft(d => ({ ...d, pollingMs: e.target.value }))} />
              </label>
            </div>

            <div className="vc2-sp-toggles">
              <div className="vc2-sp-toggle-row">
                <span className="vc2-sp-toggle-label">Show sparkline</span>
                <button
                  className={`vc2-mini-toggle ${draft.showSparkline ? "on" : ""}`}
                  onClick={() => setDraft(d => ({ ...d, showSparkline: !d.showSparkline }))}
                  role="switch" aria-checked={draft.showSparkline}
                ><span className="vc2-mini-knob" /></button>
              </div>
              <div className="vc2-sp-toggle-row">
                <span className="vc2-sp-toggle-label">Show trend arrow</span>
                <button
                  className={`vc2-mini-toggle ${draft.showTrend ? "on" : ""}`}
                  onClick={() => setDraft(d => ({ ...d, showTrend: !d.showTrend }))}
                  role="switch" aria-checked={draft.showTrend}
                ><span className="vc2-mini-knob" /></button>
              </div>
            </div>

            <div className="vc2-sp-thresh-section">
              <div className="vc2-sp-thresh-header">
                <span className="vc2-sp-thresh-title">Color thresholds</span>
                <button className="vc2-sp-add" onClick={addThreshold}>+ Add</button>
              </div>
              {draft.thresholds.map((t, i) => (
                <div key={i} className="vc2-sp-thresh-row">
                  <input type="color" className="vc2-sp-color" value={t.color}
                    onChange={e => updateThreshold(i, "color", e.target.value)} />
                  <input className="vc2-sp-input vc2-sp-thresh-val" type="number"
                    value={t.value} onChange={e => updateThreshold(i, "value", e.target.value)} placeholder="≥ value" />
                  <input className="vc2-sp-input vc2-sp-thresh-lbl"
                    value={t.label} onChange={e => updateThreshold(i, "label", e.target.value)} placeholder="Label" />
                  <button className="vc2-sp-rm" onClick={() => removeThreshold(i)}
                    disabled={draft.thresholds.length <= 1} aria-label="Remove">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="vc2-sp-footer">
            <button className="vc2-sp-btn-cancel" onClick={closeSettings}>Cancel</button>
            <button className="vc2-sp-btn-apply" onClick={applySettings}>Apply</button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="cs-state-view">
          <div className="cs-spinner"><div className="cs-spinner-arc" /></div>
          <p className="cs-state-label">Connecting…</p>
        </div>
      ) : !deviceId ? (
        <div className="cs-state-view">
          <div className="cs-icon-circle cs-icon-circle--warn">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          </div>
          <p className="cs-state-label">No device selected</p>
          <p className="cs-state-sublabel">Open <strong>Devices</strong> and set a default.</p>
        </div>
      ) : (
        <div className="cs-body vc2-body">
          <div className="cs-device-pill">
            <svg className="cs-device-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="5" y="2" width="14" height="20" rx="2"/><circle cx="12" cy="17" r="1"/>
            </svg>
            <span>{shortDeviceId}</span>
          </div>

          <div className="vc2-value-block">
            <div className="vc2-value-row">
              <span className="vc2-value">
                {value !== null
                  ? value.toFixed(Math.max(0, Math.min(6, parseInt(cfg.decimals, 10) || 0)))
                  : "—"}
              </span>
              {cfg.unit && <span className="vc2-unit">{cfg.unit}</span>}
              {cfg.showTrend && trend && (
                <span className={`vc2-trend vc2-trend--${trend}`}>
                  {trend === "up"
                    ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>
                    : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>
                  }
                </span>
              )}
            </div>

            <div className="vc2-sublabel-row">
              <span className="vc2-data-label">{cfg.label}</span>
              {activeLabel && (
                <span className="vc2-status-chip" style={{ "--chip-c": activeColor }}>
                  <span className="vc2-chip-dot" style={{ background: activeColor }} />
                  {activeLabel}
                </span>
              )}
            </div>
          </div>

          {cfg.thresholds?.length > 0 && (
            <ThresholdBar v={value} ts={cfg.thresholds} />
          )}

          {cfg.showSparkline && history.length > 1 && (
            <div className="vc2-spark-wrap">
              <span className="vc2-spark-label">Last {history.length} readings</span>
              <Sparkline data={history} color={activeColor} />
            </div>
          )}

          {isConnected && (
            <div className="vc2-footer">
              <div className="vc2-live-badge">
                <span className="vc2-live-dot" />
                <span>Live · {cfg.pollingMs / 1000}s</span>
              </div>
              <span className="vc2-key-pill">{cfg.dataKey}</span>
            </div>
          )}

          {error && (
            <div className="cs-error">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              <span>{error}</span>
            </div>
          )}

          {!isConnected && !isLoading && (
            <button className="cs-reconnect-btn" onClick={handleReconnect}>Reconnect</button>
          )}
        </div>
      )}
    </div>
  );
}

export default ValueCard;