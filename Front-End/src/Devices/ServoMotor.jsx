import React, { useState, useEffect } from "react";
import "./Styles/WidgetStyle.css";
import { sendOneWayRpc } from "../Utils/thingsboardApi";

export default function ServoMotor() {
  const STORAGE_KEY = "avinya_devices";

  const [deviceId, setDeviceId] = useState(null);
  const [connected, setConnected] = useState(false);
  const [angle, setAngle] = useState(90);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isSending, setIsSending] = useState(false);

  const loadDefaultDevice = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed.defaultId ?? null;
    } catch (e) {
      console.error("Failed to load default device from storage:", e);
      return null;
    }
  };

  const connectToDefault = async () => {
    const defaultId = loadDefaultDevice();

    if (!defaultId) {
      setError("No default device set. Go to Devices page to set one.");
      setConnected(false);
      setIsLoading(false);
      return;
    }

    setDeviceId(defaultId);
    setIsLoading(true);
    setError(null);

    try {
      setConnected(true);
    } catch (err) {
      let msg = "Failed to connect";
      if (err.message.includes("401") || err.message.includes("403")) {
        msg = "Invalid or expired session. Please log in again.";
      } else if (err.message.includes("404")) {
        msg = "Device not found. Verify the Device ID in ThingsBoard.";
      } else if (err.message.includes("Failed to fetch")) {
        msg = "Unable to reach server. Check your connection.";
      } else {
        msg = err.message;
      }
      setError(msg);
      setConnected(false);
    } finally {
      setIsLoading(false);
    }
  };

  const sendAngle = async (value) => {
    const numericValue = Number(value);
    if (isNaN(numericValue) || numericValue < 0 || numericValue > 180) return;

    setAngle(numericValue);
    if (!deviceId || !connected) return;

    setIsSending(true);
    try {
      await sendOneWayRpc({
        deviceId,
        method: "setServo",
        params: numericValue,
      });
    } catch (err) {
      setError("Failed to send command to servo.");
    } finally {
      setIsSending(false);
    }
  };

  const handleReconnect = () => {
    setConnected(false);
    setError(null);
    connectToDefault();
  };

  const shortDeviceId = deviceId
    ? deviceId.length > 16
      ? `${deviceId.slice(0, 8)}…${deviceId.slice(-6)}`
      : deviceId
    : null;

  useEffect(() => {
    connectToDefault();
  }, []);

  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === STORAGE_KEY) {
        const newDefault = loadDefaultDevice();
        if (newDefault && newDefault !== deviceId) {
          setDeviceId(newDefault);
          setConnected(false);
          setTimeout(connectToDefault, 300);
        }
      }
    };
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [deviceId]);

  const progress = (angle / 180) * 100;

  const radius = 54;
  const cx = 70;
  const cy = 70;
  const startAngleDeg = 150;
  const endAngleDeg = 30;
  const totalArcDeg = 240;
  const currentArcDeg = (angle / 180) * totalArcDeg;

  const toRad = (deg) => (deg * Math.PI) / 180;
  const arcPath = (startDeg, sweepDeg) => {
    const start = toRad(startDeg);
    const end = toRad(startDeg + sweepDeg);
    const x1 = cx + radius * Math.cos(start);
    const y1 = cy + radius * Math.sin(start);
    const x2 = cx + radius * Math.cos(end);
    const y2 = cy + radius * Math.sin(end);
    const largeArc = sweepDeg > 180 ? 1 : 0;
    return `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`;
  };

  const needleAngleDeg = startAngleDeg + currentArcDeg;
  const needleX = cx + (radius - 8) * Math.cos(toRad(needleAngleDeg));
  const needleY = cy + (radius - 8) * Math.sin(toRad(needleAngleDeg));

  return (
    <div className="cs-widget sm-widget">
      <div className="cs-header">
        <span className="cs-title">SERVO MOTOR</span>
        <div className={`cs-status-dot ${connected ? "cs-status-dot--connected" : ""}`} />
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

          <div className="sm-gauge-wrap">
            <svg viewBox="0 0 140 100" className="sm-gauge-svg" aria-hidden="true">
              <path
                d={arcPath(startAngleDeg, totalArcDeg)}
                fill="none"
                stroke="currentColor"
                strokeWidth="6"
                strokeLinecap="round"
                className="sm-gauge-track"
              />
              {currentArcDeg > 0 && (
                <path
                  d={arcPath(startAngleDeg, currentArcDeg)}
                  fill="none"
                  stroke="#980000"
                  strokeWidth="6"
                  strokeLinecap="round"
                  className="sm-gauge-fill"
                />
              )}
              <circle cx={needleX} cy={needleY} r="4.5" fill="#980000" className="sm-gauge-needle" />
              <text x={cx} y={cy - 4} textAnchor="middle" className="sm-gauge-value">{angle}</text>
              <text x={cx} y={cy + 13} textAnchor="middle" className="sm-gauge-unit">degrees</text>
            </svg>

            <div className="sm-gauge-labels">
              <span>0°</span>
              <span>180°</span>
            </div>
          </div>

          <div className="sm-slider-wrap">
            <input
              type="range"
              min="0"
              max="180"
              value={angle}
              onChange={(e) => sendAngle(e.target.value)}
              className="sm-slider"
              style={{ "--sm-progress": `${progress}%` }}
              disabled={!connected}
              aria-label="Servo angle"
              aria-valuemin={0}
              aria-valuemax={180}
              aria-valuenow={angle}
            />
          </div>

          <div className="sm-presets">
            {[0, 45, 90, 135, 180].map((preset) => (
              <button
                key={preset}
                className={`sm-preset-btn ${angle === preset ? "sm-preset-btn--active" : ""}`}
                onClick={() => sendAngle(preset)}
                disabled={!connected}
                aria-label={`Set angle to ${preset} degrees`}
              >
                {preset}°
              </button>
            ))}
          </div>

          {isSending && (
            <div className="sm-sending">
              <div className="cs-spinner" style={{ width: 16, height: 16 }}>
                <div className="cs-spinner-arc" />
              </div>
              <span>Sending…</span>
            </div>
          )}

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

          {!connected && !isLoading && (
            <button className="cs-reconnect-btn" onClick={handleReconnect}>
              Reconnect
            </button>
          )}
        </div>
      )}
    </div>
  );
}