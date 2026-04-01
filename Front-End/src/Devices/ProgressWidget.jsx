import React, { useState, useEffect } from "react";
import "./Styles/ProgressWidget.css";

function ProgressWidget({ 
  title = "Progress", 
  dataKey = "progress", 
  unit = "%",
  min = 0,
  max = 100,
  color = "#980000"
}) {
  const [deviceId, setDeviceId] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [value, setValue] = useState(0);

  const handleConnect = () => {
    // Always connects successfully — pure test mode like all your other widgets
    console.log("Pretend connecting to device:", deviceId || "test-device");
    setIsConnected(true);

    // Generate a nice mock progress value instantly (ThingsBoard-style)
    const mockValue = Math.max(min, Math.min(max, 42 + Math.random() * 38));
    setValue(mockValue);
  };

  const handleDisconnect = () => {
    setIsConnected(false);
    setDeviceId("");
    setValue(0);
  };

  useEffect(() => {
    if (!isConnected) return;

    const interval = setInterval(() => {
      setValue((prev) => {
        const change = (Math.random() * 4 - 2);
        let next = prev + change;
        return Math.max(min, Math.min(max, next));
      });
    }, 10000);

    return () => clearInterval(interval);
  }, [isConnected]);

  const percentage = ((value - min) / (max - min)) * 100;

  return (
    <div className="progress-widget">
      <div className="progress-title">{title}</div>

      {!isConnected ? (
        <div className="progress-connect">
          <div className="progress-input-group">
            <input
              type="text"
              placeholder="Device ID"
              value={deviceId}
              onChange={(e) => setDeviceId(e.target.value)}
              className="progress-input"
            />
            <button
              onClick={handleConnect}
              className="progress-btn progress-btn-primary"
            >
              CONNECT
            </button>
          </div>
        </div>
      ) : (
        <div className="progress-control">
          <div className="progress-status">
            Connected to <strong>{deviceId || "test-device"}</strong> (test mode)
          </div>

          <div className="progress-container">
            <div className="progress-bar-bg">
              <div 
                className="progress-bar-fill"
                style={{ 
                  width: `${percentage}%`,
                  backgroundColor: color 
                }}
              />
            </div>
            
            <div className="progress-value">
              {value.toFixed(1)}{unit}
            </div>
          </div>

          <button 
            className="progress-btn"
            onClick={handleDisconnect}
          >
            Change Device
          </button>
        </div>
      )}
    </div>
  );
}

export default ProgressWidget;