// src/components/ControlSwitch.jsx
import React, { useState } from "react";
import "./Styles/ControlSwitch.css";

const TB_URL = import.meta.env.VITE_TB_URL;
const TB_API_KEY = import.meta.env.VITE_TB_API_KEY;

function ControlSwitch({ 
  title = "Pump", 
  rpcMethod = "setPump" 
}) {
  const [deviceId, setDeviceId] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [isOn, setIsOn] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const sendCommand = async (targetState) => {
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
            method: rpcMethod,
            params: targetState,
          }),
        }
      );

      if (!response.ok) throw new Error("Command failed");

      setIsOn(targetState);
    } catch (err) {
      console.error(err);
      setErrorMessage("Failed to send command. Reverted.");
      setIsOn(!targetState);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggle = () => {
    if (isLoading) return;
    sendCommand(!isOn);
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
    setIsOn(false);
    setErrorMessage("");
  };

  return (
    <div className="control-switch-card">
      <div className="card-header">
        <h3>{title}</h3>
      </div>

      {!isConnected ? (
        <div className="connect-section">
          <input
            type="text"
            placeholder="Device ID"
            value={deviceId}
            onChange={(e) => setDeviceId(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleConnect()}
          />
          <button className="btn connect-btn" onClick={handleConnect}>
            Connect
          </button>
        </div>
      ) : (
        <div className="control-section">
          <div className="device-info">
            Device: <strong>{deviceId}</strong>
          </div>

          <div className="toggle-area" onClick={handleToggle}>
            <div className={`modern-toggle ${isOn ? 'on' : 'off'}`}>
              <div className="toggle-knob"></div>
            </div>
          </div>

          <button className="btn change-btn" onClick={handleDisconnect}>
            Change Device
          </button>

          {errorMessage && (
            <div className="error-popup">
              {errorMessage}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ControlSwitch;