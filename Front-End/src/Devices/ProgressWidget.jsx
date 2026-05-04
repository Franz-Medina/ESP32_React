import React, { useEffect, useState } from "react";
import "./Styles/WidgetStyle.css";
import { fetchLatestTelemetry } from "../Utils/thingsboardApi";

function ProgressWidget({
  title = "Progress",
  dataKey = "progress",
  unit = "%",
  min = 0,
  max = 100,
  color = "#980000",
}) {
  const STORAGE_KEY = "avinya_devices";

  const [deviceId, setDeviceId] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [value, setValue] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadDefaultDevice = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed.defaultId ?? null;
    } catch (e) {
      console.error("Failed to load default device:", e);
      return null;
    }
  };

  const fetchProgress = async (targetDeviceId) => {
    if (!targetDeviceId) return;
    const { data } = await fetchLatestTelemetry({
      deviceId: targetDeviceId,
      keys: [dataKey],
    });
    const latest = data[dataKey]?.[0]?.value;
    const numeric =
      latest !== undefined
        ? Math.max(min, Math.min(max, parseFloat(latest)))
        : 0;
    setValue(Number.isFinite(numeric) ? numeric : 0);
  };

  const connectToDefault = async () => {
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
      await fetchProgress(defaultId);
      setIsConnected(true);
    } catch (err) {
      let msg = "Failed to connect.";
      if (err.message.includes("401") || err.message.includes("403"))
        msg = "Invalid or expired session. Please log in again.";
      else if (err.message.includes("404"))
        msg = "Device not found. Verify the Device ID in ThingsBoard.";
      else if (err.message.includes("Failed to fetch"))
        msg = "Unable to reach server. Check your connection.";
      else if (err.message) msg = err.message;
      setError(msg);
      setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReconnect = () => {
    setIsConnected(false);
    setError(null);
    void connectToDefault();
  };

  useEffect(() => { void connectToDefault(); }, []);

  useEffect(() => {
    if (!isConnected || !deviceId) return;
    const interval = setInterval(async () => {
      try { await fetchProgress(deviceId); }
      catch (err) { console.error("Progress polling error:", err); }
    }, 10000);
    return () => clearInterval(interval);
  }, [isConnected, deviceId]);

  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key !== STORAGE_KEY) return;
      const newDefault = loadDefaultDevice();
      if (newDefault && newDefault !== deviceId) {
        setDeviceId(newDefault);
        setIsConnected(false);
        window.setTimeout(() => void connectToDefault(), 300);
      }
    };
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [deviceId]);

  const percentage = min === max ? 0 : ((value - min) / (max - min)) * 100;

  const shortDeviceId = deviceId
    ? deviceId.length > 16
      ? `${deviceId.slice(0, 8)}…${deviceId.slice(-6)}`
      : deviceId
    : null;

  const colorGlow = `${color}33`; // ~20% opacity hex

  const R = 52;
  const cx = 70;
  const cy = 66;
  const startAngle = -Math.PI;
  const endAngle = 0;
  const totalAngle = Math.PI;
  const currentAngle = startAngle + (percentage / 100) * totalAngle;

  const toCartesian = (angle, radius) => ({
    x: cx + radius * Math.cos(angle),
    y: cy + radius * Math.sin(angle),
  });

  const trackStart = toCartesian(startAngle, R);
  const trackEnd = toCartesian(endAngle, R);

  const fillEnd = toCartesian(currentAngle, R);
  const largeArc = percentage > 50 ? 1 : 0;

  const needlePt = toCartesian(currentAngle, R - 10);

  return (
    <div className="cs-widget pw-widget">
      <div className="cs-header">
        <span className="cs-title">{title}</span>
        <div className={`cs-status-dot ${isConnected ? "cs-status-dot--connected" : ""}`} />
      </div>

      {isLoading ? (
        <div className="cs-state-view">
          <div className="cs-spinner"><div className="cs-spinner-arc" /></div>
          <p className="cs-state-label">Connecting…</p>
        </div>
      ) : !deviceId ? (
        <div className="cs-state-view">
          <div className="cs-icon-circle cs-icon-circle--warn">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <p className="cs-state-label">No device selected</p>
          <p className="cs-state-sublabel">Open <strong>Devices</strong> and set a default.</p>
        </div>
      ) : (
        <div className="cs-body">
          <div className="cs-device-pill">
            <svg className="cs-device-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="5" y="2" width="14" height="20" rx="2" />
              <circle cx="12" cy="17" r="1" />
            </svg>
            <span>{shortDeviceId}</span>
          </div>

          <div className="pw-gauge-wrap">
            <svg viewBox="0 0 140 76" className="pw-gauge-svg" aria-hidden="true">
              <defs>
                <filter id="pw-glow">
                  <feGaussianBlur stdDeviation="2.5" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>

              <path
                d={`M ${trackStart.x} ${trackStart.y} A ${R} ${R} 0 0 1 ${trackEnd.x} ${trackEnd.y}`}
                fill="none"
                strokeWidth="10"
                strokeLinecap="round"
                className="pw-track"
              />

              {percentage > 0 && (
                <path
                  d={`M ${trackStart.x} ${trackStart.y} A ${R} ${R} 0 ${largeArc} 1 ${fillEnd.x} ${fillEnd.y}`}
                  fill="none"
                  stroke={color}
                  strokeWidth="10"
                  strokeLinecap="round"
                  style={{
                    filter: `drop-shadow(0 0 5px ${colorGlow})`,
                    transition: "d 0.8s cubic-bezier(0.4,0,0.2,1), stroke 0.4s ease",
                  }}
                />
              )}

              <circle
                cx={needlePt.x}
                cy={needlePt.y}
                r="5"
                fill={color}
                style={{
                  filter: `drop-shadow(0 0 4px ${colorGlow})`,
                  transition: "cx 0.8s cubic-bezier(0.4,0,0.2,1), cy 0.8s cubic-bezier(0.4,0,0.2,1)",
                }}
              />

              <text x={cx} y={cy - 6} textAnchor="middle" className="pw-gauge-value">
                {value.toFixed(1)}
              </text>
              <text x={cx} y={cy + 10} textAnchor="middle" className="pw-gauge-unit">
                {unit}
              </text>
            </svg>

            <div className="pw-gauge-minmax">
              <span>{min}{unit}</span>
              <span>{max}{unit}</span>
            </div>
          </div>

          <div className="pw-bar-wrap">
            <div className="pw-bar-track">
              <div
                className="pw-bar-fill"
                style={{
                  width: `${percentage}%`,
                  background: color,
                  boxShadow: `0 0 8px ${colorGlow}`,
                }}
              />
            </div>
            <span className="pw-bar-pct">{percentage.toFixed(0)}%</span>
          </div>

          {error && (
            <div className="cs-error">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {!isConnected && !isLoading && (
            <button className="cs-reconnect-btn" onClick={handleReconnect}>
              Reconnect
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default ProgressWidget;