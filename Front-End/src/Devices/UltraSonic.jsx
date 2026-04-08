import React, { useState, useEffect } from "react";
import { arc } from "d3-shape";
import { scaleLinear } from "d3-scale";

const UltraSonicGauge = ({
  value = 0,
  min = 0,
  max = 500,
  label = "Distance",
  units = "cm"
}) => {
  const backgroundArc = arc()
    .innerRadius(0.65)
    .outerRadius(1)
    .startAngle(-Math.PI / 2)
    .endAngle(Math.PI / 2)
    .cornerRadius(1)();

  const percentScale = scaleLinear()
    .domain([min, max])
    .range([0, 1]);

  const percent = percentScale(value);

  const angleScale = scaleLinear()
    .domain([0, 1])
    .range([-Math.PI / 2, Math.PI / 2])
    .clamp(true);

  const angle = angleScale(percent);

  const filledArc = arc()
    .innerRadius(0.65)
    .outerRadius(1)
    .startAngle(-Math.PI / 2)
    .endAngle(angle)
    .cornerRadius(1)();

  const markerLocation = [
    Math.cos(angle - Math.PI / 2) * 0.82,
    Math.sin(angle - Math.PI / 2) * 0.82
  ];

  return (
    <div className="text-center">
      <svg width="9em" viewBox="-1 -1 2 1" style={{ overflow: "visible" }}>
        <path d={backgroundArc} fill="#dbdbe7" />
        <path d={filledArc} fill="#991c1c" />
        <circle
          cx={markerLocation[0]}
          cy={markerLocation[1]}
          r="0.07"
          fill="#2c3e50"
        />
      </svg>
      <div className="mt-2">
        {label}: <strong>{value.toFixed(1)}</strong> {units}
      </div>
    </div>
  );
};

const UltraSonic = () => {
  const [deviceId, setDeviceId] = useState("");
  const [connected, setConnected] = useState(false);

  const [distance, setDistance] = useState(null);
  const [error, setError] = useState(null);
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

  const fetchDistance = async () => {
    if (!deviceId) return;

    try {
      const jwt = token || await login();

      const res = await fetch(
        `${TB_BASE_URL}/api/plugins/telemetry/DEVICE/${deviceId}/values/timeseries?keys=distance&limit=1`,
        {
          headers: {
            "X-Authorization": `Bearer ${jwt}`
          }
        }
      );

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();

      if (data.distance && data.distance.length > 0) {
        const latest = parseFloat(data.distance[0].value);
        setDistance(latest);
      } else {
        setDistance(0);
      }

      setError(null);
    } catch (err) {
      console.error("FETCH ERROR:", err);
      setError("Failed to fetch telemetry");
    }
  };

  const connectDevice = async () => {
    if (!deviceId.trim()) {
      alert("Please enter a Device ID");
      return;
    }

    try {
      await login();
      setConnected(true);
      console.log("✅ Connected");
      fetchDistance();
    } catch (err) {
      console.error(err);
      alert("Login failed");
    }
  };

  const disconnectDevice = () => {
    setConnected(false);
    setDeviceId("");
    setDistance(null);
    setToken(null);
  };

  useEffect(() => {
    if (!connected) return;

    const interval = setInterval(fetchDistance, 2000);
    return () => clearInterval(interval);
  }, [connected, deviceId]);

  return (
    <div className="text-center">
      {!connected ? (
        <>
          <h5>Ultrasonic Distance</h5>

          <input
            type="text"
            placeholder="Enter Device ID"
            value={deviceId}
            onChange={(e) => setDeviceId(e.target.value)}
          />

          <button onClick={connectDevice}>
            Connect
          </button>
        </>
      ) : (
        <>
          <h5>Ultrasonic Distance</h5>
          <p>Device: {deviceId}</p>

          {error ? (
            <p className="text-danger">{error}</p>
          ) : distance !== null ? (
            <UltraSonicGauge value={distance} />
          ) : (
            <p>Loading distance...</p>
          )}

          <button onClick={disconnectDevice}>
            Change Device
          </button>
        </>
      )}
    </div>
  );
};

export default UltraSonic;