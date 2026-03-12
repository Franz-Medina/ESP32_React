import React, { useState, useEffect } from "react";
import { arc } from "d3-shape";
import { scaleLinear } from "d3-scale";
import { format } from "d3-format";

const TB_URL = import.meta.env.VITE_TB_URL;
const TB_API_KEY = import.meta.env.VITE_TB_API_KEY;
const DEVICE_ID = import.meta.env.VITE_DEVICE_ID_ESP32US;

//https://2019.wattenberger.com/blog
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

  const colorScale = scaleLinear()
    .domain([0, 1])
    .range(["#dbdbe7", "#720101"]);

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
  const [distance, setDistance] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchDistance = async () => {
      try {
        const res = await fetch(
          `${TB_URL}/api/plugins/telemetry/DEVICE/${DEVICE_ID}/values/timeseries?keys=distance`,
          {
            headers: {
              "X-Authorization": `ApiKey ${TB_API_KEY}`
            }
          }
        );

        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }

        const data = await res.json();

        if (data.distance && data.distance.length > 0) {
          const latest = parseFloat(data.distance[0].value);
          setDistance(latest);
        }
      } catch (err) {
        console.error("Telemetry fetch failed:", err);
        setError("Failed to fetch telemetry");
      }
    };

    fetchDistance();
    const interval = setInterval(fetchDistance, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="text-center">
      <h5>Ultrasonic Distance</h5>
      {error ? (
        <p className="text-danger">{error}</p>
      ) : distance !== null ? (
        <UltraSonicGauge value={distance} />
      ) : (
        <p>Loading distance...</p>
      )}
    </div>
  );
};

export default UltraSonic;