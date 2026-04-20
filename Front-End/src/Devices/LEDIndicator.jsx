import React, { useState, useEffect } from "react";
import "./Styles/WidgetStyle.css";

function LEDIndicator({ instanceId = "widget-default" }) {
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
  const [ledState, setLedState] = useState(false);
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

  const fetchLedState = async (devId) => {
    if (!devId) return;
    try {
      const jwt = token || await login();
      const res = await fetch(
        `/api/plugins/telemetry/DEVICE/${devId}/values/timeseries?keys=led&limit=1`,
        { headers: { "X-Authorization": `Bearer ${jwt}` } }
      );
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (data.led && data.led.length > 0) {
        const latest = data.led[0].value;
        setLedState(latest === "true" || latest === true);
      }
      setError(null);
    } catch (err) {
      console.error("FETCH LED ERROR:", err);
      throw err;
    }
  };

  const handleToggle = async () => {
    if (!deviceId || !isConnected) return;
    try {
      const jwt = token || await login();
      const newState = !ledState;
      await fetch(`/api/plugins/rpc/twoway/${deviceId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Authorization": `Bearer ${jwt}`
        },
        body: JSON.stringify({
          method: "setLED",
          params: newState
        })
      });
      setLedState(newState);
    } catch (err) {
      console.error("RPC ERROR:", err);
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
      await fetchLedState(defaultId);
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
      fetchLedState(deviceId).catch(() => {});
    }, 5000);
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

  return (
    <div className="widget">
      <div className="widget-title">LED INDICATOR</div>

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

          <div className="widget-container" onClick={handleToggle}>
            <div className={`widget-bulb ${ledState ? "on" : "off"}`}>
              <div className="widget-glow" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default LEDIndicator;