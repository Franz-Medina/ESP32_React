import React, { useState, useEffect } from "react";
import "./Styles/WidgetStyle.css";

function ProgressWidget({ 
  title = "Progress", 
  dataKey = "progress", 
  unit = "%",
  min = 0,
  max = 100,
  color = "#980000"
}) {
  const STORAGE_KEY = 'avinya_devices';

  const [deviceId, setDeviceId] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [value, setValue] = useState(0);
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

  const fetchProgress = async (devId, jwt) => {
    if (!devId) return;

    const res = await fetch(
      `${TB_BASE_URL}/api/plugins/telemetry/DEVICE/${devId}/values/timeseries?keys=${dataKey}&useLatestTs=true`,
      {
        headers: { "X-Authorization": `Bearer ${jwt}` }
      }
    );

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Telemetry fetch failed (${res.status})`);
    }

    const data = await res.json();
    const latest = data[dataKey]?.[0]?.value;

    const numeric = latest !== undefined 
      ? Math.max(min, Math.min(max, parseFloat(latest))) 
      : 0;

    setValue(numeric);
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
      await fetchProgress(defaultId, jwt);
      setIsConnected(true);
      console.log("Progress Widget connected to device: ", defaultId);
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
        await fetchProgress(deviceId, jwt);
      } catch (err) {
        console.error("Progress polling error:", err);
      }
    }, 10000);

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

  const percentage = min === max ? 0 : ((value - min) / (max - min)) * 100;

  return (
    <div className="widget">
      <div className="widget-title">{title}</div>

      {isLoading ? (
        <div className="widget-loading">Connecting to ThingsBoard Cloud...</div>
      ) : !deviceId ? (
        <div className="widget-no-default">
          <p>No default device set.</p>
          <small>Go to <strong>Devices</strong> page and set a default Device ID.</small>
        </div>
      ) : (
        <div className="widget-control">
          <div className="widget-status">
            {isConnected ? "Connected to " : "Disconnected from "} 
            <strong style={{ wordBreak: "break-all", fontSize: "0.9em" }}>{deviceId}</strong>
          </div>

          {error && <div className="widget-error">⚠️ {error}</div>}

          <div className="widget-container">
            <div className="widget-bar-bg">
              <div 
                className="widget-bar-fill"
                style={{ 
                  width: `${percentage}%`,
                  backgroundColor: color 
                }}
              />
            </div>
            
            <div className="widget-value">
              {value.toFixed(1)}{unit}
            </div>
          </div>

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

export default ProgressWidget;