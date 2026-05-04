import React, { useState, useEffect } from "react";
import "./Styles/WidgetStyle.css";
import { createActivityLog, ACTIVITY_LOG_TYPES } from "../Utils/activityLogsApi";

function LEDIndicator({ instanceId = "widget-default" }) {
  const STORAGE_KEY = "avinya_devices";

  const [deviceId, setDeviceId] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [ledState, setLedState] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [token, setToken] = useState(null);
  const [isToggling, setIsToggling] = useState(false);

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
      body: JSON.stringify({ username: TB_EMAIL, password: TB_PASSWORD }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Login failed (${res.status}): ${text}`);
    }
    const data = await res.json();
    setToken(data.token);
    return data.token;
  };

  const fetchLedState = async (devId, jwt) => {
    if (!devId) return;
    const res = await fetch(
      `${TB_BASE_URL}/api/plugins/telemetry/DEVICE/${devId}/values/timeseries?keys=led&useLatestTs=true`,
      { headers: { "X-Authorization": `Bearer ${jwt}` } }
    );
    if (!res.ok) throw new Error(`Telemetry failed (${res.status})`);
    const data = await res.json();
    if (data.led?.length > 0) {
      const latest = data.led[0].value;
      setLedState(latest === true || latest === "true" || latest === 1 || latest === "1");
    }
  };

  const handleToggle = async () => {
    if (!deviceId || !isConnected || isToggling) return;
    const newState = !ledState;
    setLedState(newState);
    setIsToggling(true);
    setError(null);
    try {
      const jwt = token ?? (await login());
      const res = await fetch(`${TB_BASE_URL}/api/plugins/rpc/oneway/${deviceId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Authorization": `Bearer ${jwt}`,
        },
        body: JSON.stringify({ method: "setLED", params: newState }),
      });
      if (!res.ok) throw new Error(`RPC failed (${res.status})`);
      createActivityLog({
        actionType: newState ? ACTIVITY_LOG_TYPES.LED_ON : ACTIVITY_LOG_TYPES.LED_OFF,
        deviceId,
        description: `LED was turned ${newState ? "ON" : "OFF"}`,
        value: newState,
      });
    } catch (err) {
      setLedState(!newState);
      setError("Failed to send command.");
    } finally {
      setIsToggling(false);
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
      const jwt = await login();
      await fetchLedState(defaultId, jwt);
      setIsConnected(true);
    } catch (err) {
      let msg = "Failed to connect";
      if (err.message.includes("401") || err.message.includes("403"))
        msg = "Invalid or expired session. Please log in again.";
      else if (err.message.includes("404"))
        msg = "Device not found. Verify the Device ID in ThingsBoard.";
      else if (err.message.includes("Failed to fetch"))
        msg = "Unable to reach server. Check your connection.";
      else msg = err.message;
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

  useEffect(() => { connectToDefault(); }, []);

  useEffect(() => {
    if (!isConnected || !deviceId) return;
    const interval = setInterval(async () => {
      try {
        const jwt = token || (await login());
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
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [deviceId]);

  const shortDeviceId = deviceId
    ? deviceId.length > 16
      ? `${deviceId.slice(0, 8)}…${deviceId.slice(-6)}`
      : deviceId
    : null;

  return (
    <div className={`cs-widget led-widget ${ledState ? "led-widget--on" : ""}`}>
      <div className="cs-header">
        <span className="cs-title">LED INDICATOR</span>
        <div className={`cs-status-dot ${isConnected ? "cs-status-dot--connected" : ""}`} />
      </div>

      {isLoading ? (
        <div className="cs-state-view">
          <div className="cs-spinner"><div className="cs-spinner-arc" /></div>
          <p className="cs-state-label">Connecting…</p>
        </div>
      ) : !deviceId ? (
        <div className="cs-state-view">
          <div className="cs-icon-circle cs-icon-circle--warn">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <p className="cs-state-label">No device selected</p>
          <p className="cs-state-sublabel">Open <strong>Devices</strong> and set a default.</p>
        </div>
      ) : (
        <div className="cs-body">
          <div className="cs-device-pill">
            <svg className="cs-device-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="5" y="2" width="14" height="20" rx="2" />
              <circle cx="12" cy="17" r="1" />
            </svg>
            <span>{shortDeviceId}</span>
          </div>

          <button
            className={`led-bulb-btn ${ledState ? "led-bulb-btn--on" : ""} ${isToggling ? "led-bulb-btn--busy" : ""}`}
            onClick={handleToggle}
            disabled={!isConnected || isToggling}
            aria-pressed={ledState}
            aria-label={`LED is ${ledState ? "on" : "off"}, tap to toggle`}
          >
            <span className="led-glow-ring" aria-hidden="true" />

            <svg className="led-bulb-svg" viewBox="0 0 64 80" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <defs>
                <radialGradient id="led-on-grad" cx="38%" cy="32%" r="62%">
                  <stop offset="0%" stopColor="#fef08a" />
                  <stop offset="42%" stopColor="#eab308" />
                  <stop offset="100%" stopColor="#ca8a04" />
                </radialGradient>
                <radialGradient id="led-off-grad" cx="40%" cy="35%" r="60%">
                  <stop offset="0%" stopColor="#f5f5f7" />
                  <stop offset="100%" stopColor="#d1d1d6" />
                </radialGradient>
                <filter id="led-blur" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="5" />
                </filter>
              </defs>

              {ledState && (
                <ellipse cx="32" cy="34" rx="26" ry="26" fill="#eab308" filter="url(#led-blur)" opacity="0.55" className="led-halo" />
              )}

              <path
                d="M32 4C20.4 4 11 13.4 11 25c0 7.8 4.2 14.6 10.4 18.4v6.6h21V43.4C48.8 39.6 53 32.8 53 25 53 13.4 43.6 4 32 4z"
                fill={ledState ? "url(#led-on-grad)" : "url(#led-off-grad)"}
                className="led-globe"
              />

              <ellipse cx="25" cy="18" rx="6" ry="9" fill="rgba(255,255,255,0.32)" transform="rotate(-20 25 18)" className="led-shine" />

              <rect x="21" y="50" width="22" height="4" rx="2" fill={ledState ? "#ca8a04" : "#c7c7cc"} className="led-base" />
              <rect x="23" y="55" width="18" height="4" rx="2" fill={ledState ? "#b45309" : "#aeaeb2"} className="led-base" />
              <rect x="25" y="60" width="14" height="5" rx="2.5" fill={ledState ? "#92400e" : "#8e8e93"} className="led-base" />
            </svg>

            {isToggling && (
              <span className="led-busy-ring" aria-hidden="true">
                <span className="led-busy-arc" />
              </span>
            )}
          </button>

          <span className={`led-state-label ${ledState ? "led-state-label--on" : ""}`}>
            {isToggling ? "Sending…" : ledState ? "On" : "Off"}
          </span>

          {error && (
            <div className="cs-error">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {!isConnected && !isLoading && (
            <button className="cs-reconnect-btn" onClick={handleReconnect}>
              Reconnect
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default LEDIndicator;