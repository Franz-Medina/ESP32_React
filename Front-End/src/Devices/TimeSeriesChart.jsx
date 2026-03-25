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

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

const TB_URL = import.meta.env.VITE_TB_URL;
const TB_API_KEY = import.meta.env.VITE_TB_API_KEY;

function TimeSeriesChart({ title = "Temperature History", dataKey = "temperature", unit = "°C" }) {
  const [deviceId, setDeviceId] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [chartData, setChartData] = useState({ labels: [], datasets: [] });
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const fetchTimeSeries = async () => {
    if (!deviceId) return;

    try {
      setIsLoading(true);
      setErrorMessage("");

      const response = await fetch(
        `${TB_URL}/api/plugins/telemetry/DEVICE/${deviceId}/values/timeseries?keys=${dataKey}&limit=50`,
        {
          headers: { "X-Authorization": `ApiKey ${TB_API_KEY}` },
        }
      );

      if (!response.ok) throw new Error("Failed to fetch data");

      const data = await response.json();
      const points = data[dataKey] || [];

      if (points.length === 0) {
        setChartData({ labels: [], datasets: [] });
        return;
      }

      const sortedPoints = [...points].reverse();

      const labels = sortedPoints.map((p) =>
        new Date(p.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      );

      const values = sortedPoints.map((p) => parseFloat(p.value));

      setChartData({
        labels,
        datasets: [
          {
            label: `${title} (${unit})`,
            data: values,
            borderColor: "#60a5fa",
            backgroundColor: "rgba(96, 165, 250, 0.15)",
            tension: 0.4,
            fill: true,
            pointRadius: 3,
            pointHoverRadius: 6,
          },
        ],
      });
    } catch (err) {
      console.error(err);
      setErrorMessage("Failed to load time series data");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isConnected || !deviceId) return;

    fetchTimeSeries();
    const interval = setInterval(fetchTimeSeries, 5000);
    return () => clearInterval(interval);
  }, [isConnected, deviceId]);

  const handleConnect = () => {
    if (!deviceId.trim()) {
      setErrorMessage("Please enter a Device ID");
      return;
    }
    setIsConnected(true);
    setErrorMessage("");
  };

  const handleDisconnect = () => {
    setIsConnected(false);
    setDeviceId("");
    setChartData({ labels: [], datasets: [] });
    setErrorMessage("");
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: true, position: "top", labels: { color: "#e2e8f0" } },
      tooltip: { mode: "index", intersect: false },
    },
    scales: {
      x: { grid: { color: "#334155" }, ticks: { color: "#94a3b8" } },
      y: {
        grid: { color: "#334155" },
        ticks: { color: "#94a3b8" },
        title: { display: true, text: unit, color: "#94a3b8" },
      },
    },
  };

  return (
    <div className="timeseries-widget">
      <div className="widget-header">
        <h3>{title}</h3>
      </div>

      {!isConnected ? (
        <div className="connect-screen">
          <div className="input-group">
            <input
              type="text"
              placeholder="Device ID"
              value={deviceId}
              onChange={(e) => {
                setDeviceId(e.target.value);
                setErrorMessage("");
              }}
              onKeyDown={(e) => e.key === "Enter" && handleConnect()}
            />
            <button className="btn primary" onClick={handleConnect}>
              Connect
            </button>
          </div>
          {errorMessage && <p className="error-msg">{errorMessage}</p>}
        </div>
      ) : (
        <div className="chart-screen">
          <div className="status-bar">
            Device: <strong>{deviceId}</strong>
          </div>

          <div className="chart-container">
            {isLoading && chartData.labels.length === 0 && <p className="loading-text">Loading chart...</p>}
            {errorMessage && <p className="error-msg">{errorMessage}</p>}

            {chartData.labels.length > 0 ? (
              <Line data={chartData} options={chartOptions} />
            ) : (
              <p className="no-data">Waiting for data...</p>
            )}
          </div>

          <button className="btn secondary" onClick={handleDisconnect}>
            Change Device
          </button>
        </div>
      )}
    </div>
  );
}

export default TimeSeriesChart;