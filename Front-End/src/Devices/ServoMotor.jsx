import { useState } from "react";
import "./Styles/ServoMotor.css";

export default function ServoMotor() {
  const [deviceId, setDeviceId] = useState("");
  const [connected, setConnected] = useState(false);
  const [angle, setAngle] = useState(90);

  const connectToServo = () => {
    console.log("Pretend connecting to device:", deviceId || "test-device");
    setConnected(true);
  };

  const handleDisconnect = () => {
    setConnected(false);
    setDeviceId("");
    setAngle(90);
  };

  const sendAngle = (value) => {
    const numericValue = Number(value);
    setAngle(numericValue);

    console.log("Slider angle:", numericValue);
  };

  return (
    <div className="servo-widget">
      <div className="servo-title">SERVO MOTOR</div>

      {!connected ? (
        <div className="servo-connect">
          <div className="servo-input-group">
            <input
              type="text"
              placeholder="Device ID"
              value={deviceId}
              onChange={(e) => setDeviceId(e.target.value)}
              className="servo-input"
            />
            <button
              onClick={connectToServo}
              className="servo-btn servo-btn-primary"
            >
              CONNECT
            </button>
          </div>
        </div>
      ) : (
        <div className="servo-control">
          <div className="servo-status">
            Connected to <strong>{deviceId || "test-device"}</strong> (test mode)
          </div>

          <div className="servo-angle">
            <div className="servo-angle-value">{angle}</div>
            <div className="servo-angle-unit">°</div>
          </div>

          <input
            type="range"
            min="0"
            max="180"
            value={angle}
            onChange={(e) => sendAngle(e.target.value)}
            className="servo-slider"
            style={{
              "--progress": `${(angle / 180) * 100}%`,
            }}
          />

          <div className="servo-labels">
            <span>0°</span>
            <span>180°</span>
          </div>

          <button 
            className="servo-btn"
            onClick={handleDisconnect}
          >
            Change Device
          </button>
        </div>
      )}
    </div>
  );
}