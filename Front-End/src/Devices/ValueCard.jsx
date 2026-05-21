import React, { useCallback, useEffect, useRef, useState } from "react";
import "./Styles/WidgetStyle.css";
import { fetchLatestTelemetry } from "../Utils/thingsboardApi";
import { useConnectionMode } from "../Utils/useConnectionMode";

const STORAGE_KEY = "avinya_devices";
const VALUE_CARD_READY_TIMEOUT_MS = 5200;
const VALUE_CARD_NOT_READY_MESSAGE =
  "Device is not ready yet. Check the USB connection, port, and uploaded Arduino code.";

const formatTimeAgo = (value) => {
  if (!value) return "just now";

  const date = new Date(value);
  const diffSeconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));

  if (Number.isNaN(date.getTime()) || diffSeconds < 5) return "just now";
  if (diffSeconds < 60) return `${diffSeconds}s ago`;

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks < 5) return `${diffWeeks}w ago`;

  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) return `${diffMonths}mo ago`;

  return `${Math.floor(diffDays / 365)}y ago`;
};

const getDisplayValue = (value) => {
  if (value === undefined || value === null || value === "") return "No data";
  if (typeof value === "boolean") return value ? "true" : "false";

  return String(value).trim() || "No data";
};

function ValueCard({
  title = "VALUE CARD",
  dataKey = "value",
  deviceId: assignedDeviceId = "",
}) {
  const { mode, isDetecting, isCommPort, isThingsBoard, isNone, wsUrl } = useConnectionMode();

  const [deviceId, setDeviceId] = useState(null);
  const [value, setValue] = useState(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const [, setClockTick] = useState(0);

  const wsRef = useRef(null);
  const reconnectRef = useRef(null);
  const readyTimeoutRef = useRef(null);
  const prevModeRef = useRef(null);
  const hasReceivedValueRef = useRef(false);

  const loadDefaultDevice = useCallback(() => {
    if (assignedDeviceId) return assignedDeviceId;

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;

      return JSON.parse(raw).defaultId ?? null;
    } catch {
      return null;
    }
  }, [assignedDeviceId]);

  const clearReadyTimeout = useCallback(() => {
    if (readyTimeoutRef.current) {
      window.clearTimeout(readyTimeoutRef.current);
      readyTimeoutRef.current = null;
    }
  }, []);

  const cleanupCommPort = useCallback(() => {
    clearReadyTimeout();

    if (reconnectRef.current) {
      window.clearTimeout(reconnectRef.current);
      reconnectRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.onopen = null;
      wsRef.current.onmessage = null;
      wsRef.current.onerror = null;
      wsRef.current.onclose = null;

      try {
        wsRef.current.close();
      } catch {
      }

      wsRef.current = null;
    }
  }, [clearReadyTimeout]);

  const applyIncomingValue = useCallback((nextValue, timestamp = Date.now()) => {
    hasReceivedValueRef.current = true;

    setValue(nextValue);
    setLastUpdatedAt(timestamp || Date.now());
    setIsConnected(true);
    setIsLoading(false);
    setError("");
    clearReadyTimeout();
  }, [clearReadyTimeout]);

  const connectThingsBoard = useCallback(async (targetDeviceId) => {
    if (!targetDeviceId) {
      setDeviceId(null);
      setIsConnected(false);
      setIsLoading(false);
      setError("No device is assigned to this dashboard.");
      return;
    }

    setDeviceId(targetDeviceId);
    setIsLoading(true);
    setIsConnected(false);
    setError("");

    try {
      const { data } = await fetchLatestTelemetry({
        deviceId: targetDeviceId,
        keys: [dataKey],
      });

      const latestRow = data?.[dataKey]?.[0];

      if (!latestRow || latestRow.value === undefined || latestRow.value === null) {
        throw new Error(VALUE_CARD_NOT_READY_MESSAGE);
      }

      applyIncomingValue(latestRow.value, latestRow.ts || Date.now());
    } catch (err) {
      setValue(null);
      setLastUpdatedAt(null);
      setIsConnected(false);
      setIsLoading(false);
      setError(err.message || VALUE_CARD_NOT_READY_MESSAGE);
    }
  }, [applyIncomingValue, dataKey]);

  const connectCommPort = useCallback(() => {
    cleanupCommPort();

    hasReceivedValueRef.current = false;

    setDeviceId("commport");
    setValue(null);
    setLastUpdatedAt(null);
    setIsConnected(false);
    setIsLoading(true);
    setError("");

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    readyTimeoutRef.current = window.setTimeout(() => {
      if (!hasReceivedValueRef.current) {
        setIsConnected(false);
        setIsLoading(false);
        setError(VALUE_CARD_NOT_READY_MESSAGE);
      }
    }, VALUE_CARD_READY_TIMEOUT_MS);

    ws.onopen = () => {
      setError("");
    };

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);

        if (payload?.[dataKey] === undefined || payload?.[dataKey] === null) {
          return;
        }

        applyIncomingValue(
          payload[dataKey],
          payload.ts || payload.timestamp || Date.now()
        );
      } catch {
      }
    };

    ws.onerror = () => {
      setIsConnected(false);
      setIsLoading(false);
      setError(VALUE_CARD_NOT_READY_MESSAGE);
      clearReadyTimeout();
    };

    ws.onclose = () => {
      setIsConnected(false);
      clearReadyTimeout();

      if (!hasReceivedValueRef.current) {
        setIsLoading(false);
        setError(VALUE_CARD_NOT_READY_MESSAGE);
        return;
      }

      reconnectRef.current = window.setTimeout(() => {
        connectCommPort();
      }, 2000);
    };
  }, [applyIncomingValue, cleanupCommPort, clearReadyTimeout, dataKey, wsUrl]);

  const handleReconnect = () => {
    setError("");
    setIsLoading(true);
    setIsConnected(false);

    if (isCommPort) {
      connectCommPort();
      return;
    }

    void connectThingsBoard(loadDefaultDevice());
  };

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setClockTick((tick) => tick + 1);
    }, 30000);

    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (isDetecting) {
      setIsLoading(true);
      setError("");
      return;
    }

    if (prevModeRef.current === mode) return;
    prevModeRef.current = mode;

    cleanupCommPort();
    hasReceivedValueRef.current = false;

    setValue(null);
    setLastUpdatedAt(null);
    setIsConnected(false);
    setError("");

    if (isNone) {
      setIsLoading(false);
      setError(VALUE_CARD_NOT_READY_MESSAGE);
      return;
    }

    if (isCommPort) {
      connectCommPort();
      return;
    }

    if (isThingsBoard) {
      void connectThingsBoard(loadDefaultDevice());
    }
  }, [
    cleanupCommPort,
    connectCommPort,
    connectThingsBoard,
    isCommPort,
    isDetecting,
    isNone,
    isThingsBoard,
    loadDefaultDevice,
    mode,
  ]);

  useEffect(() => {
    if (!isThingsBoard) return;

    const handleStorageChange = (event) => {
      if (event.key !== STORAGE_KEY) return;

      const nextDeviceId = loadDefaultDevice();

      if (nextDeviceId && nextDeviceId !== deviceId) {
        void connectThingsBoard(nextDeviceId);
      }
    };

    window.addEventListener("storage", handleStorageChange);

    return () => window.removeEventListener("storage", handleStorageChange);
  }, [connectThingsBoard, deviceId, isThingsBoard, loadDefaultDevice]);

  useEffect(() => {
    return () => {
      cleanupCommPort();
    };
  }, [cleanupCommPort]);

  const modeLabel = isDetecting
    ? "Detecting"
    : isCommPort
      ? "COM Port"
      : isNone
        ? "No Connection"
        : "Cloud";

  const modeClass = isCommPort
    ? "commport"
    : isNone
      ? "none"
      : isDetecting
        ? "detecting"
        : "cloud";

  return (
    <div className="cs-widget vc2-widget vc2-simple-widget">
      <div className="cs-header">
        <span className="cs-title">{title}</span>

        <div className="vc2-simple-header-right">
          <span className={`vc2-mode-badge vc2-mode-badge--${modeClass}`}>
            {modeLabel}
          </span>
          <div className={`cs-status-dot ${isConnected ? "cs-status-dot--connected" : ""}`} />
        </div>
      </div>

      {isDetecting || isLoading ? (
        <div className="cs-state-view">
          <div className="cs-spinner">
            <div className="cs-spinner-arc" />
          </div>
          <p className="cs-state-label">
            {isDetecting ? "Detecting connection..." : "Checking device..."}
          </p>
          <p className="cs-state-sublabel">
            Waiting for live telemetry.
          </p>
        </div>
      ) : error ? (
        <div className="cs-state-view">
          <div className="cs-icon-circle cs-icon-circle--warn">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <p className="cs-state-label">Hardware not ready</p>
          <p className="cs-state-sublabel">{error}</p>
          <button className="cs-reconnect-btn" onClick={handleReconnect}>
            Retry
          </button>
        </div>
      ) : (
        <div className="vc2-simple-body">
          <span className="vc2-simple-value">
            {getDisplayValue(value)}
          </span>

          <span className="vc2-simple-updated">
            Last update {formatTimeAgo(lastUpdatedAt)}
          </span>
        </div>
      )}
    </div>
  );
}

export default ValueCard;