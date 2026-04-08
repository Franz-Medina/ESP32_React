import React, { useState, useEffect } from "react";
import "./Styles/LEDIndicator.css";

function LEDIndicator({ instanceId = "led-default" }) {
  const [deviceId, setDeviceId] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [ledState, setLedState] = useState(false);
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
      throw new Error("Login failed");
    }

    const data = await res.json();
    setToken(data.token);
    return data.token;
  };

  const fetchLedState = async () => {
    if (!deviceId) return;

    try {
      const jwt = token || await login();

      const res = await fetch(
        `${TB_BASE_URL}/api/plugins/telemetry/DEVICE/${deviceId}/values/timeseries?keys=led&limit=1`,
        {
          headers: {
            "X-Authorization": `Bearer ${jwt}`
          }
        }
      );

      if (!res.ok) throw new Error();

      const data = await res.json();

      if (data.led && data.led.length > 0) {
        const latest = data.led[0].value;
        setLedState(latest === "true" || latest === true);
      }
    } catch (err) {
      console.error("FETCH LED ERROR:", err);
    }
  };

  const handleToggle = async () => {
    try {
      const jwt = token || await login();

      const newState = !ledState;

      await fetch(`${TB_BASE_URL}/api/plugins/rpc/twoway/${deviceId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Authorization": `Bearer ${jwt}`
        },
        body: JSON.stringify({
          method: "setLED",
          params: newState
        })
      });

      setLedState(newState);
      console.log(`LED ${instanceId} →`, newState);
    } catch (err) {
      console.error("RPC ERROR:", err);
    }
  };

  const handleConnect = async () => {
    if (!deviceId) {
      alert("Enter Device ID");
      return;
    }

    try {
      await login();
      setIsConnected(true);
      await fetchLedState();
    } catch (err) {
      console.error(err);
      alert("Login failed");
    }
  };

  const handleDisconnect = () => {
    setIsConnected(false);
    setDeviceId("");
    setLedState(false);
    setToken(null);
  };

  useEffect(() => {
    if (!isConnected) return;

    const interval = setInterval(fetchLedState, 5000);
    return () => clearInterval(interval);
  }, [isConnected, deviceId]);

  return (
    <div className="led-widget">
      <div className="led-title">LED INDICATOR</div>

      {!isConnected ? (
        <div className="led-connect">
          <div className="led-input-group">
            <input
              type="text"
              placeholder="Device ID"
              value={deviceId}
              onChange={(e) => setDeviceId(e.target.value)}
              className="led-input"
            />
            <button
              onClick={handleConnect}
              className="led-btn led-btn-primary"
            >
              CONNECT
            </button>
          </div>
        </div>
      ) : (
        <div className="led-control">
          <div className="led-status">
            Connected to <strong>{deviceId}</strong>
          </div>

          <div className="led-container" onClick={handleToggle}>
            <div className={`led-bulb ${ledState ? "on" : "off"}`}>
              <div className="led-glow" />
            </div>
          </div>

          <button 
            className="led-btn"
            onClick={handleDisconnect}
          >
            Change Device
          </button>
        </div>
      )}
    </div>
  );
}

export default LEDIndicator;