import React, { useState, useEffect } from "react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";

import "./Styles/TimeSeriesChart.css";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

function TimeSeriesChart({
  title = "Temperature History",
  dataKey = "temperature",
  unit = "°C",
}) {
  const [deviceId, setDeviceId] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [chartData, setChartData] = useState({ labels: [], datasets: [] });
  const [token, setToken] = useState(null);

  const TB_BASE_URL = "";
  const TB_EMAIL = import.meta.env.VITE_TB_EMAIL;
  const TB_PASSWORD = import.meta.env.VITE_TB_PASSWORD;
  
  const login = async () => {
    const res = await fetch(`${TB_BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username: TB_EMAIL,
        password: TB_PASSWORD,
      }),
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

  const fetchTimeSeries = async () => {
    if (!deviceId) return;

    try {
      const jwt = token || (await login());

      const endTs = Date.now();
      const startTs = endTs - 60 * 60 * 1000;

      const res = await fetch(
        `${TB_BASE_URL}/api/plugins/telemetry/DEVICE/${deviceId}/values/timeseries?keys=${dataKey}&startTs=${startTs}&endTs=${endTs}&limit=50`,
        {
          headers: {
            "X-Authorization": `Bearer ${jwt}`,
          },
        }
      );

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();

      if (!data[dataKey]) return;

      const sorted = data[dataKey].sort((a, b) => a.ts - b.ts);

      const labels = sorted.map((point) =>
        new Date(point.ts).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })
      );

      const values = sorted.map((point) =>
        parseFloat(point.value)
      );

      setChartData({
        labels,
        datasets: [
          {
            label: `${title} (${unit})`,
            data: values,
            borderColor: "#980000",
            backgroundColor: "rgba(152, 0, 0, 0.12)",
            tension: 0.4,
            fill: true,
            pointRadius: 2,
            pointHoverRadius: 5,
            borderWidth: 3,
          },
        ],
      });
    } catch (err) {
      console.error("FETCH ERROR:", err);
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
      await fetchTimeSeries();
    } catch (err) {
      console.error(err);
      alert("Login failed");
    }
  };

  const handleDisconnect = () => {
    setIsConnected(false);
    setDeviceId("");
    setChartData({ labels: [], datasets: [] });
    setToken(null);
  };

  useEffect(() => {
    if (!isConnected) return;

    const interval = setInterval(fetchTimeSeries, 10000);
    return () => clearInterval(interval);
  }, [isConnected, deviceId]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: "top",
        labels: {
          color: "#111827",
          font: { size: 13, weight: 500 },
        },
      },
      tooltip: { mode: "index", intersect: false },
    },
    scales: {
      x: {
        grid: { color: "#e4e4e4" },
        ticks: { color: "#6b6b6b" },
      },
      y: {
        grid: { color: "#e4e4e4" },
        ticks: { color: "#6b6b6b" },
        title: {
          display: true,
          text: unit,
          color: "#6b6b6b",
        },
      },
    },
  };

  return (
    <div className="timeseries-widget">
      <div className="timeseries-title">{title}</div>

      {!isConnected ? (
        <div className="timeseries-connect">
          <div className="timeseries-input-group">
            <input
              type="text"
              placeholder="Device ID"
              value={deviceId}
              onChange={(e) => setDeviceId(e.target.value)}
              className="timeseries-input"
            />
            <button
              onClick={handleConnect}
              className="timeseries-btn timeseries-btn-primary"
            >
              CONNECT
            </button>
          </div>
        </div>
      ) : (
        <div className="timeseries-control">
          <div className="timeseries-status">
            Connected to <strong>{deviceId}</strong>
          </div>

          <div className="chart-container">
            <Line data={chartData} options={chartOptions} />
          </div>

          <button
            className="timeseries-btn"
            onClick={handleDisconnect}
          >
            Change Device
          </button>
        </div>
      )}
    </div>
  );
}

export default TimeSeriesChart;