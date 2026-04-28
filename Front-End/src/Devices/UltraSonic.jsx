import React, { useState, useEffect } from "react";
import { arc } from "d3-shape";
import { scaleLinear } from "d3-scale";
import "./Styles/WidgetStyle.css";

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

export default function UltraSonic() {
  const STORAGE_KEY = 'avinya_devices';

  const [deviceId, setDeviceId] = useState(null);
  const [connected, setConnected] = useState(false);
  const [distance, setDistance] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [token, setToken] = useState(null);

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

  const fetchDistance = async (devId, jwt) => {
    if (!devId) return;

    const res = await fetch(
      `${TB_BASE_URL}/api/plugins/telemetry/DEVICE/${devId}/values/timeseries?keys=distance&useLatestTs=true`,
      {
        headers: { "X-Authorization": `Bearer ${jwt}` }
      }
    );

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Telemetry fetch failed (${res.status})`);
    }

    const data = await res.json();

    if (data.distance && data.distance.length > 0) {
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
      const jwt = await login();
      await fetchDistance(defaultId, jwt);
      setConnected(true);
      console.log("Ultrasonic connected to device: ", defaultId);
    } catch (err) {
      console.error("Connection error:", err);

      let msg = "Failed to connect";
      if (err.message.includes("401") || err.message.includes("403")) {
        msg = "Invalid ThingsBoard credentials. Check your .env file.";
      } else if (err.message.includes("404")) {
        msg = "Device not found. Please verify the Device ID in ThingsBoard.";
      } else if (err.message.includes("Failed to fetch")) {
        msg = "Cannot reach ThingsBoard Cloud. Check your internet connection.";
      } else {
        msg = err.message;
      }

      setError(msg);
      setConnected(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReconnect = () => {
    setConnected(false);
    setToken(null);
    setError(null);
    connectToDefault();
  };

  useEffect(() => {
    connectToDefault();
  }, []);

  useEffect(() => {
    if (!connected || !deviceId) return;

    const interval = setInterval(async () => {
      try {
        const jwt = token || await login();
        await fetchDistance(deviceId, jwt);
      } catch (err) {
        console.error("Polling error:", err);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [connected, deviceId, token]);

  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === STORAGE_KEY) {
        const newDefault = loadDefaultDevice();
        if (newDefault && newDefault !== deviceId) {
          setDeviceId(newDefault);
          setConnected(false);
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
      <div className="widget-title">ULTRASONIC SENSOR</div>

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
            {connected ? "Connected to " : "Disconnected from "} 
            <strong style={{ wordBreak: "break-all", fontSize: "0.9em" }}>{deviceId}</strong>
          </div>

          {error && <div className="widget-error">⚠️ {error}</div>}

          {distance !== null ? (
            <UltraSonicGauge 
              value={distance} 
              min={0} 
              max={500} 
              label="Distance" 
              units="cm" 
            />
          ) : (
            <div className="widget-loading">Waiting for sensor data...</div>
          )}

          {!connected && (
            <button className="widget-reconnect-btn" onClick={handleReconnect}>
              Reconnect
            </button>
          )}
        </div>
      )}
    </div>
  );
}