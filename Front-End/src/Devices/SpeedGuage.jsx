import React, { useState, useEffect } from "react";
import { arc } from "d3-shape";
import { scaleLinear } from "d3-scale";

const TB_URL = import.meta.env.VITE_TB_URL;
const TB_API_KEY = import.meta.env.VITE_TB_API_KEY;
const DEVICE_ID = import.meta.env.VITE_DEVICE_ID_SPEED; // NEW DEVICE ID

// 🔵 Gauge UI Component
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

  // 🔥 Color zones like ThingsBoard
  const color =
    value < max * 0.5
      ? "#22c55e" // green
      : value < max * 0.8
      ? "#f59e0b" // yellow
      : "#ef4444"; // red

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

// 🔵 Main Widget Component
const SpeedGauge = () => {
  const [speed, setSpeed] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchSpeed = async () => {
      try {
        const res = await fetch(
          `${TB_URL}/api/plugins/telemetry/DEVICE/${DEVICE_ID}/values/timeseries?keys=speed`,
          {
            headers: {
              "X-Authorization": `ApiKey ${TB_API_KEY}`
            }
          }
        );

        if (!res.ok) throw new Error("Failed to fetch speed");

        const data = await res.json();

        if (data.speed && data.speed.length > 0) {
          setSpeed(parseFloat(data.speed[0].value));
        }
      } catch (err) {
        console.error(err);
        setError("Telemetry error");
      }
    };

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