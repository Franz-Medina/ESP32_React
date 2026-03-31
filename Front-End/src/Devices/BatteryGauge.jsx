import React, { useState, useEffect } from "react";
import "./Styles/BatteryGauge.css";

const TB_URL = import.meta.env.VITE_TB_URL;
const TB_API_KEY = import.meta.env.VITE_TB_API_KEY;

function BatteryGauge({ 
  title = "BATTERY GAUGE", 
  dataKey = "battery", 
  deviceId: propDeviceId = null 
}) {
  const [deviceId, setDeviceId] = useState(propDeviceId || "");
  const [isConnected, setIsConnected] = useState(!!propDeviceId);
  const [batteryLevel, setBatteryLevel] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const fetchBattery = async () => {
    if (!deviceId) return;

    try {
      setIsLoading(true);

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
    console.log("Pretend connecting to device:", deviceId || "test-device");
    setIsConnected(true);
  };

  const handleDisconnect = () => {
    setIsConnected(false);
    setDeviceId("");
    setBatteryLevel(0);
  };

  const getBatteryColor = (level) => {
    if (level > 70) return "#22c55e";
    if (level > 30) return "#eab308";
    return "#ef4444";
  };

  const batteryColor = getBatteryColor(batteryLevel);

  return (
    <div className="battery-gauge-widget">
      <div className="battery-title">{title}</div>

      {!isConnected ? (
        <div className="battery-connect">
          <div className="battery-input-group">
            <input
              type="text"
              placeholder="Device ID"
              value={deviceId}
              onChange={(e) => setDeviceId(e.target.value)}
              className="battery-input"
            />
            <button
              onClick={handleConnect}
              className="battery-btn battery-btn-primary"
            >
              CONNECT
            </button>
          </div>
        </div>
      ) : (
        <div className="battery-control">
          <div className="battery-status">
            Connected to <strong>{deviceId || "test-device"}</strong> (test mode)
          </div>

          <div className="battery-container">
            <div className="battery-body">
              <div 
                className="battery-level"
                style={{
                  width: `${batteryLevel}%`,
                  backgroundColor: batteryColor
                }}
              />
              <div className="battery-percentage">{batteryLevel}%</div>
            </div>
            <div className="battery-cap" />
          </div>

          <button 
            className="battery-btn"
            onClick={handleDisconnect}
          >
            Change Device
          </button>
        </div>
      )}
    </div>
  );
}

export default BatteryGauge;