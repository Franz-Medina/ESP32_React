import React, { useEffect, useState, useRef, useCallback } from "react";
import "./Styles/WidgetStyle.css";
import { fetchLatestTelemetry, sendOneWayRpc } from "../Utils/thingsboardApi";
import { createActivityLog, ACTIVITY_LOG_TYPES } from "../Utils/activityLogsApi";
import { useConnectionMode } from "../Utils/useConnectionMode";

function ControlSwitch({
  title        = "SWITCH",
  rpcMethod    = "setPump",
  telemetryKey = "pump",
  deviceId: assignedDeviceId = "",
  readOnly = false,
}) {
  const STORAGE_KEY = "avinya_devices";
  const { mode, isDetecting, isCommPort, isThingsBoard, isNone, wsUrl } = useConnectionMode();

  const [deviceId,    setDeviceId]    = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isOn,        setIsOn]        = useState(false);
  const [isLoading,   setIsLoading]   = useState(true);
  const [error,       setError]       = useState(null);
  const [isToggling,  setIsToggling]  = useState(false);

  const wsRef          = useRef(null);
  const prevModeRef    = useRef(null);
  const reconnectRef   = useRef(null);

  const isTogglingRef  = useRef(false);
  const pendingStateRef = useRef(null);

  const loadDefaultDevice = () => {
    if (assignedDeviceId) return assignedDeviceId;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw).defaultId ?? null;
    } catch { return null; }
  };

  const parseBool = (value) =>
    value === true || value === "true" || value === 1 || value === "1";

  const getErrorMessage = (err) => {
    const msg = err?.message || "";
    if (msg.includes("401") || msg.includes("403")) return "Invalid or expired session.";
    if (msg.includes("404"))                         return "Device not found.";
    if (msg.includes("Failed to fetch"))             return "Unable to reach server.";
    return msg || "Failed to connect.";
  };

  const lockToggle = (expectedState) => {
    isTogglingRef.current  = true;
    pendingStateRef.current = expectedState;
    setIsToggling(true);
  };

  const unlockToggle = () => {
    isTogglingRef.current  = false;
    pendingStateRef.current = null;
    setIsToggling(false);
  };

  const connectThingsBoard = useCallback(async (targetDeviceId) => {
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
      const { data } = await fetchLatestTelemetry({
        deviceId: targetDeviceId,
        keys: [telemetryKey],
      });
      if (data[telemetryKey]?.length > 0) {
        setIsOn(parseBool(data[telemetryKey][0].value));
      }
      setIsConnected(true);
    } catch (err) {
      setError(getErrorMessage(err));
      setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  }, [telemetryKey]);

  const toggleThingsBoard = async () => {
    const nextState = !isOn;
    setIsOn(nextState);
    lockToggle(nextState);
    setError(null);
    try {
      await sendOneWayRpc({ deviceId, method: rpcMethod, params: nextState });
      await saveSwitchActivityLog(nextState);
    } catch {
      setIsOn(!nextState);
      setError("Failed to send command.");
    } finally {
      unlockToggle();
    }
  };

  const connectCommPort = useCallback(() => {
    if (reconnectRef.current) {
      clearTimeout(reconnectRef.current);
      reconnectRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.onopen    = null;
      wsRef.current.onmessage = null;
      wsRef.current.onerror   = null;
      wsRef.current.onclose   = null;
      try { wsRef.current.close(); } catch {}
      wsRef.current = null;
    }

    setIsLoading(true);
    setError(null);
    setDeviceId("commport");

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      setIsLoading(false);
      setError(null);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data[telemetryKey] === undefined) return;

        const incoming = parseBool(data[telemetryKey]);

        if (isTogglingRef.current) {
          if (incoming === pendingStateRef.current) {
            setIsOn(incoming);
            unlockToggle();
          }
          return;
        }

        setIsOn(incoming);
      } catch {
      }
    };

    ws.onerror = () => {
      setError("Cannot reach bridge. Is bridge.js running?");
      setIsConnected(false);
      setIsLoading(false);
    };

    ws.onclose = () => {
      setIsConnected(false);
      reconnectRef.current = setTimeout(() => {
        if (wsRef.current === ws) {
          setError(null);
          connectCommPort();
        }
      }, 2000);
    };
  }, [wsUrl, telemetryKey]);

  const toggleCommPort = () => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      setError("Not connected to bridge.");
      return;
    }

    const nextState = !isOn;

    lockToggle(nextState);
    setIsOn(nextState);
    setError(null);

    try {
      ws.send(JSON.stringify({ method: rpcMethod, params: nextState }));
      saveSwitchActivityLog(nextState);
    } catch {
      setIsOn(!nextState);
      setError("Failed to send command.");
      unlockToggle();
    }

    setTimeout(() => {
      if (isTogglingRef.current) {
        unlockToggle();
      }
    }, 3000);
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

  const handleToggle = () => {
    if (readOnly || !isConnected || isTogglingRef.current) return;
    if (isCommPort) toggleCommPort();
    else            toggleThingsBoard();
  };

  const handleReconnect = () => {
    setError(null);
    setIsConnected(false);
    if (isCommPort) {
      connectCommPort();
    } else {
      const defaultId = loadDefaultDevice();
      if (defaultId) void connectThingsBoard(defaultId);
      else { setError("No default device set."); setIsLoading(false); }
    }
  };

  useEffect(() => {
    if (isDetecting || isNone) return;
    if (prevModeRef.current === mode) return;
    prevModeRef.current = mode;

    if (reconnectRef.current) {
      clearTimeout(reconnectRef.current);
      reconnectRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.onopen = wsRef.current.onmessage =
      wsRef.current.onerror = wsRef.current.onclose = null;
      try { wsRef.current.close(); } catch {}
      wsRef.current = null;
    }

    unlockToggle();
    setIsConnected(false);
    setError(null);

    if (isCommPort) {
      connectCommPort();
    } else if (isThingsBoard) {
      const defaultId = loadDefaultDevice();
      setDeviceId(defaultId);
      void connectThingsBoard(defaultId);
    }
  }, [mode, isDetecting, isCommPort, isThingsBoard, isNone, connectCommPort, connectThingsBoard]);

  useEffect(() => {
    if (!isThingsBoard) return;
    const handleStorageChange = (e) => {
      if (e.key !== STORAGE_KEY) return;
      const newDefault = loadDefaultDevice();
      if (newDefault && newDefault !== deviceId) {
        setDeviceId(newDefault);
        setIsConnected(false);
        setTimeout(() => void connectThingsBoard(newDefault), 300);
      }
    };
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [deviceId, isThingsBoard, connectThingsBoard]);

  useEffect(() => {
    return () => {
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      if (wsRef.current) {
        wsRef.current.onopen = wsRef.current.onmessage =
        wsRef.current.onerror = wsRef.current.onclose = null;
        try { wsRef.current.close(); } catch {}
      }
    };
  }, []);

  const shortDeviceId = !deviceId ? null
    : deviceId === "commport" ? "COM Port"
    : deviceId.length > 16
      ? `${deviceId.slice(0, 8)}…${deviceId.slice(-6)}`
      : deviceId;

  const modeBadgeStyle = {
    fontSize: "9px", fontWeight: 700, letterSpacing: ".05em",
    textTransform: "uppercase", padding: "2px 7px", borderRadius: "999px",
    background: isCommPort  ? "rgba(52,199,89,.12)"
              : isDetecting ? "rgba(142,142,147,.12)"
              : isNone      ? "rgba(255,59,48,.10)"
              :               "rgba(152,0,0,.08)",
    color:      isCommPort  ? "#34c759"
              : isDetecting ? "#8e8e93"
              : isNone      ? "#ff3b30"
              :               "#980000",
    border:     isCommPort  ? "1px solid rgba(52,199,89,.22)"
              : isDetecting ? "1px solid rgba(142,142,147,.2)"
              : isNone      ? "1px solid rgba(255,59,48,.2)"
              :               "1px solid rgba(152,0,0,.16)",
  };

  const modeLabel = isDetecting ? "Detecting…"
                  : isCommPort  ? "COM Port"
                  : isNone      ? "No Connection"
                  :               "Cloud";

  return (
    <div className={`cs-widget ${isOn ? "cs-widget--on" : ""}`}>
      <div className="cs-header">
        <span className="cs-title">{title}</span>
        <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
          <span style={modeBadgeStyle}>{modeLabel}</span>
          <div className={`cs-status-dot ${isConnected ? "cs-status-dot--connected" : ""}`} />
        </div>
      </div>

      {isDetecting ? (
        <div className="cs-state-view">
          <div className="cs-spinner"><div className="cs-spinner-arc" /></div>
          <p className="cs-state-label">Detecting connection…</p>
          <p className="cs-state-sublabel">Checking ThingsBoard and CommPort</p>
        </div>
      ) : isNone ? (
        <div className="cs-state-view">
          <div className="cs-icon-circle cs-icon-circle--warn">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          </div>
          <p className="cs-state-label">No connection available</p>
          <p className="cs-state-sublabel">Connect to WiFi or plug in the USB cable</p>
          <button className="cs-reconnect-btn" onClick={handleReconnect}>Retry</button>
        </div>
      ) : isLoading ? (
        <div className="cs-state-view">
          <div className="cs-spinner"><div className="cs-spinner-arc" /></div>
          <p className="cs-state-label">Connecting…</p>
        </div>
      ) : !deviceId ? (
        <div className="cs-state-view">
          <div className="cs-icon-circle cs-icon-circle--warn">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          </div>
          <p className="cs-state-label">No device selected</p>
          <p className="cs-state-sublabel">Open <strong>Devices</strong> and set a default.</p>
        </div>
      ) : (
        <div className="cs-body">
          <div className="cs-device-pill">
            <svg className="cs-device-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {isCommPort
                ? <><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 9h6M9 12h6M9 15h4"/></>
                : <><rect x="5" y="2" width="14" height="20" rx="2"/><circle cx="12" cy="17" r="1"/></>
              }
            </svg>
            <span>{shortDeviceId}</span>
          </div>

          <div className="cs-toggle-zone">
            <button
              className={`cs-toggle ${isOn ? "cs-toggle--on" : ""} ${isToggling ? "cs-toggle--busy" : ""}`}
              onClick={handleToggle}
              disabled={readOnly || !isConnected || isToggling}
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
            {readOnly && (
              <p className="cs-readonly-note">
                View only. Control is available to the assigned user.
              </p>
            )}
          </div>

          {error && (
            <div className="cs-error">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
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