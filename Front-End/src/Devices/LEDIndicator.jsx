import React, { useState, useEffect } from "react";
import "./Styles/WidgetStyle.css";
import { fetchLatestTelemetry, sendOneWayRpc } from "../Utils/thingsboardApi";

function LEDIndicator({ instanceId = "widget-default" }) {
  const STORAGE_KEY = 'avinya_devices';

  const [deviceId, setDeviceId] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [ledState, setLedState] = useState(false);
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

  const fetchLedState = async (devId) => {
    if (!devId) return;

    const { data } = await fetchLatestTelemetry({
      deviceId: devId,
      keys: ["led"],
    });

    if (data.led && data.led.length > 0) {
      const latest = data.led[0].value;
      setLedState(latest === true || latest === "true" || latest === 1 || latest === "1");
    }
  };

  const handleToggle = async () => {
    if (!deviceId || !isConnected) return;

    const newState = !ledState;
    setLedState(newState);

    try {
      await sendOneWayRpc({
        deviceId,
        method: "setLED",
        params: newState,
      });

      console.log(`LED toggled to: ${newState ? "ON" : "OFF"}`);
    } catch (err) {
      console.error("RPC ERROR:", err);
      setLedState(!newState);
      setError("Failed to send command");
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
      await fetchLedState(defaultId);
      setIsConnected(true);
      console.log("LED Indicator connected to device:", defaultId);
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
        await fetchLedState(deviceId, jwt);
      } catch (err) {
        console.error("Polling error:", err);
      }
    }, 5000);

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
      <div className="widget-title">LED INDICATOR</div>

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

          <div 
            className="widget-container" 
            onClick={handleToggle}
            style={{ cursor: isConnected ? "pointer" : "not-allowed" }}
          >
            <div className={`widget-bulb ${ledState ? "on" : "off"}`}>
              <div className="widget-glow" />
            </div>
            <div style={{ marginTop: "12px", fontWeight: "bold" }}>
              {ledState ? "LED ON" : "LED OFF"}
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

export default LEDIndicator;