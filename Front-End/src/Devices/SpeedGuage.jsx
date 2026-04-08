import React, { useState, useEffect } from "react";
import { arc } from "d3-shape";
import { scaleLinear } from "d3-scale";

const Gauge = ({
  value = 0,
  min = 0,
  max = 120,
  label = "Speed",
  units = "km/h"
}) => {
  const percent = (value - min) / (max - min);

  const angleScale = scaleLinear()
    .domain([0, 1])
    .range([-Math.PI / 2, Math.PI / 2])
    .clamp(true);

  const angle = angleScale(percent);

  const backgroundArc = arc()
    .innerRadius(0.65)
    .outerRadius(1)
    .startAngle(-Math.PI / 2)
    .endAngle(Math.PI / 2)();

  const filledArc = arc()
    .innerRadius(0.65)
    .outerRadius(1)
    .startAngle(-Math.PI / 2)
    .endAngle(angle)();

  const color =
    value < max * 0.5
      ? "#22c55e"
      : value < max * 0.8
      ? "#f59e0b"
      : "#ef4444";

  const marker = [
    Math.cos(angle - Math.PI / 2) * 0.85,
    Math.sin(angle - Math.PI / 2) * 0.85
  ];

  return (
    <div className="text-center">
      <svg width="10em" viewBox="-1 -1 2 1" style={{ overflow: "visible" }}>
        <path d={backgroundArc} fill="#e5e7eb" />
        <path d={filledArc} fill={color} />
        <circle cx={marker[0]} cy={marker[1]} r="0.06" fill="#111827" />
      </svg>

      <div className="mt-2">
        <strong style={{ fontSize: "1.5rem" }}>
          {value.toFixed(1)}
        </strong>{" "}
        {units}
      </div>

      <div style={{ fontSize: "0.9rem", color: "#6b7280" }}>
        {label}
      </div>
    </div>
  );
};

const SpeedGauge = () => {
  const [speed, setSpeed] = useState(null);
  const [error, setError] = useState(null);
  const [token, setToken] = useState(null);

  const DEVICE_ID = import.meta.env.VITE_DEVICE_ID_SPEED;

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

  const fetchSpeed = async () => {
    try {
      const jwt = token || await login();

      const res = await fetch(
        `${TB_BASE_URL}/api/plugins/telemetry/DEVICE/${DEVICE_ID}/values/timeseries?keys=speed&limit=1`,
        {
          headers: {
            "X-Authorization": `Bearer ${jwt}`
          }
        }
      );

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();

      if (data.speed && data.speed.length > 0) {
        setSpeed(parseFloat(data.speed[0].value));
      } else {
        setSpeed(0);
      }

      setError(null);
    } catch (err) {
      console.error("FETCH ERROR:", err);
      setError("Telemetry error");
    }
  };

  useEffect(() => {
    fetchSpeed();

    const interval = setInterval(fetchSpeed, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="text-center">
      <h5>Speed Monitor</h5>

      {error ? (
        <p className="text-danger">{error}</p>
      ) : speed !== null ? (
        <Gauge value={speed} />
      ) : (
        <p>Loading speed...</p>
      )}
    </div>
  );
};

export default SpeedGauge;