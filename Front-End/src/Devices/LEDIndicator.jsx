import React, { useState, useEffect } from "react";
import "./LEDIndicator.css";

const TB_URL = import.meta.env.VITE_TB_URL;
const TB_API_KEY = import.meta.env.VITE_TB_API_KEY;

function LEDIndicator({ instanceId = "default" }) {
  const STORAGE_KEY = `ledDeviceId_${instanceId}`;

  const [deviceId, setDeviceId] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [ledState, setLedState] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const fetchLEDStatus = async () => {
    if (!deviceId || !isConnected) return;

    try {
      setIsLoading(true);
      setErrorMessage("");

      const response = await fetch(
        `${TB_URL}/api/plugins/telemetry/DEVICE/${deviceId}/values/timeseries?keys=ledState&limit=1`,
        {
          headers: {
            "X-Authorization": `ApiKey ${TB_API_KEY}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      if (data.ledState && data.ledState.length > 0) {
        const latest = data.ledState[0].value;
        setLedState(latest === true || latest === "true" || latest === 1);
      } else {
        setLedState(false);
      }
    } catch (err) {
      console.error("LED fetch failed:", err);
      setErrorMessage("Failed to fetch LED status");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      setDeviceId(saved);
      setIsConnected(true);
    }
  }, [STORAGE_KEY]);

  useEffect(() => {
    if (!isConnected || !deviceId) return;

    fetchLEDStatus();

    const interval = setInterval(fetchLEDStatus, 3000);
    return () => clearInterval(interval);
  }, [isConnected, deviceId]);

  const handleConnect = () => {
    if (!deviceId.trim()) {
      setErrorMessage("Please enter a Device ID");
      return;
    }

    localStorage.setItem(STORAGE_KEY, deviceId);
    setIsConnected(true);
    setErrorMessage("");
  };

  const handleDisconnect = () => {
    setIsConnected(false);
    setDeviceId("");
    setLedState(false);
    setErrorMessage("");
    localStorage.removeItem(STORAGE_KEY);
  };

  const handleRefresh = () => {
    fetchLEDStatus();
  };

  return (
    <div className="led-control-widget">
      <header className="widget-header">
        <h2>LED Indicator</h2>
      </header>

      {!isConnected ? (
        <div className="connect-screen">
          <div className="input-group">
            <input
              type="text"
              placeholder="Device ID"
              value={deviceId}
              onChange={(e) => {
                setDeviceId(e.target.value);
                setErrorMessage("");
              }}
              onKeyDown={(e) => e.key === "Enter" && handleConnect()}
              disabled={isLoading}
              autoFocus
            />
            <button
              className="btn primary"
              onClick={handleConnect}
              disabled={isLoading || !deviceId.trim()}
            >
              Connect
            </button>
          </div>

          {errorMessage && <p className="error-msg">{errorMessage}</p>}
        </div>
      ) : (
        <div className="control-screen">
          <div className="status-bar">
            <div>
              Device: <strong>{deviceId}</strong>
            </div>
          </div>

          <div className="led-container">
            <div
              className={`led-bulb ${ledState ? "on" : "off"} ${
                isLoading ? "loading" : ""
              }`}
              aria-label={`LED is ${ledState ? "on" : "off"}`}
            >
              <div className="led-glow" />
            </div>
          </div>

          <p className="led-status">
            Status: <strong className={ledState ? "status-on" : "status-off"}>
              {ledState ? "ON" : "OFF"}
            </strong>
          </p>

          <div className="actions">
            <button
              className="btn refresh"
              onClick={handleRefresh}
              disabled={isLoading}
            >
              {isLoading ? "⋯" : "Refresh"}
            </button>

            <button className="btn secondary" onClick={handleDisconnect}>
              Change Device
            </button>
          </div>

          {errorMessage && <p className="error-msg">{errorMessage}</p>}
          {isLoading && <p className="loading-text">Updating...</p>}
        </div>
      )}
    </div>
  );
}

export default LEDIndicator;