import React, { useEffect, useState } from "react";
import "./Styles/WidgetStyle.css";
import { fetchLatestTelemetry } from "../Utils/thingsboardApi";

function ProgressWidget({
  title = "Progress",
  dataKey = "progress",
  unit = "%",
  min = 0,
  max = 100,
  color = "#980000",
}) {
  const STORAGE_KEY = "avinya_devices";

  const [deviceId, setDeviceId] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [value, setValue] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadDefaultDevice = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);

      if (!raw) return null;

      const parsed = JSON.parse(raw);

      return parsed.defaultId ?? null;
    } catch (e) {
      console.error("Failed to load default device:", e);
      return null;
    }
  };

  const fetchProgress = async (targetDeviceId) => {
    if (!targetDeviceId) return;

    const { data } = await fetchLatestTelemetry({
      deviceId: targetDeviceId,
      keys: [dataKey],
    });

    const latest = data[dataKey]?.[0]?.value;

    const numeric =
      latest !== undefined
        ? Math.max(min, Math.min(max, parseFloat(latest)))
        : 0;

    setValue(Number.isFinite(numeric) ? numeric : 0);
  };

  const connectToDefault = async () => {
    const defaultId = loadDefaultDevice();

    if (!defaultId) {
      setError("No default device set. Go to Devices page to set one.");
      setIsConnected(false);
      setIsLoading(false);
      return;
    }

    setDeviceId(defaultId);
    setIsLoading(true);
    setError(null);

    try {
      await fetchProgress(defaultId);
      setIsConnected(true);
      console.log("Progress Widget connected to device:", defaultId);
    } catch (err) {
      console.error("Connection error:", err);

      let msg = "Failed to connect.";

      if (err.message.includes("401") || err.message.includes("403")) {
        msg = "Invalid or expired session. Please log in again.";
      } else if (err.message.includes("404")) {
        msg = "Device not found. Please verify the Device ID.";
      } else if (err.message.includes("Failed to fetch")) {
        msg = "Unable to connect to the server. Please check your connection.";
      } else if (err.message) {
        msg = err.message;
      }

      setError(msg);
      setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReconnect = () => {
    setIsConnected(false);
    setError(null);
    void connectToDefault();
  };

  useEffect(() => {
    void connectToDefault();
  }, []);

  useEffect(() => {
    if (!isConnected || !deviceId) return;

    const interval = setInterval(async () => {
      try {
        await fetchProgress(deviceId);
      } catch (err) {
        console.error("Progress polling error:", err);
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [isConnected, deviceId]);

  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key !== STORAGE_KEY) return;

      const newDefault = loadDefaultDevice();

      if (newDefault && newDefault !== deviceId) {
        setDeviceId(newDefault);
        setIsConnected(false);
        window.setTimeout(() => {
          void connectToDefault();
        }, 300);
      }
    };

    window.addEventListener("storage", handleStorageChange);

    return () => window.removeEventListener("storage", handleStorageChange);
  }, [deviceId]);

  const percentage = min === max ? 0 : ((value - min) / (max - min)) * 100;

  return (
    <div className="widget">
      <div className="widget-title">{title}</div>

      {isLoading ? (
        <div className="widget-loading">Connecting to ThingsBoard Cloud...</div>
      ) : !deviceId ? (
        <div className="widget-no-default">
          <p>No default device set.</p>
          <small>
            Go to <strong>Devices</strong> page and set a default Device ID.
          </small>
        </div>
      ) : (
        <div className="widget-control">
          <div className="widget-status">
            {isConnected ? "Connected to " : "Disconnected from "}
            <strong style={{ wordBreak: "break-all", fontSize: "0.9em" }}>
              {deviceId}
            </strong>
          </div>

          {error && <div className="widget-error">⚠️ {error}</div>}

          <div className="widget-container">
            <div className="widget-bar-bg">
              <div
                className="widget-bar-fill"
                style={{
                  width: `${percentage}%`,
                  backgroundColor: color,
                }}
              />
            </div>

            <div className="widget-value">
              {value.toFixed(1)}
              {unit}
            </div>
          </div>

          {!isConnected && (
            <button className="widget-reconnect-btn" onClick={handleReconnect}>
              Reconnect
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default ProgressWidget;