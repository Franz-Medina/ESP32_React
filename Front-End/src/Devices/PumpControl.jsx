import React, { useState } from "react";
import "./Styles/PumpControl.css";

const TB_URL = import.meta.env.VITE_TB_URL;
const TB_API_KEY = import.meta.env.VITE_TB_API_KEY;

function PumpControl() {
  const [deviceId, setDeviceId] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [pumpOn, setPumpOn] = useState(false);
  const [pendingPumpState, setPendingPumpState] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const sendPumpCommand = async (targetState) => {
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
            method: "setPump",
            params: targetState,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

    } catch (err) {
      console.error("Pump command failed:", err);
      setErrorMessage("Failed to control pump. Reverted.");
      setPumpOn(!targetState);
    } finally {
      setIsLoading(false);
      setPendingPumpState(false);
    }
  };

  const handleTogglePump = () => {
    const nextState = !pumpOn;
    setPumpOn(nextState);          
    setPendingPumpState(nextState);
    sendPumpCommand(nextState);
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
    setPumpOn(false);
    setErrorMessage("");
  };

  const isToggleDisabled = isLoading || !isConnected;

  return (
    <div className="pump-control-widget">
      <header className="widget-header">
        <h2>Pump Control</h2>
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
            <div>
              Pump:{" "}
              <strong className={pumpOn ? "status-on" : "status-off"}>
                {pumpOn ? "ON" : "OFF"}
              </strong>
            </div>
          </div>

          <div className="main-action">
            <button
              className={`btn toggle ${pumpOn ? "off" : "on"} ${
                isToggleDisabled ? "disabled" : ""
              }`}
              onClick={handleTogglePump}
              disabled={isToggleDisabled}
              aria-label={`Turn pump ${pumpOn ? "off" : "on"}`}
            >
              {isLoading ? (
                <span className="loading">⋯</span>
              ) : pumpOn ? (
                "Turn OFF"
              ) : (
                "Turn ON"
              )}
            </button>
          </div>

          <button className="btn secondary" onClick={handleDisconnect}>
            Change Device
          </button>

          {errorMessage && <p className="error-msg">{errorMessage}</p>}
        </div>
      )}
    </div>
  );
}

export default PumpControl;