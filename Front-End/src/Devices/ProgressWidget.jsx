import React, { useState, useEffect } from "react";
import "./Styles/ProgressWidget.css";

const TB_URL = import.meta.env.VITE_TB_URL;
const TB_API_KEY = import.meta.env.VITE_TB_API_KEY;

function ProgressWidget({ 
  title = "Progress", 
  dataKey = "progress", 
  unit = "%",
  min = 0,
  max = 100,
  color = "#60a5fa"
}) {
  const [deviceId, setDeviceId] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [value, setValue] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const fetchProgress = async () => {
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

      if (!response.ok) throw new Error("Failed to fetch data");

      const data = await response.json();
      const latest = data[dataKey]?.[0]?.value;

      let progress = latest !== undefined ? parseFloat(latest) : 0;
      progress = Math.max(min, Math.min(max, progress));

      setValue(progress);
    } catch (err) {
      console.error(err);
      setErrorMessage("Failed to load progress");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isConnected || !deviceId) return;

    fetchProgress();
    const interval = setInterval(fetchProgress, 8000);
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
    setValue(0);
    setErrorMessage("");
  };

  const percentage = ((value - min) / (max - min)) * 100;

  return (
    <div className="progress-widget">
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
        <div className="progress-screen">
          <div className="status-bar">
            Device: <strong>{deviceId}</strong>
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

export default ProgressWidget;