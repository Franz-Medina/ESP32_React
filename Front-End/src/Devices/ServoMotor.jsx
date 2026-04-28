import React, { useState, useEffect } from "react";
import "./Styles/WidgetStyle.css";

export default function ServoMotor() {
  const STORAGE_KEY = 'avinya_devices';

  const [deviceId, setDeviceId] = useState(null);
  const [connected, setConnected] = useState(false);
  const [angle, setAngle] = useState(90);
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
      console.error("Failed to load default device from storage:", e);
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
      await login();
      setConnected(true);
      console.log("Servo connected to device:", defaultId);
    } catch (err) {
      console.error("Connection error:", err);
      
      let msg = "Failed to connect";
      if (err.message.includes("401") || err.message.includes("403")) {
        msg = "Invalid ThingsBoard credentials. Check your .env file.";
      } else if (err.message.includes("404")) {
        msg = "Device not found. Please check the Device ID.";
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

  const sendAngle = async (value) => {
    const numericValue = Number(value);
    if (isNaN(numericValue) || numericValue < 0 || numericValue > 180) return;

    setAngle(numericValue);

    if (!deviceId || !connected) return;

    try {
      const jwt = token || await login();

      const res = await fetch(`${TB_BASE_URL}/api/plugins/rpc/oneway/${deviceId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Authorization": `Bearer ${jwt}`
        },
        body: JSON.stringify({
          method: "setServo",
          params: numericValue
        })
      });

      if (!res.ok) {
        throw new Error(`RPC failed (${res.status})`);
      }

      console.log(`Servo angle sent: ${numericValue}°`);
    } catch (err) {
      console.error("Failed to send servo angle:", err);
      setError("Failed to send command to servo");
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
      <div className="widget-title">SERVO MOTOR</div>

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
            {connected ? "Connected to " : "Disconnected from "} 
            <strong style={{ wordBreak: "break-all", fontSize: "0.9em" }}>{deviceId}</strong>
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
            style={{ "--progress": `${(angle / 180) * 100}%` }}
            disabled={!connected}
          />

          <div className="widget-labels">
            <span>0°</span>
            <span>180°</span>
          </div>

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