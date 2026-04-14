import React, { useState, useEffect } from "react";
import "./Styles/WidgetStyle.css";

function ControlSwitch({ 
  title = "SWITCH", 
  rpcMethod = "setPump"
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
  const [isOn, setIsOn] = useState(false);
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

  const fetchCurrentState = async (devId) => {
    if (!devId) return;
    try {
      const jwt = token || await login();
      const res = await fetch(
        `${TB_BASE_URL}/api/plugins/telemetry/DEVICE/${devId}/values/timeseries?keys=pump`,
        { headers: { "X-Authorization": `Bearer ${jwt}` } }
      );

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      if (data.pump?.length > 0) {
        const value = data.pump[0].value;
        setIsOn(value === true || value === "true");
      }
      setError(null);
      return true;
    } catch (err) {
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
      await fetchCurrentState(defaultId);
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

  const handleToggle = async () => {
    if (!deviceId || !isConnected) return;
    const newState = !isOn;
    setIsOn(newState);
    setError(null);

    try {
      const jwt = token || await login();
      const res = await fetch(
        `${TB_BASE_URL}/api/plugins/rpc/oneway/${deviceId}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Authorization": `Bearer ${jwt}`
          },
          body: JSON.stringify({
            method: rpcMethod,
            params: newState
          }),
        }
      );

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      console.log("✅ RPC sent");
    } catch (err) {
      console.error(err);
      setIsOn(!newState);
      let msg = err.message;
      if (msg.includes("404")) msg = "Device not found";
      else if (msg.includes("401") || msg.includes("403")) msg = "Auth error";
      else msg = "Failed to send command";
      setError(msg);
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
            
          <div className="toggle-area" onClick={handleToggle}>
            <div className={`widget-toggle ${isOn ? "on" : ""}`}>
              <div className="toggle-knob"></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ControlSwitch;