import React, { useState, useEffect } from "react";
import { arc } from "d3-shape";
import { scaleLinear } from "d3-scale";
import "./Styles/WidgetStyle.css";
import { fetchLatestTelemetry } from "../Utils/thingsboardApi";

/* ── Inner gauge component ── */
const Gauge = ({ value = 0, min = 0, max = 120, units = "km/h" }) => {
  const percent = min === max ? 0 : Math.max(0, Math.min(1, (value - min) / (max - min)));

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

  // Zone-colored segments (decorative ticks behind fill)
  const zones = [
    { start: 0,    end: 0.5,  color: "rgba(52,199,89,0.18)"  },
    { start: 0.5,  end: 0.8,  color: "rgba(255,159,10,0.18)" },
    { start: 0.8,  end: 1,    color: "rgba(255,59,48,0.18)"  },
  ];

  // Active fill color
  const getColor = (pct) => {
    if (pct < 0.5) return "#34c759";
    if (pct < 0.8) return "#ff9f0a";
    return "#ff3b30";
  };
  const fillColor = getColor(percent);
  const colorGlow = `${fillColor}55`;

  // Needle tip
  const needleX = Math.cos(angle - Math.PI / 2) * 0.79;
  const needleY = Math.sin(angle - Math.PI / 2) * 0.79;

  // Tick marks at key percentages
  const ticks = [0, 0.25, 0.5, 0.75, 1];

  return (
    <div className="sg-gauge-wrap">
      <svg viewBox="-1.15 -1.15 2.3 1.28" className="sg-gauge-svg" aria-hidden="true">
        <defs>
          <filter id="sg-glow">
            <feGaussianBlur stdDeviation="0.045" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Zone arcs (decorative background color bands) */}
        {zones.map((z, i) => {
          const za = arc()
            .innerRadius(0.62)
            .outerRadius(1)
            .startAngle(angleScale(z.start) )
            .endAngle(angleScale(z.end))
            .cornerRadius(i === 0 ? 2 : i === zones.length - 1 ? 2 : 0)();
          return <path key={i} d={za} fill={z.color} />;
        })}

        {/* Track */}
        <path d={trackArc} className="sg-track" />

        {/* Fill */}
        {percent > 0 && (
          <path
            d={fillArc}
            fill={fillColor}
            style={{
              filter: `drop-shadow(0 0 0.07px ${colorGlow})`,
              transition: "d 0.4s cubic-bezier(0.4,0,0.2,1), fill 0.4s ease",
            }}
          />
        )}

        {/* Tick marks */}
        {ticks.map((t) => {
          const a = angleScale(t) - Math.PI / 2;
          return (
            <line
              key={t}
              x1={Math.cos(a) * 1.05}
              y1={Math.sin(a) * 1.05}
              x2={Math.cos(a) * 1.14}
              y2={Math.sin(a) * 1.14}
              className="sg-tick"
            />
          );
        })}

        {/* Needle dot */}
        <circle
          cx={needleX}
          cy={needleY}
          r="0.065"
          fill={fillColor}
          style={{
            filter: `drop-shadow(0 0 0.06px ${colorGlow})`,
            transition: "cx 0.4s cubic-bezier(0.4,0,0.2,1), cy 0.4s cubic-bezier(0.4,0,0.2,1), fill 0.4s ease",
          }}
        />

        {/* Hub */}
        <circle cx="0" cy="0" r="0.058" className="sg-hub" />

        {/* Center value */}
        <text x="0" y="-0.18" textAnchor="middle" className="sg-value-text">
          {value.toFixed(1)}
        </text>
        <text x="0" y="-0.02" textAnchor="middle" className="sg-unit-text">
          {units}
        </text>
      </svg>

      {/* Speed zone legend */}
      <div className="sg-legend">
        <span className="sg-legend-item sg-legend--green">Slow</span>
        <span className="sg-legend-item sg-legend--amber">Moderate</span>
        <span className="sg-legend-item sg-legend--red">Fast</span>
      </div>

      {/* Min / max labels */}
      <div className="sg-minmax">
        <span>{min} {units}</span>
        <span>{max} {units}</span>
      </div>
    </div>
  );
};

/* ── Main widget ── */
export default function SpeedGauge() {
  const STORAGE_KEY = "avinya_devices";

  const [deviceId, setDeviceId] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [speed, setSpeed] = useState(null);
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

  const fetchSpeed = async (devId) => {
    if (!devId) return;
    const { data } = await fetchLatestTelemetry({ deviceId: devId, keys: ["speed"] });
    if (data.speed?.length > 0) {
      const v = parseFloat(data.speed[0].value);
      setSpeed(isNaN(v) ? 0 : v);
    } else {
      setSpeed(0);
    }
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
      await fetchSpeed(defaultId);
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
      try { await fetchSpeed(deviceId); }
      catch (err) { console.error("Speed polling error:", err); }
    }, 2000);
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

  return (
    <div className="cs-widget">
      {/* Header */}
      <div className="cs-header">
        <span className="cs-title">SPEED MONITOR</span>
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

          {/* Gauge */}
          {speed !== null ? (
            <Gauge value={speed} min={0} max={120} units="km/h" />
          ) : (
            <div className="cs-state-view" style={{ flex: "unset", padding: "8px 0" }}>
              <div className="cs-spinner"><div className="cs-spinner-arc" /></div>
              <p className="cs-state-label">Waiting for data…</p>
            </div>
          )}

          {/* Live badge */}
          {isConnected && (
            <div className="sg-live-row">
              <div className="sg-live-badge">
                <span className="sg-live-dot" />
                <span>Live · 2s</span>
              </div>
            </div>
          )}

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