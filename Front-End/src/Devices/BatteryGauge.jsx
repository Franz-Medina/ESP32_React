import React, { useState, useEffect } from "react";
import "./Styles/WidgetStyle.css";

function BatteryGauge({ 
  title = "BATTERY GAUGE", 
  dataKey = "battery"
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
  const [batteryLevel, setBatteryLevel] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [token, setToken] = useState(null);

  const TB_BASE_URL = "";
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

  const fetchBattery = async (devId) => {
    if (!devId) return;

    try {
      setIsLoading(true);

      const jwt = token || await login();

      const response = await fetch(
        `${TB_BASE_URL}/api/plugins/telemetry/DEVICE/${devId}/values/timeseries?keys=${dataKey}&limit=1`,
        {
          headers: { "X-Authorization": `Bearer ${jwt}` }
        }
      );

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();
      const latest = data[dataKey]?.[0]?.value;

      const level = latest !== undefined
        ? Math.max(0, Math.min(100, parseFloat(latest)))
        : 0;

      setBatteryLevel(level);
      setError(null);
    } catch (err) {
      console.error(err);
      throw err;
    } finally {
      setIsLoading(false);
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
      await fetchBattery(defaultId);
      setIsConnected(true);
      console.log("✅ Auto-connected to default device:", defaultId);
    } catch (err) {
      console.error(err);
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
      fetchBattery(deviceId).catch(() => {});
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

  const getBatteryColor = (level) => {
    if (level > 70) return "#22c55e";
    if (level > 30) return "#eab308";
    return "#ef4444";
  };

  const batteryColor = getBatteryColor(batteryLevel);

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
            <div className="widget-body">
              <div
                className="widget-level"
                style={{
                  width: `${batteryLevel}%`,
                  backgroundColor: batteryColor
                }}
              />
              <div className="widget-percentage">{batteryLevel}%</div>
            </div>
            <div className="widget-cap" />
          </div>
        </div>
      )}
    </div>
  );
}

export default BatteryGauge;