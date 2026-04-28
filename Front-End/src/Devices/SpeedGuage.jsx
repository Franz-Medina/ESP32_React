import React, { useState, useEffect } from "react";
import { arc } from "d3-shape";
import { scaleLinear } from "d3-scale";
import "./Styles/WidgetStyle.css";

const Gauge = ({
  value = 0,
  min = 0,
  max = 120,
  label = "Speed",
  units = "km/h"
}) => {
  const percent = min === max ? 0 : (value - min) / (max - min);

  const angleScale = scaleLinear()
    .domain([0, 1])
    .range([-Math.PI / 2, Math.PI / 2])
    .clamp(true);

  const angle = angleScale(percent);

  const backgroundArc = arc()
    .innerRadius(0.65)
    .outerRadius(1)
    .startAngle(-Math.PI / 2)
    .endAngle(Math.PI / 2)();

  const filledArc = arc()
    .innerRadius(0.65)
    .outerRadius(1)
    .startAngle(-Math.PI / 2)
    .endAngle(angle)();

  const color =
    value < max * 0.5
      ? "#22c55e"
      : value < max * 0.8
      ? "#f59e0b"
      : "#ef4444";

  const marker = [
    Math.cos(angle - Math.PI / 2) * 0.85,
    Math.sin(angle - Math.PI / 2) * 0.85
  ];

  return (
    <div className="text-center">
      <svg width="10em" viewBox="-1 -1 2 1" style={{ overflow: "visible" }}>
        <path d={backgroundArc} fill="#e5e7eb" />
        <path d={filledArc} fill={color} />
        <circle cx={marker[0]} cy={marker[1]} r="0.06" fill="#111827" />
      </svg>

      <div className="mt-2">
        <strong style={{ fontSize: "1.5rem" }}>
          {value.toFixed(1)}
        </strong>{" "}
        {units}
      </div>

      <div style={{ fontSize: "0.9rem", color: "#6b7280" }}>
        {label}
      </div>
    </div>
  );
};

export default function SpeedGauge() {
  const STORAGE_KEY = 'avinya_devices';

  const [deviceId, setDeviceId] = useState(null);
  const [speed, setSpeed] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [token, setToken] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  const TB_BASE_URL = "https://thingsboard.cloud";

  const TB_EMAIL = import.meta.env.VITE_TB_EMAIL;
  const TB_PASSWORD = import.meta.env.VITE_TB_PASSWORD;

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

  const login = async () => {
    const res = await fetch(`${TB_BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: TB_EMAIL,
        password: TB_PASSWORD
      })
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Login failed (${res.status}): ${text}`);
    }

    const data = await res.json();
    setToken(data.token);
    return data.token;
  };

  const fetchSpeed = async (devId, jwt) => {
    if (!devId) return;

    const res = await fetch(
      `${TB_BASE_URL}/api/plugins/telemetry/DEVICE/${devId}/values/timeseries?keys=speed&useLatestTs=true`,
      {
        headers: { "X-Authorization": `Bearer ${jwt}` }
      }
    );

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Telemetry fetch failed (${res.status})`);
    }

    const data = await res.json();

    if (data.speed && data.speed.length > 0) {
      const latestSpeed = parseFloat(data.speed[0].value);
      setSpeed(isNaN(latestSpeed) ? 0 : latestSpeed);
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
      const jwt = await login();
      await fetchSpeed(defaultId, jwt);
      setIsConnected(true);
      console.log("Speed Gauge connected to device:", defaultId);
    } catch (err) {
      console.error("Connection error:", err);

      let msg = "Failed to connect";
      if (err.message.includes("401") || err.message.includes("403")) {
        msg = "Invalid ThingsBoard credentials. Check your .env file.";
      } else if (err.message.includes("404")) {
        msg = "Device not found. Please verify the Device ID.";
      } else if (err.message.includes("Failed to fetch")) {
        msg = "Cannot reach ThingsBoard Cloud. Check your internet connection.";
      } else {
        msg = err.message;
      }

      setError(msg);
      setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReconnect = () => {
    setIsConnected(false);
    setToken(null);
    setError(null);
    connectToDefault();
  };

  useEffect(() => {
    connectToDefault();
  }, []);

  useEffect(() => {
    if (!isConnected || !deviceId) return;

    const interval = setInterval(async () => {
      try {
        const jwt = token || await login();
        await fetchSpeed(deviceId, jwt);
      } catch (err) {
        console.error("Speed polling error:", err);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [isConnected, deviceId, token]);

  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === STORAGE_KEY) {
        const newDefault = loadDefaultDevice();
        if (newDefault && newDefault !== deviceId) {
          setDeviceId(newDefault);
          setIsConnected(false);
          setToken(null);
          setTimeout(connectToDefault, 300);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [deviceId]);

  return (
    <div className="widget">
      <div className="widget-title">SPEED MONITOR</div>

      {isLoading ? (
        <div className="widget-loading">Connecting to ThingsBoard Cloud...</div>
      ) : !deviceId ? (
        <div className="widget-no-default">
          <p>No default device set.</p>
          <small>Go to <strong>Devices</strong> page and set a default Device ID.</small>
        </div>
      ) : (
        <div className="widget-control text-center">
          <div className="widget-status">
            {isConnected ? "Connected to " : "Disconnected from "} 
            <strong style={{ wordBreak: "break-all", fontSize: "0.9em" }}>{deviceId}</strong>
          </div>

          {error && <div className="widget-error">⚠️ {error}</div>}

          {speed !== null ? (
            <Gauge value={speed} min={0} max={120} label="Speed" units="km/h" />
          ) : (
            <div className="widget-loading">Waiting for speed data...</div>
          )}

          {!isConnected && (
            <button className="widget-reconnect-btn" onClick={handleReconnect}>
              Reconnect
            </button>
          )}
        </div>
      )}
    </div>
  );
}

