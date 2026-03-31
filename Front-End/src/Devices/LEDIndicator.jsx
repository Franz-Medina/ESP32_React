import React, { useState } from "react";
import "./Styles/LEDIndicator.css";

function LEDIndicator({ instanceId = "led-default" }) {
  const [deviceId, setDeviceId] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [ledState, setLedState] = useState(false);

  const handleToggle = () => {
    const newState = !ledState;
    setLedState(newState);
    console.log(`LED ${instanceId} toggled →`, newState);
  };

  const handleConnect = () => {
    console.log("Pretend connecting to device:", deviceId || "test-device");
    setIsConnected(true);
  };

  const handleDisconnect = () => {
    setIsConnected(false);
    setDeviceId("");
    setLedState(false);
  };

  return (
    <div className="led-widget">
      <div className="led-title">LED INDICATOR</div>

      {!isConnected ? (
        <div className="led-connect">
          <div className="led-input-group">
            <input
              type="text"
              placeholder="Device ID"
              value={deviceId}
              onChange={(e) => setDeviceId(e.target.value)}
              className="led-input"
            />
            <button
              onClick={handleConnect}
              className="led-btn led-btn-primary"
            >
              CONNECT
            </button>
          </div>
        </div>
      ) : (
        <div className="led-control">
          <div className="led-status">
            Connected to <strong>{deviceId || "test-device"}</strong> (test mode)
          </div>

          <div className="led-container" onClick={handleToggle}>
            <div className={`led-bulb ${ledState ? "on" : "off"}`}>
              <div className="led-glow" />
            </div>
          </div>

          <button 
            className="led-btn"
            onClick={handleDisconnect}
          >
            Change Device
          </button>
        </div>
      )}
    </div>
  );
}

export default LEDIndicator;