import { useState } from "react";
import "./Styles/ServoMotor.css";

export default function ServoMotor() {
  const [deviceId, setDeviceId] = useState("");
  const [connected, setConnected] = useState(false);
  const [angle, setAngle] = useState(90);
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

  const connectToServo = async () => {
    if (!deviceId) {
      alert("Please enter Device ID");
      return;
    }

    try {
      await login();
      setConnected(true);
      console.log("✅ Connected to servo");
    } catch (err) {
      console.error(err);
      alert("Login failed");
    }
  };

  const handleDisconnect = () => {
    setConnected(false);
    setDeviceId("");
    setAngle(90);
    setToken(null);
  };

  const sendAngle = async (value) => {
    const numericValue = Number(value);
    setAngle(numericValue);

    try {
      const jwt = token || await login();

      const res = await fetch(
        `${TB_BASE_URL}/api/plugins/rpc/oneway/${deviceId}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Authorization": `Bearer ${jwt}`
          },
          body: JSON.stringify({
            method: "setServo", 
            params: numericValue
          })
        }
      );

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      console.log("✅ Angle sent:", numericValue);
    } catch (err) {
      console.error("RPC ERROR:", err);
    }
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
            Connected to <strong>{deviceId}</strong>
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