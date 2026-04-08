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
  const [token, setToken] = useState(null);

  const TB_BASE_URL = "";
  const TB_EMAIL = import.meta.env.VITE_TB_EMAIL;
  const TB_PASSWORD = import.meta.env.VITE_TB_PASSWORD;

  const login = async () => {
    const res = await fetch(`${TB_BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        username: TB_EMAIL,
        password: TB_PASSWORD
      })
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("LOGIN ERROR:", text);
      throw new Error("Login failed");
    }

    const data = await res.json();
    setToken(data.token);
    return data.token;
  };

  const fetchProgress = async () => {
    if (!deviceId) return;

    try {
      const jwt = token || await login();

      const res = await fetch(
        `${TB_BASE_URL}/api/plugins/telemetry/DEVICE/${deviceId}/values/timeseries?keys=${dataKey}&limit=1`,
        {
          headers: {
            "X-Authorization": `Bearer ${jwt}`
          }
        }
      );

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      const latest = data[dataKey]?.[0]?.value;

      const numeric =
        latest !== undefined
          ? Math.max(min, Math.min(max, parseFloat(latest)))
          : 0;

      setValue(numeric);
    } catch (err) {
      console.error("FETCH ERROR:", err);
    }
  };

  const handleConnect = async () => {
    if (!deviceId) {
      alert("Please enter Device ID");
      return;
    }

    try {
      await login();
      setIsConnected(true);
      console.log("✅ Connected");
      await fetchProgress();
    } catch (err) {
      console.error(err);
      alert("Login failed");
    }
  };

  const handleDisconnect = () => {
    setIsConnected(false);
    setDeviceId("");
    setValue(0);
    setToken(null);
  };

  useEffect(() => {
    if (!isConnected || !deviceId) return;

    const interval = setInterval(() => {
      fetchProgress();
    }, 10000);

    return () => clearInterval(interval);
  }, [isConnected, deviceId]);

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
            Connected to <strong>{deviceId}</strong>
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