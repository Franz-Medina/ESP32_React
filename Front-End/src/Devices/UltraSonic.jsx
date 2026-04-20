import React, { useState, useEffect } from "react";
import { arc } from "d3-shape";
import { scaleLinear } from "d3-scale";

const UltraSonicGauge = ({
  value = 0,
  min = 0,
  max = 500,
  label = "Distance",
  units = "cm"
}) => {
  const backgroundArc = arc()
    .innerRadius(0.65)
    .outerRadius(1)
    .startAngle(-Math.PI / 2)
    .endAngle(Math.PI / 2)
    .cornerRadius(1)();

  const percentScale = scaleLinear()
    .domain([min, max])
    .range([0, 1]);

  const percent = percentScale(value);

  const angleScale = scaleLinear()
    .domain([0, 1])
    .range([-Math.PI / 2, Math.PI / 2])
    .clamp(true);

  const angle = angleScale(percent);

  const filledArc = arc()
    .innerRadius(0.65)
    .outerRadius(1)
    .startAngle(-Math.PI / 2)
    .endAngle(angle)
    .cornerRadius(1)();

  const markerLocation = [
    Math.cos(angle - Math.PI / 2) * 0.82,
    Math.sin(angle - Math.PI / 2) * 0.82
  ];

  return (
    <div className="text-center">
      <svg width="9em" viewBox="-1 -1 2 1" style={{ overflow: "visible" }}>
        <path d={backgroundArc} fill="#dbdbe7" />
        <path d={filledArc} fill="#991c1c" />
        <circle
          cx={markerLocation[0]}
          cy={markerLocation[1]}
          r="0.07"
          fill="#2c3e50"
        />
      </svg>
      <div className="mt-2">
        {label}: <strong>{value.toFixed(1)}</strong> {units}
      </div>
    </div>
  );
};

const UltraSonic = () => {
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
  const [connected, setConnected] = useState(false);
  const [distance, setDistance] = useState(null);
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

  const fetchDistance = async (devId) => {
    if (!devId) return;
    try {
      const jwt = token || await login();
      const res = await fetch(
        `/api/plugins/telemetry/DEVICE/${devId}/values/timeseries?keys=distance&limit=1`,
        { headers: { "X-Authorization": `Bearer ${jwt}` } }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.distance && data.distance.length > 0) {
        const latest = parseFloat(data.distance[0].value);
        setDistance(latest);
      } else {
        setDistance(0);
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
      await fetchDistance(defaultId);
      setConnected(true);
    } catch (err) {
      let msg = err.message;
      if (msg.includes("404")) msg = "Device not found";
      else if (msg.includes("401") || msg.includes("403")) msg = "Login failed";
      else msg = "Failed to connect";
      setError(msg);
      setConnected(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = () => {
    setConnected(false);
    setIsLoading(true);
    setError(null);
    setToken(null);
    setTimeout(connectToDefault, 100);
  };

  useEffect(() => {
    connectToDefault();
  }, []);

  useEffect(() => {
    if (!connected || !deviceId) return;
    const interval = setInterval(() => {
      fetchDistance(deviceId).catch(() => {});
    }, 2000);
    return () => clearInterval(interval);
  }, [connected, deviceId]);

  useEffect(() => {
    const handleStorage = (e) => {
      if (e.key === STORAGE_KEY) {
        const newDefault = loadDefaultDeviceId();
        if (newDefault && newDefault !== deviceId) {
          setDeviceId(newDefault);
          handleDisconnect();
        }
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [deviceId]);

  return (
    <div className="text-center">
      <h5>Ultrasonic Distance</h5>

      {isLoading ? (
        <p>Loading distance...</p>
      ) : !deviceId ? (
        <div>
          <p>No default device set.</p>
          <small>Go to <strong>Devices</strong> page and set a default Device ID.</small>
        </div>
      ) : error ? (
        <p className="text-danger">{error}</p>
      ) : distance !== null ? (
        <UltraSonicGauge value={distance} />
      ) : (
        <p>Loading distance...</p>
      )}
    </div>
  );
};

export default UltraSonic;