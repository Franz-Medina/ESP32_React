import React, { useState, useEffect } from "react";
import "./Styles/WidgetStyle.css";

export default function ServoMotor() {
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
  const [angle, setAngle] = useState(90);
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

  const sendAngle = async (value) => {
    const numericValue = Number(value);
    setAngle(numericValue);
    try {
      const jwt = token || await login();
      const res = await fetch(
        `/api/plugins/rpc/oneway/${deviceId}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Authorization": `Bearer ${jwt}`
          },
          body: JSON.stringify({
            method: "setServo", 
            params: numericValue
          })
        }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch (err) {
      console.error("RPC ERROR:", err);
    }
  };

  useEffect(() => {
    connectToDefault();
  }, []);

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
    <div className="widget">
      <div className="widget-title">SERVO MOTOR</div>

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

          <div className="widget-angle">
            <div className="widget-angle-value">{angle}</div>
            <div className="widget-angle-unit">°</div>
          </div>

          <input
            type="range"
            min="0"
            max="180"
            value={angle}
            onChange={(e) => sendAngle(e.target.value)}
            className="widget-slider"
            style={{
              "--progress": `${(angle / 180) * 100}%`,
            }}
          />

          <div className="widget-labels">
            <span>0°</span>
            <span>180°</span>
          </div>
        </div>
      )}
    </div>
  );
}