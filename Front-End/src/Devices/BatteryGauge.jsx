import React, { useState, useEffect, useRef, useCallback } from "react";
import "./Styles/WidgetStyle.css";
import { fetchLatestTelemetry } from "../Utils/thingsboardApi";
import { useConnectionMode } from "../Utils/useConnectionMode";

function BatteryGauge({
  title          = "BATTERY GAUGE",
  dataKey        = "battery",
  deviceId: assignedDeviceId = "",
}) {
  const STORAGE_KEY = "avinya_devices";
  const { mode, isDetecting, isCommPort, isThingsBoard, isNone, wsUrl } = useConnectionMode();

  const [deviceId,      setDeviceId]      = useState(null);
  const [isConnected,   setIsConnected]   = useState(false);
  const [batteryLevel,  setBatteryLevel]  = useState(0);
  const [isLoading,     setIsLoading]     = useState(true);
  const [error,         setError]         = useState(null);

  const wsRef         = useRef(null);
  const prevModeRef   = useRef(null);
  const reconnectRef  = useRef(null);
  const intervalRef   = useRef(null);

  const loadDefaultDevice = () => {
    if (assignedDeviceId) return assignedDeviceId;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw).defaultId ?? null;
    } catch { return null; }
  };

  const parseLevel = (value) => {
    if (value === undefined || value === null) return 0;
    return Math.max(0, Math.min(100, parseFloat(value) || 0));
  };

  const getErrorMessage = (err) => {
    const msg = err?.message || "";
    if (msg.includes("401") || msg.includes("403")) return "Invalid or expired session.";
    if (msg.includes("404"))                         return "Device not found.";
    if (msg.includes("Failed to fetch"))             return "Unable to reach server.";
    return msg || "Failed to connect.";
  };

  const fetchBattery = async (devId) => {
    const { data } = await fetchLatestTelemetry({
      deviceId: devId,
      keys: [dataKey],
    });
    const latest = data[dataKey]?.[0]?.value;
    setBatteryLevel(parseLevel(latest));
  };

  const connectThingsBoard = useCallback(async (targetDeviceId) => {
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
      await fetchBattery(targetDeviceId);
      setIsConnected(true);
    } catch (err) {
      setError(getErrorMessage(err));
      setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  }, [dataKey]);

  useEffect(() => {
    if (!isThingsBoard || !isConnected || !deviceId) return;
    intervalRef.current = setInterval(async () => {
      try { await fetchBattery(deviceId); }
      catch (err) { console.error("Battery polling error:", err); }
    }, 10000);
    return () => clearInterval(intervalRef.current);
  }, [isThingsBoard, isConnected, deviceId, dataKey]);

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
        if (data[dataKey] !== undefined) {
          setBatteryLevel(parseLevel(data[dataKey]));
        }
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
  }, [wsUrl, dataKey]);

  useEffect(() => {
    if (isDetecting || isNone) return;
    if (prevModeRef.current === mode) return;
    prevModeRef.current = mode;

    console.log(`[BatteryGauge] Mode: ${mode}`);

    clearInterval(intervalRef.current);
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
      clearInterval(intervalRef.current);
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      if (wsRef.current) {
        wsRef.current.onopen = wsRef.current.onmessage =
        wsRef.current.onerror = wsRef.current.onclose = null;
        try { wsRef.current.close(); } catch {}
      }
    };
  }, []);

  const getBatteryColor = (level) => {
    if (level > 70) return { fill: "#34c759", glow: "rgba(52,199,89,0.35)" };
    if (level > 30) return { fill: "#ff9f0a", glow: "rgba(255,159,10,0.35)" };
    return { fill: "#ff3b30", glow: "rgba(255,59,48,0.35)" };
  };

  const getStatusLabel = (level) => {
    if (level > 70) return "Good";
    if (level > 30) return "Low";
    return "Critical";
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

  const { fill: batteryFill, glow: batteryGlow } = getBatteryColor(batteryLevel);

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

  const bodyW = 130;
  const bodyH = 56;
  const capW  = 8;
  const capH  = 24;
  const fillW = Math.max(0, (batteryLevel / 100) * (bodyW - 10));

  return (
    <div className="cs-widget bg-widget">
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

          <div className="bg-battery-wrap">
            <svg
              viewBox={`0 0 ${bodyW + capW + 6} ${bodyH + 4}`}
              className="bg-battery-svg"
              aria-label={`Battery level ${batteryLevel}%`}
              role="img"
            >
              <defs>
                <clipPath id="bg-clip">
                  <rect x="2" y="2" width={bodyW - 4} height={bodyH - 4} rx="9" />
                </clipPath>
                <filter id="bg-glow">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>

              <rect x="1" y="1" width={bodyW} height={bodyH} rx="12" ry="12"
                fill="none" stroke="currentColor" strokeWidth="2.5"
                className="bg-body-stroke" />

              <rect x="5" y="5" width={fillW} height={bodyH - 10} rx="7"
                fill={batteryFill}
                style={{
                  filter: `drop-shadow(0 0 6px ${batteryGlow})`,
                  transition: "width 0.6s cubic-bezier(0.34,1.56,0.64,1), fill 0.4s ease",
                }} />

              <rect x="5" y="5" width={bodyW - 10} height={(bodyH - 10) / 2}
                rx="7" fill="rgba(255,255,255,0.07)"
                style={{ pointerEvents: "none" }} />

              <text x={bodyW / 2} y={bodyH / 2 + 1}
                textAnchor="middle" dominantBaseline="middle"
                className="bg-pct-text">
                {batteryLevel}%
              </text>

              <rect x={bodyW + 3} y={(bodyH - capH) / 2}
                width={capW} height={capH} rx="3" className="bg-cap" />
            </svg>
          </div>

          <div className="bg-meta-row">
            <div className="bg-status-chip">
              <span className="bg-status-dot"
                style={{ background: batteryFill, boxShadow: `0 0 6px ${batteryGlow}` }} />
              <span className="bg-status-text">{getStatusLabel(batteryLevel)}</span>
            </div>
            <div className="bg-level-bar-wrap">
              <div className="bg-level-bar-track">
                <div className="bg-level-bar-fill"
                  style={{
                    width: `${batteryLevel}%`,
                    background: batteryFill,
                    boxShadow: `0 0 8px ${batteryGlow}`,
                  }} />
              </div>
            </div>
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

export default BatteryGauge;