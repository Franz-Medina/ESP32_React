import React, { useState } from "react";
import "./ServoMotor.css";

const TB_URL = "https://thingsboard.cloud";
const TB_EMAIL = "aldrinmarquezblas@gmail.com";
const TB_PASSWORD = "asdfghjkl;'";
const DEVICE_ID = "6bdeabb0-179f-11f1-840f-e9bf6f45218f";

function ServoMotor() {

  const [angle, setAngle] = useState(90);
  const [loading, setLoading] = useState(false);

  async function sendAngle(value) {

    try {

      setLoading(true);

      // Login to ThingsBoard
      const loginResponse = await fetch(`${TB_URL}/api/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          username: TB_EMAIL,
          password: TB_PASSWORD
        })
      });

      const loginData = await loginResponse.json();
      const token = loginData.token;

      // Send RPC command to ESP32
      await fetch(`${TB_URL}/api/plugins/rpc/oneway/${DEVICE_ID}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          method: "setAngle",
          params: parseInt(value)
        })
      });

    } catch (error) {
      console.error("Error sending servo command:", error);
    }

    setLoading(false);
  }

  const handleChange = async (event) => {

    const value = event.target.value;

    setAngle(value);

    await sendAngle(value);

  };

  return (

    <div className="servo-widget">

      <h2>Servo Motor Control</h2>

      <p>Angle: <strong>{angle}°</strong></p>

      <input
        type="range"
        min="0"
        max="180"
        value={angle}
        onChange={handleChange}
      />

    </div>

  );

}

export default ServoMotor;
