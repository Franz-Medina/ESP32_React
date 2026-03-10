PumpControl.js
import React, { useState } from "react";
import "./PumpControl.css";

const TB_URL = import.meta.env.VITE_TB_URL;
const TB_EMAIL = import.meta.env.VITE_TB_EMAIL;
const TB_PASSWORD = import.meta.env.VITE_TB_PASSWORD;
const DEVICE_ID = import.meta.env.VITE_DEVICE_ID_PUMP;

function PumpControl() {

  const [pumpOn, setPumpOn] = useState(false);
  const [loading, setLoading] = useState(false);

  async function sendPumpCommand(state) {

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

      // Send RPC command
      await fetch(`${TB_URL}/api/plugins/rpc/oneway/${DEVICE_ID}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          method: "setPump",
          params: state
        })
      });

    } catch (error) {
      console.error("Error sending command:", error);
    }

    setLoading(false);
  }

  const togglePump = async () => {

    const newState = !pumpOn;

    setPumpOn(newState);

    await sendPumpCommand(newState);

  };

  return (

    <div className="pump-widget">

      <h1>Pump Control</h1>

      <p>Status: <strong>{pumpOn ? "ON" : "OFF"}</strong></p>

      <label className="switch">

        <input
          type="checkbox"
          checked={pumpOn}
          onChange={togglePump}
        />

        <span className="slider"></span>

      </label>

    </div>

  );
}

export default PumpControl;
