import React, { useState, useEffect } from "react";
import "./Styles/WidgetStyle.css";
import { fetchLatestTelemetry } from "../Utils/thingsboardApi";

function BatteryGauge({
  title = "BATTERY GAUGE",
  dataKey = "battery",
}) {
  const STORAGE_KEY = "avinya_devices";

  const [deviceId, setDeviceId] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [batteryLevel, setBatteryLevel] = useState(0);
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

  const fetchBattery = async (devId) => {
    if (!devId) return;
    const { data } = await fetchLatestTelemetry({
      deviceId: devId,
      keys: [dataKey],
    });
    const latest = data[dataKey]?.[0]?.value;
    const level =
      latest !== undefined
        ? Math.max(0, Math.min(100, parseFloat(latest)))
        : 0;
    setBatteryLevel(level);
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
      await fetchBattery(defaultId);
      setIsConnected(true);
    } catch (err) {
      let msg = "Failed to connect";
      if (err.message.includes("401") || err.message.includes("403"))
        msg = "Invalid or expired session. Please log in again.";
      else if (err.message.includes("404"))
        msg = "Device not found. Verify the Device ID in ThingsBoard.";
      else if (err.message.includes("Failed to fetch"))
        msg = "Unable to reach server. Check your connection.";
      else msg = err.message;
      setError(msg);
      setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReconnect = () => {
    setIsConnected(false);
    setError(null);
    connectToDefault();
  };

  useEffect(() => { connectToDefault(); }, []);

  useEffect(() => {
    if (!isConnected || !deviceId) return;
    const interval = setInterval(async () => {
      try { await fetchBattery(deviceId); }
      catch (err) { console.error("Battery polling error:", err); }
    }, 10000);
    return () => clearInterval(interval);
  }, [isConnected, deviceId]);

  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === STORAGE_KEY) {
        const newDefault = loadDefaultDevice();
        if (newDefault && newDefault !== deviceId) {
          setDeviceId(newDefault);
          setIsConnected(false);
          setTimeout(connectToDefault, 300);
        }
      }
    };
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [deviceId]);

  const shortDeviceId = deviceId
    ? deviceId.length > 16
      ? `${deviceId.slice(0, 8)}…${deviceId.slice(-6)}`
      : deviceId
    : null;

  // Color thresholds
  const getBatteryColor = (level) => {
    if (level > 70) return { fill: "#34c759", glow: "rgba(52,199,89,0.35)" };
    if (level > 30) return { fill: "#ff9f0a", glow: "rgba(255,159,10,0.35)" };
    return { fill: "#ff3b30", glow: "rgba(255,59,48,0.35)" };
  };

  const { fill: batteryFill, glow: batteryGlow } = getBatteryColor(batteryLevel);

  const getStatusLabel = (level) => {
    if (level > 70) return "Good";
    if (level > 30) return "Low";
    return "Critical";
  };

  // SVG battery body dimensions
  const bodyW = 130;
  const bodyH = 56;
  const capW = 8;
  const capH = 24;
  const fillW = Math.max(0, (batteryLevel / 100) * (bodyW - 10));

  return (
    <div className="cs-widget bg-widget">
      {/* Header */}
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
          {/* Device pill */}
          <div className="cs-device-pill">
            <svg className="cs-device-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="5" y="2" width="14" height="20" rx="2" />
              <circle cx="12" cy="17" r="1" />
            </svg>
            <span>{shortDeviceId}</span>
          </div>

          {/* SVG Battery Illustration */}
          <div className="bg-battery-wrap">
            <svg
              viewBox={`0 0 ${bodyW + capW + 6} ${bodyH + 4}`}
              className="bg-battery-svg"
              aria-label={`Battery level ${batteryLevel}%`}
              role="img"
            >
              <defs>
                <clipPath id="bg-clip">
                  <rect x="2" y="2" width={bodyW - 4} height={bodyH - 4} rx="9" />
                </clipPath>
                <filter id="bg-glow">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>

              {/* Battery body outline */}
              <rect
                x="1"
                y="1"
                width={bodyW}
                height={bodyH}
                rx="12"
                ry="12"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                className="bg-body-stroke"
              />

              {/* Fill */}
              <rect
                x="5"
                y="5"
                width={fillW}
                height={bodyH - 10}
                rx="7"
                fill={batteryFill}
                style={{
                  filter: `drop-shadow(0 0 6px ${batteryGlow})`,
                  transition: "width 0.6s cubic-bezier(0.34, 1.56, 0.64, 1), fill 0.4s ease",
                }}
              />

              {/* Shine overlay inside battery */}
              <rect
                x="5"
                y="5"
                width={bodyW - 10}
                height={(bodyH - 10) / 2}
                rx="7"
                fill="rgba(255,255,255,0.07)"
                style={{ pointerEvents: "none" }}
              />

              {/* Percentage text */}
              <text
                x={bodyW / 2}
                y={bodyH / 2 + 1}
                textAnchor="middle"
                dominantBaseline="middle"
                className="bg-pct-text"
              >
                {batteryLevel}%
              </text>

              {/* Battery cap */}
              <rect
                x={bodyW + 3}
                y={(bodyH - capH) / 2}
                width={capW}
                height={capH}
                rx="3"
                className="bg-cap"
              />
            </svg>
          </div>

          {/* Status row */}
          <div className="bg-meta-row">
            <div className="bg-status-chip" style={{ "--chip-color": batteryFill, "--chip-glow": batteryGlow }}>
              <span className="bg-status-dot" style={{ background: batteryFill, boxShadow: `0 0 6px ${batteryGlow}` }} />
              <span className="bg-status-text">{getStatusLabel(batteryLevel)}</span>
            </div>

            <div className="bg-level-bar-wrap">
              <div className="bg-level-bar-track">
                <div
                  className="bg-level-bar-fill"
                  style={{
                    width: `${batteryLevel}%`,
                    background: batteryFill,
                    boxShadow: `0 0 8px ${batteryGlow}`,
                  }}
                />
              </div>
            </div>
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

export default BatteryGauge;