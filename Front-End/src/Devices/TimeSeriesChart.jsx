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

function TimeSeriesChart({ title = "Temperature History", dataKey = "temperature", unit = "°C" }) {
  const [deviceId, setDeviceId] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [chartData, setChartData] = useState({ labels: [], datasets: [] });

  const handleConnect = () => {
    console.log("Pretend connecting to device:", deviceId || "test-device");
    setIsConnected(true);

    const now = Date.now();
    const mockLabels = Array.from({ length: 20 }, (_, i) => {
      const time = new Date(now - (19 - i) * 300000);
      return time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    });
    const mockValues = Array.from({ length: 20 }, () => 23 + Math.random() * 7);

    setChartData({
      labels: mockLabels,
      datasets: [
        {
          label: `${title} (${unit})`,
          data: mockValues,
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
  };

  const handleDisconnect = () => {
    setIsConnected(false);
    setDeviceId("");
    setChartData({ labels: [], datasets: [] });
  };

  useEffect(() => {
    if (!isConnected || chartData.labels.length === 0) return;

    const interval = setInterval(() => {
      setChartData((prev) => {
        if (!prev.labels.length) return prev;
        const newLabel = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        const lastValue = prev.datasets[0].data[prev.datasets[0].data.length - 1];
        const newValue = Math.max(20, Math.min(32, lastValue + (Math.random() * 2 - 1)));

        return {
          labels: [...prev.labels.slice(1), newLabel],
          datasets: [
            {
              ...prev.datasets[0],
              data: [...prev.datasets[0].data.slice(1), newValue],
            },
          ],
        };
      });
    }, 8000);

    return () => clearInterval(interval);
  }, [isConnected, chartData.labels.length]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: "top",
        labels: { color: "#111827", font: { size: 13, weight: 500 } },
      },
      tooltip: { mode: "index", intersect: false },
    },
    scales: {
      x: {
        grid: { color: "#e4e4e4", lineWidth: 1 },
        ticks: { color: "#6b6b6b", font: { size: 11 } },
      },
      y: {
        grid: { color: "#e4e4e4", lineWidth: 1 },
        ticks: { color: "#6b6b6b", font: { size: 11 } },
        title: { display: true, text: unit, color: "#6b6b6b", font: { size: 12 } },
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
            Connected to <strong>{deviceId || "test-device"}</strong> (test mode)
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