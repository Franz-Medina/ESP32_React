//REDO FRONT END
import React, { useState } from "react";
import "./Styles/ControlSwitch.css";

function ControlSwitch({ 
  title = "SWITCH", 
  rpcMethod = "setPump" 
}) {
  const [deviceId, setDeviceId] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [isOn, setIsOn] = useState(false);

  const handleToggle = () => {
    setIsOn(!isOn);
    console.log(`Toggle ${rpcMethod} →`, !isOn);
  };

  const handleConnect = () => {
    console.log("Pretend connecting to device:", deviceId || "test-device");
    setIsConnected(true);
  };

  const handleDisconnect = () => {
    setIsConnected(false);
    setDeviceId("");
    setIsOn(false);
  };

  return (
    <div className="control-switch-widget">
      <div className="control-title">{title}</div>

      {!isConnected ? (
        <div className="control-connect">
          <div className="control-input-group">
            <input
              type="text"
              placeholder="Device ID"
              value={deviceId}
              onChange={(e) => setDeviceId(e.target.value)}
              className="control-input"
            />
            <button
              onClick={handleConnect}
              className="control-btn control-btn-primary"
            >
              CONNECT
            </button>
          </div>
        </div>
      ) : (
        <div className="control-control">
          <div className="control-status">
            Connected to <strong>{deviceId || "test-device"}</strong> (test mode)
          </div>

          <div className="toggle-area" onClick={handleToggle}>
            <div className={`control-toggle ${isOn ? "on" : ""}`}>
              <div className="toggle-knob"></div>
            </div>
          </div>

          <button 
            className="control-btn"
            onClick={handleDisconnect}
          >
            Change Device
          </button>
        </div>
      )}
    </div>
  );
}

export default ControlSwitch;