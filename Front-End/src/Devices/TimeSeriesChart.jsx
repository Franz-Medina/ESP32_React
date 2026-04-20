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

  const loadDefaultDeviceId = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed.defaultId ?? null;
    } catch {
      return null;
    }
  };

  const [deviceId, setDeviceId] = useState(() => loadDefaultDeviceId());
  const [isConnected, setIsConnected] = useState(false);
  const [chartData, setChartData] = useState({ labels: [], datasets: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [token, setToken] = useState(null);

  const TB_EMAIL = import.meta.env.VITE_TB_EMAIL;
  const TB_PASSWORD = import.meta.env.VITE_TB_PASSWORD;
  
  const login = async () => {
    const res = await fetch(`/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: TB_EMAIL,
        password: TB_PASSWORD,
      }),
    });

    if (!res.ok) throw new Error("Login failed");
    const data = await res.json();
    setToken(data.token);
    return data.token;
  };

  const fetchTimeSeries = async (devId) => {
    if (!devId) return;
    try {
      const jwt = token || (await login());
      const endTs = Date.now();
      const startTs = endTs - 60 * 60 * 1000;
      const res = await fetch(
        `/api/plugins/telemetry/DEVICE/${devId}/values/timeseries?keys=${dataKey}&startTs=${startTs}&endTs=${endTs}&limit=50`,
        { headers: { "X-Authorization": `Bearer ${jwt}` } }
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
      setError(null);
    } catch (err) {
      console.error("FETCH ERROR:", err);
      throw err;
    }
  };

  const connectToDefault = async () => {
    const defaultId = loadDefaultDeviceId();
    if (!defaultId) {
      setError("No default device set. Go to Devices page to set one.");
      setIsLoading(false);
      return;
    }
    setDeviceId(defaultId);
    setIsLoading(true);
    setError(null);
    try {
      await login();
      await fetchTimeSeries(defaultId);
      setIsConnected(true);
    } catch (err) {
      let msg = err.message;
      if (msg.includes("404")) msg = "Device not found";
      else if (msg.includes("401") || msg.includes("403")) msg = "Login failed";
      else msg = "Failed to connect";
      setError(msg);
      setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = () => {
    setIsConnected(false);
    setIsLoading(true);
    setError(null);
    setToken(null);
    setChartData({ labels: [], datasets: [] });
    setTimeout(connectToDefault, 100);
  };

  useEffect(() => {
    connectToDefault();
  }, []);

  useEffect(() => {
    if (!isConnected || !deviceId) return;
    const interval = setInterval(() => {
      fetchTimeSeries(deviceId).catch(() => {});
    }, 10000);
    return () => clearInterval(interval);
  }, [isConnected, deviceId]);

  useEffect(() => {
    const handleStorage = (e) => {
      if (e.key === STORAGE_KEY) {
        const newDefault = loadDefaultDeviceId();
        if (newDefault && newDefault !== deviceId) {
          setDeviceId(newDefault);
          handleDisconnect();
        }
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
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
        <div className="widget-loading">Connecting to default device...</div>
      ) : !deviceId ? (
        <div className="widget-no-default">
          <p>No default device set.</p>
          <small>Go to <strong>Devices</strong> page and set a default Device ID.</small>
        </div>
      ) : (
        <div className="widget-control">
          <div className="widget-status">
            Connected to <strong>{deviceId}</strong>
          </div>

          {error && <div className="widget-error">⚠️ {error}</div>}

          <div className="chart-container">
            <Line data={chartData} options={chartOptions} />
          </div>
        </div>
      )}
    </div>
  );
}

export default TimeSeriesChart;