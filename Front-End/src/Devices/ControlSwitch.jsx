import React, { useState, useEffect } from "react";
import "./Styles/ControlSwitch.css";

function ControlSwitch({ 
  title = "SWITCH", 
  rpcMethod = "setPump"
}) {
  const [deviceId, setDeviceId] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [isOn, setIsOn] = useState(false);
  const [error, setError] = useState(null);
  const [token, setToken] = useState(null);

  const TB_BASE_URL = "";
  const TB_EMAIL = import.meta.env.VITE_TB_EMAIL;
  const TB_PASSWORD = import.meta.env.VITE_TB_PASSWORD;

 const login = async () => {
  const res = await fetch(`/api/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      username: TB_EMAIL,
      password: TB_PASSWORD
    })
  });

  const text = await res.text();

  console.log("STATUS:", res.status);
  console.log("RESPONSE:", text);

  if (!res.ok) throw new Error("Login failed");

  const data = JSON.parse(text);
  setToken(data.token);
  return data.token;
};

  const fetchCurrentState = async (devId) => {
    if (!devId) return;

    try {
      const jwt = token || await login();

      const res = await fetch(
        `${TB_BASE_URL}/api/plugins/telemetry/DEVICE/${devId}/values/timeseries?keys=pump`,
        {
          headers: { 
            "X-Authorization": `Bearer ${jwt}`
          },
        }
      );

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();

      if (data.pump?.length > 0) {
        const value = data.pump[0].value;
        setIsOn(value === true || value === "true");
      }

      setError(null);
    } catch (err) {
      throw err;
    }
  };

  const handleConnect = async () => {
    if (!deviceId) {
      alert("Please enter the Device ID (UUID)");
      return;
    }

    setIsConnected(true);
    setError(null);

    try {
      await login();
      await fetchCurrentState(deviceId);
      console.log("✅ Connected");
    } catch (err) {
      console.error(err);

      let msg = err.message;
      if (msg.includes("404")) msg = "Device not found";
      else if (msg.includes("401") || msg.includes("403")) msg = "Login failed";

      setError(msg);
    }
  };

  const handleToggle = async () => {
    const newState = !isOn;
    setIsOn(newState);
    setError(null);

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
            method: rpcMethod,
            params: newState
          }),
        }
      );

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      console.log("✅ RPC sent");
    } catch (err) {
      console.error(err);

      setIsOn(!newState);

      let msg = err.message;
      if (msg.includes("404")) msg = "Device not found";
      else if (msg.includes("401") || msg.includes("403")) msg = "Auth error";
      else msg = "Failed to send command";

      setError(msg);
    }
  };

  useEffect(() => {
    if (!isConnected || !deviceId) return;

    const interval = setInterval(() => {
      fetchCurrentState(deviceId).catch(() => {});
    }, 5000);

    return () => clearInterval(interval);
  }, [isConnected, deviceId]);

  const handleDisconnect = () => {
    setIsConnected(false);
    setDeviceId("");
    setIsOn(false);
    setError(null);
    setToken(null);
  };

  return (
    <div className="control-switch-widget">
      <div className="control-title">{title}</div>

      {!isConnected ? (
        <div className="control-connect">
          <div className="control-input-group">
            <input
              type="text"
              placeholder="ThingsBoard Device ID (UUID)"
              value={deviceId}
              onChange={(e) => setDeviceId(e.target.value)}
              className="control-input"
            />
            <button onClick={handleConnect} className="control-btn control-btn-primary">
              CONNECT
            </button>
          </div>
        </div>
      ) : (
        <div className="control-control">
          <div className="control-status">
            Connected to <strong>{deviceId}</strong>
          </div>

          {error && <div className="control-error">⚠️ {error}</div>}

          <div className="toggle-area" onClick={handleToggle}>
            <div className={`control-toggle ${isOn ? "on" : ""}`}>
              <div className="toggle-knob"></div>
            </div>
          </div>

          <button className="control-btn" onClick={handleDisconnect}>
            Change Device
          </button>
        </div>
      )}
    </div>
  );
}

export default ControlSwitch;