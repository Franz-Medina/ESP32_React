import React, { useState, useEffect } from "react";
import "../Styles/LEDIndicator.css";

const TB_URL = import.meta.env.VITE_TB_URL;
const TB_API_KEY = import.meta.env.VITE_TB_API_KEY;

function LEDIndicator() {

  const [deviceId, setDeviceId] = useState("");
  const [connected, setConnected] = useState(false);
  const [ledState, setLedState] = useState(false);
  const [loading, setLoading] = useState(false);

  async function fetchLEDStatus() {
    if (!deviceId) return;

    try {
      const response = await fetch(
        `${TB_URL}/api/plugins/telemetry/DEVICE/${deviceId}/values/timeseries?keys=ledState`,
        {
          headers: {
            "Content-Type": "application/json",
            "X-Authorization": `ApiKey ${TB_API_KEY}`
          }
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch LED status");
      }

      const data = await response.json();

      if (data.ledState && data.ledState.length > 0) {
        const latestValue = data.ledState[0].value === "true";
        setLedState(latestValue);
      }

    } catch (error) {
      console.error("Error fetching LED state:", error);
    }
  }

  const connectDevice = async () => {
    if (!deviceId) {
      alert("Please enter a Device ID");
      return;
    }

    setConnected(true);
    setLoading(true);

    await fetchLEDStatus();

    setLoading(false);
  };

  // Auto refresh every 5 seconds
  useEffect(() => {
    if (!connected) return;

    const interval = setInterval(() => {
      fetchLEDStatus();
    }, 5000);

    return () => clearInterval(interval);

  }, [connected, deviceId]);

  return (
    <div className="led-widget">

      {!connected ? (
        <div className="device-input">

          <h2>LED Indicator</h2>

          <input
            type="text"
            placeholder="Enter Device ID"
            value={deviceId}
            onChange={(e) => setDeviceId(e.target.value)}
          />

          <button onClick={connectDevice}>
            Connect
          </button>

        </div>
      ) : (
        <div className="led-display">

          <h2>LED Indicator</h2>
          <p>Device ID: {deviceId}</p>

          {loading && <p>Checking status...</p>}

          <div className={`led-light ${ledState ? "on" : "off"}`}></div>

          <p>Status: <strong>{ledState ? "ON" : "OFF"}</strong></p>

          <button onClick={fetchLEDStatus}>
            Refresh
          </button>

        </div>
      )}

    </div>
  );
}

export default LEDIndicator;