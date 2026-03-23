import React, { useState } from "react";
import "./ServoMotor.css";

const TB_URL = import.meta.env.VITE_TB_URL;
const TB_API_KEY = import.meta.env.VITE_TB_API_KEY;

function ServoMotor() {
  const [deviceId, setDeviceId] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [angle, setAngle] = useState(90);
  const [pendingAngle, setPendingAngle] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const sendAngle = async (targetAngle) => {
    if (!isConnected || !deviceId) return;

    try {
      setIsLoading(true);
      setErrorMessage("");

      const response = await fetch(
        `${TB_URL}/api/plugins/rpc/oneway/${deviceId}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Authorization": `ApiKey ${TB_API_KEY}`,
          },
          body: JSON.stringify({
            method: "setAngle",
            params: parseInt(targetAngle, 10),
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

    } catch (err) {
      console.error("Servo command failed:", err);
      setErrorMessage("Failed to set angle. Reverted.");
      setAngle(pendingAngle ?? 90);
    } finally {
      setIsLoading(false);
      setPendingAngle(null);
    }
  };

  const handleAngleChange = (e) => {
    const newAngle = e.target.value;
    setAngle(newAngle);
    setPendingAngle(newAngle);
    sendAngle(newAngle);
  };

  const handleConnect = () => {
    if (!deviceId.trim()) {
      setErrorMessage("Please enter a Device ID");
      return;
    }
    setIsConnected(true);
    setErrorMessage("");
  };

  const handleDisconnect = () => {
    setIsConnected(false);
    setDeviceId("");
    setAngle(90);
    setErrorMessage("");
  };

  return (
    <div className="servo-control-widget">
      <header className="widget-header">
        <h2>Servo Motor</h2>
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

          <div className="angle-display">
            <span className="angle-value">{angle}</span>
            <span className="angle-unit">°</span>
          </div>

          <div className="slider-container">
            <input
              type="range"
              min="0"
              max="180"
              step="1"
              value={angle}
              onChange={handleAngleChange}
              disabled={isLoading}
              aria-label={`Servo angle: ${angle} degrees`}
            />
            <div className="slider-labels">
              <span>0°</span>
              <span>90°</span>
              <span>180°</span>
            </div>
          </div>

          <button className="btn secondary" onClick={handleDisconnect}>
            Change Device
          </button>

          {errorMessage && <p className="error-msg">{errorMessage}</p>}

          {isLoading && <p className="loading-text">Sending...</p>}
        </div>
      )}
    </div>
  );
}

export default ServoMotor;