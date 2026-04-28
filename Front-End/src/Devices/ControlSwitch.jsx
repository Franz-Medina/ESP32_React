import React, { useState, useEffect } from "react";
import "./Styles/WidgetStyle.css";

function ControlSwitch({ 
  title = "SWITCH", 
  rpcMethod = "setPump",
  telemetryKey = "pump" 
}) {
  const STORAGE_KEY = 'avinya_devices';

  const [deviceId, setDeviceId] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isOn, setIsOn] = useState(false);
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

  const fetchCurrentState = async (devId, jwt) => {
    const url = `${TB_BASE_URL}/api/plugins/telemetry/DEVICE/${devId}/values/timeseries?keys=${telemetryKey}&useLatestTs=true`;

    const res = await fetch(url, {
      headers: { "X-Authorization": `Bearer ${jwt}` }
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Telemetry failed (${res.status})`);
    }

    const data = await res.json();

    if (data[telemetryKey]?.length > 0) {
      const value = data[telemetryKey][0].value;
      const boolValue = value === true || value === "true" || value === 1 || value === "1";
      setIsOn(boolValue);
    }
  };

  const connectToDevice = async (devId) => {
    if (!devId) {
      setError("No default device set. Please go to Devices page and set one.");
      setIsConnected(false);
      setIsLoading(false);
      return;
    }

    setDeviceId(devId);
    setIsLoading(true);
    setError(null);

    try {
      const jwt = await login();
      await fetchCurrentState(devId, jwt);

      setIsConnected(true);
      console.log("Connected to device:", devId);
    } catch (err) {
      console.error("Connection error:", err);
      
      let msg = "Failed to connect";
      if (err.message.includes("401") || err.message.includes("403")) {
        msg = "Invalid ThingsBoard credentials. Check your .env file.";
      } else if (err.message.includes("404")) {
        msg = "Device not found. Please verify the Device ID in ThingsBoard.";
      } else if (err.message.includes("Failed to fetch")) {
        msg = "Cannot reach ThingsBoard Cloud. Check your internet.";
      } else {
        msg = err.message;
      }

      setError(msg);
      setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggle = async () => {
    if (!deviceId || !isConnected) return;

    const newState = !isOn;
    setIsOn(newState);

    try {
      const jwt = token ?? await login();

      const res = await fetch(`${TB_BASE_URL}/api/plugins/rpc/oneway/${deviceId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Authorization": `Bearer ${jwt}`
        },
        body: JSON.stringify({
          method: rpcMethod,
          params: newState
        })
      });

      if (!res.ok) throw new Error(`RPC failed (${res.status})`);

      console.log(`Command sent: ${rpcMethod}(${newState})`);
    } catch (err) {
      console.error(err);
      setIsOn(!newState);
      setError("Failed to send command");
    }
  };

  const handleReconnect = () => {
    setIsConnected(false);
    setToken(null);
    const defaultId = loadDefaultDevice();
    if (defaultId) {
      connectToDevice(defaultId);
    } else {
      setError("No default device set. Go to Devices page.");
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const defaultId = loadDefaultDevice();
    setDeviceId(defaultId);
    connectToDevice(defaultId);
  }, []);

  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === STORAGE_KEY) {
        const newDefault = loadDefaultDevice();
        if (newDefault && newDefault !== deviceId) {
          connectToDevice(newDefault);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [deviceId]);

  return (
    <div className="widget">
      <div className="widget-title">{title}</div>

      {isLoading ? (
        <div className="widget-loading">Connecting to ThingsBoard Cloud...</div>
      ) : !deviceId ? (
        <div className="widget-no-default">
          <p>No default device set.</p>
          <small>Go to <strong>Devices</strong> page and set a default device.</small>
        </div>
      ) : (
        <div className="widget-control">
          <div className="widget-status">
            {isConnected ? "Connected to " : "Disconnected from "} 
            <strong style={{ wordBreak: "break-all", fontSize: "0.9em" }}>{deviceId}</strong>
          </div>

          {error && <div className="widget-error">⚠️ {error}</div>}

          <div 
            className="toggle-area" 
            onClick={handleToggle}
            style={{ cursor: isConnected ? "pointer" : "not-allowed", opacity: isConnected ? 1 : 0.6 }}
          >
            <div className={`widget-toggle ${isOn ? "on" : ""}`}>
              <div className="toggle-knob"></div>
            </div>
            <div style={{ marginTop: "8px", fontWeight: "bold" }}>
              {isOn ? "ON" : "OFF"}
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

export default ControlSwitch;