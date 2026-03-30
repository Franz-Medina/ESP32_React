import { useState } from "react";
import "./Styles/ServoMotor.css";

export default function ServoMotor() {
  const [ip, setIp] = useState("");
  const [connected, setConnected] = useState(false);
  const [angle, setAngle] = useState(90);

  // remind me to fix this later, just a placeholder for now to test
  const connectToServo = () => {
    console.log("Pretend connecting to:", ip);
    setConnected(true);
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
              placeholder="192.168.0.10"
              value={ip}
              onChange={(e) => setIp(e.target.value)}
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
          <div className="servo-status">Connected (test mode)</div>

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
        </div>
      )}
    </div>
  );
}