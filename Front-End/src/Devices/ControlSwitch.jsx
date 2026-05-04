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
  const [isToggling, setIsToggling] = useState(false);

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
        value === true || value === "true" || value === 1 || value === "1";
      setIsOn(boolValue);
    }
  };

  const getConnectionErrorMessage = (err) => {
    const message = err?.message || "";
    if (message.includes("401") || message.includes("403"))
      return "Invalid or expired session. Please log in again.";
    if (message.includes("404"))
      return "Device not found. Verify the Device ID in ThingsBoard.";
    if (message.includes("Failed to fetch"))
      return "Unable to reach server. Check your connection.";
    return message || "Failed to connect.";
  };

  const connectToDevice = async (targetDeviceId = loadDefaultDevice()) => {
    if (!targetDeviceId) {
      setError("No default device set. Go to Devices to set one.");
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
    } catch (err) {
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
    if (!deviceId || !isConnected || isToggling) return;
    const nextState = !isOn;
    setIsOn(nextState);
    setIsToggling(true);
    setError(null);
    try {
      await sendOneWayRpc({ deviceId, method: rpcMethod, params: nextState });
      await saveSwitchActivityLog(nextState);
    } catch (err) {
      setIsOn(!nextState);
      setError("Failed to send command.");
    } finally {
      setIsToggling(false);
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
        window.setTimeout(() => void connectToDevice(newDefault), 300);
      }
    };
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [deviceId]);

  const shortDeviceId = deviceId
    ? deviceId.length > 16
      ? `${deviceId.slice(0, 8)}…${deviceId.slice(-6)}`
      : deviceId
    : null;

  return (
    <div className={`cs-widget ${isOn ? "cs-widget--on" : ""}`}>
      <div className="cs-header">
        <span className="cs-title">{title}</span>
        <div className={`cs-status-dot ${isConnected ? "cs-status-dot--connected" : ""}`} />
      </div>

      {isLoading ? (
        <div className="cs-state-view">
          <div className="cs-spinner">
            <div className="cs-spinner-arc" />
          </div>
          <p className="cs-state-label">Connecting…</p>
        </div>
      ) : !deviceId ? (
        <div className="cs-state-view">
          <div className="cs-icon-circle cs-icon-circle--warn">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <p className="cs-state-label">No device selected</p>
          <p className="cs-state-sublabel">Open <strong>Devices</strong> and set a default.</p>
        </div>
      ) : (
        <div className="cs-body">
          <div className="cs-device-pill">
            <svg className="cs-device-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="5" y="2" width="14" height="20" rx="2" />
              <circle cx="12" cy="17" r="1" />
            </svg>
            <span>{shortDeviceId}</span>
          </div>

          <div className="cs-toggle-zone">
            <button
              className={`cs-toggle ${isOn ? "cs-toggle--on" : ""} ${isToggling ? "cs-toggle--busy" : ""}`}
              onClick={handleToggle}
              disabled={!isConnected || isToggling}
              aria-pressed={isOn}
              aria-label={`${title} is ${isOn ? "on" : "off"}`}
            >
              <span className="cs-knob">
                {isToggling && <span className="cs-knob-spinner" />}
              </span>
            </button>

            <span className={`cs-toggle-label ${isOn ? "cs-toggle-label--on" : ""}`}>
              {isOn ? "On" : "Off"}
            </span>
          </div>

          {error && (
            <div className="cs-error">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {!isConnected && !isLoading && (
            <button className="cs-reconnect-btn" onClick={handleReconnect}>
              Reconnect
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default ControlSwitch;