import React, { useState } from "react";
import "./ServoMotor.css";

const TB_URL = import.meta.env.VITE_TB_URL;
const TB_API_KEY = import.meta.env.VITE_TB_API_KEY;
const DEVICE_ID = import.meta.env.VITE_DEVICE_ID_ESP32US;

function ServoMotor() {
  const [angle, setAngle] = useState(90);
  const [loading, setLoading] = useState(false);

  async function sendAngle(value) {
    try {
      setLoading(true);

      const response = await fetch(`${TB_URL}/api/plugins/rpc/oneway/${DEVICE_ID}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Authorization": `ApiKey ${TB_API_KEY}`
        },
        body: JSON.stringify({
          method: "setAngle",
          params: parseInt(value)
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
    } catch (error) {
      console.error("Error sending servo command:", error);
      setAngle(90);
      alert("Failed to set servo angle. Check console for details.");
    } finally {
      setLoading(false);
    }
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
      {loading && <p>Loading...</p>}
      <input
        type="range"
        min="0"
        max="180"
        value={angle}
        onChange={handleChange}
        disabled={loading}
      />
    </div>
  );
}

export default ServoMotor;