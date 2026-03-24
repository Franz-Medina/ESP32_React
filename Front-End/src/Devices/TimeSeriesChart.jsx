import React, { useState, useEffect } from "react";

const TB_URL = import.meta.env.VITE_TB_URL;
const TB_API_KEY = import.meta.env.VITE_TB_API_KEY;

function TimeSeriesChart() {
  const [deviceId, setDeviceId] = useState("");
  const [connected, setConnected] = useState(false);

  const [dataPoints, setDataPoints] = useState([]);
  const [error, setError] = useState(null);

  const MAX_POINTS = 20;

  const fetchData = async () => {
    if (!deviceId) return;

    try {
      const res = await fetch(
        `${TB_URL}/api/plugins/telemetry/DEVICE/${deviceId}/values/timeseries?keys=temperature`,
        {
          headers: {
            "X-Authorization": `ApiKey ${TB_API_KEY}`
          }
        }
      );

      if (!res.ok) throw new Error();

      const data = await res.json();

      if (data.temperature && data.temperature.length > 0) {
        const latest = parseFloat(data.temperature[0].value);

        setDataPoints((prev) => {
          const updated = [...prev, latest];
          if (updated.length > MAX_POINTS) updated.shift();
          return updated;
        });
      }

    } catch (err) {
      console.error(err);
      setError("Failed to fetch data");
    }
  };

  useEffect(() => {
    if (!connected) return;

    fetchData();
    const interval = setInterval(fetchData, 2000);
    return () => clearInterval(interval);

  }, [connected, deviceId]);

  const connectDevice = () => {
    if (!deviceId.trim()) {
      alert("Please enter a Device ID");
      return;
    }
    setConnected(true);
  };

  const disconnectDevice = () => {
    setConnected(false);
    setDeviceId("");
    setDataPoints([]);
  };

  const width = 250;
  const height = 100;

  const max = Math.max(...dataPoints, 100);
  const min = Math.min(...dataPoints, 0);

  const points = dataPoints.map((val, i) => {
    const x = (i / (MAX_POINTS - 1)) * width;
    const y = height - ((val - min) / (max - min || 1)) * height;
    return `${x},${y}`;
  }).join(" ");

  return (
    <div className="text-center">

      {!connected ? (
        <>
          <h5>Time Series Chart</h5>

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
          <h5>Time Series Chart</h5>
          <p>Device: {deviceId}</p>

          {error ? (
            <p className="text-danger">{error}</p>
          ) : dataPoints.length > 0 ? (
            <svg width={width} height={height}>
              <polyline
                fill="none"
                stroke="#3b82f6"
                strokeWidth="2"
                points={points}
              />
            </svg>
          ) : (
            <p>Loading data...</p>
          )}

          <button onClick={disconnectDevice}>
            Change Device
          </button>
        </>
      )}

    </div>
  );
}

export default TimeSeriesChart;