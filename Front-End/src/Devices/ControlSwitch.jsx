import React, { useEffect, useState } from "react";
import "./Styles/WidgetStyle.css";
import { fetchLatestTelemetry, sendOneWayRpc } from "../Utils/thingsboardApi";
import { createActivityLog, ACTIVITY_LOG_TYPES } from "../Utils/activityLogsApi";

function ControlSwitch({
  title = "SWITCH",
  rpcMethod = "setPump",
  telemetryKey = "pump",
}) {
  const STORAGE_KEY = "avinya_devices";

  const [deviceId, setDeviceId] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isOn, setIsOn] = useState(false);
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

  const fetchCurrentState = async (targetDeviceId) => {
    if (!targetDeviceId) return;

    const { data } = await fetchLatestTelemetry({
      deviceId: targetDeviceId,
      keys: [telemetryKey],
    });

    if (data[telemetryKey]?.length > 0) {
      const value = data[telemetryKey][0].value;

      const boolValue =
        value === true ||
        value === "true" ||
        value === 1 ||
        value === "1";

      setIsOn(boolValue);
    }
  };

  const getConnectionErrorMessage = (err) => {
    const message = err?.message || "";

    if (message.includes("401") || message.includes("403")) {
      return "Invalid or expired session. Please log in again.";
    }

    if (message.includes("404")) {
      return "Device not found. Please verify the Device ID in ThingsBoard.";
    }

    if (message.includes("Failed to fetch")) {
      return "Unable to connect to the server. Please check your connection.";
    }

    return message || "Failed to connect.";
  };

  const connectToDevice = async (targetDeviceId = loadDefaultDevice()) => {
    if (!targetDeviceId) {
      setError("No default device set. Go to Devices page to set one.");
      setIsConnected(false);
      setIsLoading(false);
      return;
    }

    setDeviceId(targetDeviceId);
    setIsLoading(true);
    setError(null);

    try {
      await fetchCurrentState(targetDeviceId);

      setIsConnected(true);
      console.log("Connected to device:", targetDeviceId);
    } catch (err) {
      console.error("Connection error:", err);

      setError(getConnectionErrorMessage(err));
      setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  };

  const saveSwitchActivityLog = async (nextState) => {
    try {
      await createActivityLog({
        actionType: ACTIVITY_LOG_TYPES.DEVICE_UPDATED,
        deviceId,
        deviceDescription: `${title} was turned ${nextState ? "ON" : "OFF"}`,
      });
    } catch (logError) {
      console.error("CONTROL SWITCH ACTIVITY LOG ERROR:", logError);
    }
  };

  const handleToggle = async () => {
    if (!deviceId || !isConnected) return;

    const nextState = !isOn;

    setIsOn(nextState);
    setError(null);

    try {
      await sendOneWayRpc({
        deviceId,
        method: rpcMethod,
        params: nextState,
      });

      await saveSwitchActivityLog(nextState);

      console.log(`Command sent: ${rpcMethod}(${nextState})`);
    } catch (err) {
      console.error("RPC error:", err);

      setIsOn(!nextState);
      setError("Failed to send command.");
    }
  };

  const handleReconnect = () => {
    setIsConnected(false);
    setError(null);

    const defaultId = loadDefaultDevice();

    if (defaultId) {
      void connectToDevice(defaultId);
    } else {
      setError("No default device set. Go to Devices page.");
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const defaultId = loadDefaultDevice();

    setDeviceId(defaultId);
    void connectToDevice(defaultId);
  }, []);

  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key !== STORAGE_KEY) return;

      const newDefault = loadDefaultDevice();

      if (newDefault && newDefault !== deviceId) {
        setDeviceId(newDefault);
        setIsConnected(false);

        window.setTimeout(() => {
          void connectToDevice(newDefault);
        }, 300);
      }
    };

    window.addEventListener("storage", handleStorageChange);

    return () => window.removeEventListener("storage", handleStorageChange);
  }, [deviceId]);

  return (
    <div className="widget">
      <div className="widget-title">{title}</div>

      {isLoading ? (
        <div className="widget-loading">Connecting to ThingsBoard Cloud...</div>
      ) : !deviceId ? (
        <div className="widget-no-default">
          <p>No default device set.</p>
          <small>
            Go to <strong>Devices</strong> page and set a default device.
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

          <div
            className="toggle-area"
            onClick={handleToggle}
            style={{
              cursor: isConnected ? "pointer" : "not-allowed",
              opacity: isConnected ? 1 : 0.6,
            }}
          >
            <div className={`widget-toggle ${isOn ? "on" : ""}`}>
              <div className="toggle-knob"></div>
            </div>

            <div style={{ marginTop: "8px", fontWeight: "bold" }}>
              {isOn ? "ON" : "OFF"}
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

export default ControlSwitch;