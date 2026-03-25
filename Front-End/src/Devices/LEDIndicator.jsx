import React, { useState, useEffect } from "react";
import "./LEDIndicator.css";

const TB_URL = import.meta.env.VITE_TB_URL;
const TB_API_KEY = import.meta.env.VITE_TB_API_KEY;

function LEDIndicator({ instanceId = "led-default" }) {
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
          headers: { "X-Authorization": `ApiKey ${TB_API_KEY}` },
        }
      );

      if (!response.ok) throw new Error("Failed to fetch LED state");

      const data = await response.json();
      const latest = data.ledState?.[0]?.value;
      setLedState(latest === true || latest === "true" || latest === 1);
    } catch (err) {
      console.error(err);
      setErrorMessage("Failed to fetch LED status");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleLED = async () => {
    if (!deviceId || !isConnected) return;

    const newState = !ledState;

    try {
      setIsLoading(true);
      setErrorMessage("");

      setLedState(newState);

      const response = await fetch(
        `${TB_URL}/api/plugins/rpc/oneway/${deviceId}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Authorization": `ApiKey ${TB_API_KEY}`,
          },
          body: JSON.stringify({
            method: "setLed",        
            params: newState,
          }),
        }
      );

      if (!response.ok) throw new Error("Failed to toggle LED");

      setTimeout(fetchLEDStatus, 800);
    } catch (err) {
      console.error(err);
      setErrorMessage("Failed to toggle LED. Reverted.");
      setLedState(!newState); 
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
    const interval = setInterval(fetchLEDStatus, 5000);
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

  return (
    <div className="led-control-widget">
      <div className="widget-header">
        <h3>LED Indicator</h3>
      </div>

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
            />
            <button className="btn primary" onClick={handleConnect}>
              Connect
            </button>
          </div>
          {errorMessage && <p className="error-msg">{errorMessage}</p>}
        </div>
      ) : (
        <div className="control-screen">
          <div className="status-bar">
            Device: <strong>{deviceId}</strong>
          </div>

          <div className="led-container">
            <div
              className={`led-bulb ${ledState ? "on" : "off"} ${isLoading ? "loading" : ""}`}
              onClick={toggleLED}
              style={{ cursor: isLoading ? "not-allowed" : "pointer" }}
            >
              <div className="led-glow" />
            </div>
          </div>

          <p className="led-status">
            Status: <strong className={ledState ? "status-on" : "status-off"}>
              {ledState ? "ON" : "OFF"}
            </strong>
          </p>

          <button
            className={`btn toggle-btn ${ledState ? "off" : "on"}`}
            onClick={toggleLED}
            disabled={isLoading}
          >
            {isLoading ? "Updating..." : ledState ? "Turn OFF" : "Turn ON"}
          </button>

          <button className="btn secondary" onClick={handleDisconnect}>
            Change Device
          </button>

          {errorMessage && <p className="error-msg">{errorMessage}</p>}
        </div>
      )}
    </div>
  );
}

export default LEDIndicator;