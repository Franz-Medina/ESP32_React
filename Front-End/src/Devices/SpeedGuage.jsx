import React, { useState, useEffect } from "react";
import { arc } from "d3-shape";
import { scaleLinear } from "d3-scale";

const Gauge = ({
  value = 0,
  min = 0,
  max = 120,
  label = "Speed",
  units = "km/h"
}) => {
  const percent = (value - min) / (max - min);

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

const SpeedGauge = () => {
  const STORAGE_KEY = 'avinya_devices';

  const loadDefaultDeviceId = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed.defaultId ?? null;
    } catch {
      return null;
    }
  };

  const [deviceId, setDeviceId] = useState(() => loadDefaultDeviceId());
  const [speed, setSpeed] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [token, setToken] = useState(null);

  const TB_EMAIL = import.meta.env.VITE_TB_EMAIL;
  const TB_PASSWORD = import.meta.env.VITE_TB_PASSWORD;

  const login = async () => {
    const res = await fetch(`/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: TB_EMAIL,
        password: TB_PASSWORD
      })
    });

    if (!res.ok) throw new Error("Login failed");
    const data = await res.json();
    setToken(data.token);
    return data.token;
  };

  const fetchSpeed = async (devId) => {
    if (!devId) return;
    try {
      const jwt = token || await login();
      const res = await fetch(
        `/api/plugins/telemetry/DEVICE/${devId}/values/timeseries?keys=speed&limit=1`,
        { headers: { "X-Authorization": `Bearer ${jwt}` } }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.speed && data.speed.length > 0) {
        setSpeed(parseFloat(data.speed[0].value));
      } else {
        setSpeed(0);
      }
      setError(null);
    } catch (err) {
      console.error("FETCH ERROR:", err);
      throw err;
    }
  };

  const connectToDefault = async () => {
    const defaultId = loadDefaultDeviceId();
    if (!defaultId) {
      setError("No default device set. Go to Devices page to set one.");
      setIsLoading(false);
      return;
    }
    setDeviceId(defaultId);
    setIsLoading(true);
    setError(null);
    try {
      await login();
      await fetchSpeed(defaultId);
    } catch (err) {
      let msg = err.message;
      if (msg.includes("404")) msg = "Device not found";
      else if (msg.includes("401") || msg.includes("403")) msg = "Login failed";
      else msg = "Failed to connect";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    connectToDefault();
  }, []);

  useEffect(() => {
    if (!deviceId) return;
    const interval = setInterval(() => {
      fetchSpeed(deviceId).catch(() => {});
    }, 2000);
    return () => clearInterval(interval);
  }, [deviceId]);

  useEffect(() => {
    const handleStorage = (e) => {
      if (e.key === STORAGE_KEY) {
        const newDefault = loadDefaultDeviceId();
        if (newDefault && newDefault !== deviceId) {
          setDeviceId(newDefault);
        }
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [deviceId]);

  return (
    <div className="text-center">
      <h5>Speed Monitor</h5>

      {isLoading ? (
        <p>Loading speed...</p>
      ) : !deviceId ? (
        <div>
          <p>No default device set.</p>
          <small>Go to <strong>Devices</strong> page and set a default Device ID.</small>
        </div>
      ) : error ? (
        <p className="text-danger">{error}</p>
      ) : speed !== null ? (
        <Gauge value={speed} />
      ) : (
        <p>Loading speed...</p>
      )}
    </div>
  );
};

export default SpeedGauge;