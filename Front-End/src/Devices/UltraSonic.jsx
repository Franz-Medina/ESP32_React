import React, { useState, useEffect } from "react";
import { arc } from "d3-shape";
import { scaleLinear } from "d3-scale";
import "./Styles/WidgetStyle.css";
import { fetchLatestTelemetry } from "../Utils/thingsboardApi";

const UltraSonicGauge = ({
  value = 0,
  min = 0,
  max = 500,
  units = "cm",
}) => {
  const percentScale = scaleLinear().domain([min, max]).range([0, 1]);
  const percent = percentScale(Math.max(min, Math.min(max, value)));

  const angleScale = scaleLinear()
    .domain([0, 1])
    .range([-Math.PI / 2, Math.PI / 2])
    .clamp(true);

  const angle = angleScale(percent);

  const trackArc = arc()
    .innerRadius(0.62)
    .outerRadius(1)
    .startAngle(-Math.PI / 2)
    .endAngle(Math.PI / 2)
    .cornerRadius(2)();

  const fillArc = arc()
    .innerRadius(0.62)
    .outerRadius(1)
    .startAngle(-Math.PI / 2)
    .endAngle(angle)
    .cornerRadius(2)();

  const needleX = Math.cos(angle - Math.PI / 2) * 0.8;
  const needleY = Math.sin(angle - Math.PI / 2) * 0.8;

  const getColor = (pct) => {
    if (pct > 0.6) return "#34c759";
    if (pct > 0.3) return "#ff9f0a";
    return "#ff3b30";
  };
  const fillColor = getColor(percent);

  const ticks = [0, 0.25, 0.5, 0.75, 1];

  return (
    <div className="us-gauge-wrap">
      <svg viewBox="-1.1 -1.1 2.2 1.22" className="us-gauge-svg" aria-hidden="true">
        <defs>
          <filter id="us-glow">
            <feGaussianBlur stdDeviation="0.04" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        <path d={trackArc} className="us-track" />

        {percent > 0 && (
          <path
            d={fillArc}
            fill={fillColor}
            filter="url(#us-glow)"
            style={{
              filter: `drop-shadow(0 0 0.06px ${fillColor})`,
              transition: "d 0.35s cubic-bezier(0.4,0,0.2,1), fill 0.4s ease",
            }}
          />
        )}

        {ticks.map((t) => {
          const a = angleScale(t) - Math.PI / 2;
          const innerR = 1.04;
          const outerR = 1.12;
          return (
            <line
              key={t}
              x1={Math.cos(a) * innerR}
              y1={Math.sin(a) * innerR}
              x2={Math.cos(a) * outerR}
              y2={Math.sin(a) * outerR}
              className="us-tick"
            />
          );
        })}

        <circle
          cx={needleX}
          cy={needleY}
          r="0.065"
          fill={fillColor}
          style={{
            filter: `drop-shadow(0 0 0.05px ${fillColor})`,
            transition: "cx 0.35s cubic-bezier(0.4,0,0.2,1), cy 0.35s cubic-bezier(0.4,0,0.2,1), fill 0.4s ease",
          }}
        />

        <circle cx="0" cy="0" r="0.06" className="us-hub" />
      </svg>

      <div className="us-readout">
        <span className="us-value">{value !== null ? value.toFixed(1) : "—"}</span>
        <span className="us-unit">{units}</span>
      </div>

      <div className="us-minmax">
        <span>{min}{units}</span>
        <span>{max}{units}</span>
      </div>
    </div>
  );
};

export default function UltraSonic() {
  const STORAGE_KEY = "avinya_devices";

  const [deviceId, setDeviceId] = useState(null);
  const [connected, setConnected] = useState(false);
  const [distance, setDistance] = useState(null);
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

  const fetchDistance = async (devId) => {
    if (!devId) return;
    const { data } = await fetchLatestTelemetry({
      deviceId: devId,
      keys: ["distance"],
    });
    if (data.distance?.length > 0) {
      const latestValue = parseFloat(data.distance[0].value);
      setDistance(isNaN(latestValue) ? 0 : latestValue);
    } else {
      setDistance(0);
    }
  };

  const connectToDefault = async () => {
    const defaultId = loadDefaultDevice();
    if (!defaultId) {
      setError("No default device set. Go to Devices page to set one.");
      setConnected(false);
      setIsLoading(false);
      return;
    }
    setDeviceId(defaultId);
    setIsLoading(true);
    setError(null);
    try {
      await fetchDistance(defaultId);
      setConnected(true);
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
      setConnected(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReconnect = () => {
    setConnected(false);
    setError(null);
    connectToDefault();
  };

  useEffect(() => { connectToDefault(); }, []);

  useEffect(() => {
    if (!connected || !deviceId) return;
    const interval = setInterval(async () => {
      try { await fetchDistance(deviceId); }
      catch (err) { console.error("Polling error:", err); }
    }, 2000);
    return () => clearInterval(interval);
  }, [connected, deviceId]);

  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === STORAGE_KEY) {
        const newDefault = loadDefaultDevice();
        if (newDefault && newDefault !== deviceId) {
          setDeviceId(newDefault);
          setConnected(false);
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

  return (
    <div className="cs-widget">
      <div className="cs-header">
        <span className="cs-title">ULTRASONIC</span>
        <div className={`cs-status-dot ${connected ? "cs-status-dot--connected" : ""}`} />
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

          {distance !== null ? (
            <UltraSonicGauge
              value={distance}
              min={0}
              max={500}
              units="cm"
            />
          ) : (
            <div className="cs-state-view" style={{ flex: "unset", padding: "8px 0" }}>
              <div className="cs-spinner"><div className="cs-spinner-arc" /></div>
              <p className="cs-state-label">Waiting for data…</p>
            </div>
          )}

          <div className="us-live-row">
            <div className="us-sonar-icon" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <path d="M3 12a9 9 0 0 0 9 9" opacity="0.35" />
                <path d="M3 12a9 9 0 0 1 9-9" opacity="0.35" />
                <path d="M7 12a5 5 0 0 0 5 5" opacity="0.6" />
                <path d="M7 12a5 5 0 0 1 5-5" opacity="0.6" />
                <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
                <path d="M21 12a9 9 0 0 1-9 9" opacity="0.35" />
                <path d="M21 12a9 9 0 0 0-9-9" opacity="0.35" />
                <path d="M17 12a5 5 0 0 1-5 5" opacity="0.6" />
                <path d="M17 12a5 5 0 0 0-5-5" opacity="0.6" />
              </svg>
            </div>
            {connected && (
              <div className="us-live-badge">
                <span className="us-live-dot" />
                <span>Live · 2s</span>
              </div>
            )}
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

          {!connected && !isLoading && (
            <button className="cs-reconnect-btn" onClick={handleReconnect}>
              Reconnect
            </button>
          )}
        </div>
      )}
    </div>
  );
}