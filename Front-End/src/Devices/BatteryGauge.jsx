import React, { useState, useEffect } from "react";
import "./Styles/BatteryGauge.css";

const TB_URL = import.meta.env.VITE_TB_URL;
const TB_API_KEY = import.meta.env.VITE_TB_API_KEY;

function BatteryGauge({ 
  title = "Battery Level", 
  dataKey = "battery", 
  deviceId: propDeviceId = null 
}) {
  const [deviceId, setDeviceId] = useState(propDeviceId || "");
  const [isConnected, setIsConnected] = useState(!!propDeviceId);
  const [batteryLevel, setBatteryLevel] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const fetchBattery = async () => {
    if (!deviceId) return;

    try {
      setIsLoading(true);
      setErrorMessage("");

      const response = await fetch(
        `${TB_URL}/api/plugins/telemetry/DEVICE/${deviceId}/values/timeseries?keys=${dataKey}&limit=1`,
        {
          headers: {
            "X-Authorization": `ApiKey ${TB_API_KEY}`,
          },
        }
      );

      if (!response.ok) throw new Error("Failed to fetch battery data");

      const data = await response.json();
      const latest = data[dataKey]?.[0]?.value;

      const level = latest !== undefined ? Math.max(0, Math.min(100, parseFloat(latest))) : 0;
      setBatteryLevel(level);
    } catch (err) {
      console.error(err);
      setErrorMessage("Failed to load battery level");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isConnected || !deviceId) return;

    fetchBattery();
    const interval = setInterval(fetchBattery, 10000);
    return () => clearInterval(interval);
  }, [isConnected, deviceId]);

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
    setBatteryLevel(0);
    setErrorMessage("");
  };

  const getBatteryColor = (level) => {
    if (level > 70) return "#22c55e";
    if (level > 30) return "#eab308";
    return "#ef4444";
  };

  const batteryColor = getBatteryColor(batteryLevel);

  return (
    <div className="battery-gauge-widget">
      <div className="widget-header">
        <h3>{title}</h3>
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
        <div className="gauge-screen">
          <div className="status-bar">
            Device: <strong>{deviceId}</strong>
          </div>

          <div className="battery-container">
            <div className="battery-outer">
              <div 
                className="battery-level"
                style={{
                  width: `${batteryLevel}%`,
                  backgroundColor: batteryColor
                }}
              >
                <span className="battery-text">{batteryLevel}%</span>
              </div>
            </div>

            <div className="battery-cap" />
          </div>

          <div className="battery-status">
            {batteryLevel > 70 ? "Good" : batteryLevel > 30 ? "Fair" : "Low"}
          </div>

          {isLoading && <p className="loading-text">Updating...</p>}
          {errorMessage && <p className="error-msg">{errorMessage}</p>}

          <button className="btn secondary" onClick={handleDisconnect}>
            Change Device
          </button>
        </div>
      )}
    </div>
  );
}

export default BatteryGauge;