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
  const [isConnected, setIsConnected] = useState(false);
  const [value, setValue] = useState(0);
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

  const fetchProgress = async (devId) => {
    if (!devId) return;
    try {
      const jwt = token || await login();
      const res = await fetch(
        `/api/plugins/telemetry/DEVICE/${devId}/values/timeseries?keys=${dataKey}&limit=1`,
        { headers: { "X-Authorization": `Bearer ${jwt}` } }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const latest = data[dataKey]?.[0]?.value;
      const numeric = latest !== undefined ? Math.max(min, Math.min(max, parseFloat(latest))) : 0;
      setValue(numeric);
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
      await fetchProgress(defaultId);
      setIsConnected(true);
    } catch (err) {
      let msg = err.message;
      if (msg.includes("404")) msg = "Device not found";
      else if (msg.includes("401") || msg.includes("403")) msg = "Login failed";
      else msg = "Failed to connect";
      setError(msg);
      setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = () => {
    setIsConnected(false);
    setIsLoading(true);
    setError(null);
    setToken(null);
    setTimeout(connectToDefault, 100);
  };

  useEffect(() => {
    connectToDefault();
  }, []);

  useEffect(() => {
    if (!isConnected || !deviceId) return;
    const interval = setInterval(() => {
      fetchProgress(deviceId).catch(() => {});
    }, 10000);
    return () => clearInterval(interval);
  }, [isConnected, deviceId]);

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

  const percentage = ((value - min) / (max - min)) * 100;

  return (
    <div className="widget">
      <div className="widget-title">{title}</div>

      {isLoading ? (
        <div className="widget-loading">Connecting to default device...</div>
      ) : !deviceId ? (
        <div className="widget-no-default">
          <p>No default device set.</p>
          <small>Go to <strong>Devices</strong> page and set a default Device ID.</small>
        </div>
      ) : (
        <div className="widget-control">
          <div className="widget-status">
            Connected to <strong>{deviceId}</strong>
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
        </div>
      )}
    </div>
  );
}

export default ProgressWidget;