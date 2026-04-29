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

import "./Styles/WidgetStyle.css";
import { fetchTelemetryHistory } from "../Utils/thingsboardApi";

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
  const STORAGE_KEY = 'avinya_devices';

  const [deviceId, setDeviceId] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [chartData, setChartData] = useState({ labels: [], datasets: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const login = async () => {
    const res = await fetch(`${TB_BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: TB_EMAIL,
        password: TB_PASSWORD,
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Login failed (${res.status}): ${text}`);
    }

    const data = await res.json();
    setToken(data.token);
    return data.token;
  };

  const fetchTimeSeries = async (devId) => {
    if (!devId) return;

    const endTs = Date.now();
    const startTs = endTs - 60 * 60 * 1000;

    const { data } = await fetchTelemetryHistory({
      deviceId: devId,
      keys: [dataKey],
      startTs,
      endTs,
      limit: 50,
    });
    if (!data[dataKey] || data[dataKey].length === 0) {
      setChartData({ labels: [], datasets: [] });
      return;
    }

    const sorted = data[dataKey].sort((a, b) => a.ts - b.ts);

    const labels = sorted.map((point) =>
      new Date(point.ts).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    );

    const values = sorted.map((point) => parseFloat(point.value));

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
  };

  const connectToDefault = async () => {
    const defaultId = loadDefaultDevice();

    if (!defaultId) {
      setError("No default device set. Go to Devices page to set one.");
      setIsConnected(false);
      setIsLoading(false);
      return;
    }

    setDeviceId(defaultId);
    setIsLoading(true);
    setError(null);

    try {
      await fetchTimeSeries(defaultId);
      setIsConnected(true);
      console.log("Time Series Chart connected to device: ", defaultId);
    } catch (err) {
      console.error("Connection error:", err);

      let msg = "Failed to connect";
      if (err.message.includes("401") || err.message.includes("403")) {
        msg = "Invalid ThingsBoard credentials. Check your .env file.";
      } else if (err.message.includes("404")) {
        msg = "Device not found. Please verify the Device ID.";
      } else if (err.message.includes("Failed to fetch")) {
        msg = "Cannot reach ThingsBoard Cloud. Check your internet connection.";
      } else {
        msg = err.message;
      }

      setError(msg);
      setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  };

  const loadDefaultDevice = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed.defaultId ?? null;
    } catch (e) {
      console.error("Failed to load default device:", e);
      return null;
    }
  };

  const handleReconnect = () => {
    setIsConnected(false);
    setToken(null);
    setError(null);
    setChartData({ labels: [], datasets: [] });
    connectToDefault();
  };

  useEffect(() => {
    connectToDefault();
  }, []);

  useEffect(() => {
    if (!isConnected || !deviceId) return;

    const interval = setInterval(async () => {
      try {
        await fetchTimeSeries(deviceId);
      } catch (err) {
        console.error("Chart polling error:", err);
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [isConnected, deviceId, token]);

  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === STORAGE_KEY) {
        const newDefault = loadDefaultDevice();
        if (newDefault && newDefault !== deviceId) {
          setDeviceId(newDefault);
          setIsConnected(false);
          setToken(null);
          setChartData({ labels: [], datasets: [] });
          setTimeout(connectToDefault, 300);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [deviceId]);

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
    <div className="widget">
      <div className="widget-title">{title}</div>

      {isLoading ? (
        <div className="widget-loading">Connecting to ThingsBoard Cloud...</div>
      ) : !deviceId ? (
        <div className="widget-no-default">
          <p>No default device set.</p>
          <small>Go to <strong>Devices</strong> page and set a default Device ID.</small>
        </div>
      ) : (
        <div className="widget-control">
          <div className="widget-status">
            {isConnected ? "Connected to " : "Disconnected from "} 
            <strong style={{ wordBreak: "break-all", fontSize: "0.9em" }}>{deviceId}</strong>
          </div>

          {error && <div className="widget-error">⚠️ {error}</div>}

          <div className="chart-container" style={{ height: "320px" }}>
            <Line data={chartData} options={chartOptions} />
          </div>

          {!isConnected && (
            <button className="widget-reconnect-btn" onClick={handleReconnect}>
              Reconnect
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default TimeSeriesChart;