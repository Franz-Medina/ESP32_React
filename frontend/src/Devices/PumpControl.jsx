import React, { useState } from "react";
import "./PumpControl.css";

const TB_URL = import.meta.env.VITE_TB_URL;
const TB_API_KEY = import.meta.env.VITE_TB_API_KEY;
const DEVICE_ID = import.meta.env.VITE_DEVICE_ID_PUMP;

function PumpControl() {
  const [pumpOn, setPumpOn] = useState(false);
  const [loading, setLoading] = useState(false);

  async function sendPumpCommand(state) {
    try {
      setLoading(true);

      const response = await fetch(`${TB_URL}/api/plugins/rpc/oneway/${DEVICE_ID}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Authorization": `ApiKey ${TB_API_KEY}`
        },
        body: JSON.stringify({
          method: "setPump",
          params: state
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
    } catch (error) {
      console.error("Error sending command:", error);
      setPumpOn(!state);
      alert("Failed to toggle pump. Check console for details.");
    } finally {
      setLoading(false);
    }
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
      {loading && <p>Loading...</p>}
      <label className="switch">
        <input
          type="checkbox"
          checked={pumpOn}
          onChange={togglePump}
          disabled={loading}
        />
        <span className="slider"></span>
      </label>
    </div>
  );
}

export default PumpControl;