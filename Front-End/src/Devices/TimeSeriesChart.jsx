import React, { useState, useEffect, useRef, useCallback } from "react";
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
  CategoryScale, LinearScale, PointElement,
  LineElement, Title, Tooltip, Legend, Filler
);

/* Time-range presets */
const RANGES = [
  { label: "15m", ms: 15 * 60 * 1000,     limit: 30  },
  { label: "1h",  ms: 60 * 60 * 1000,     limit: 60  },
  { label: "6h",  ms: 6  * 60 * 60 * 1000, limit: 80  },
  { label: "24h", ms: 24 * 60 * 60 * 1000, limit: 100 },
];

function TimeSeriesChart({
  title = "Temperature History",
  dataKey = "temperature",
  unit = "",
  deviceId: assignedDeviceId = "",
}) {
  const STORAGE_KEY = "avinya_devices";

  const [deviceId,    setDeviceId]    = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [chartData,   setChartData]   = useState({ labels: [], datasets: [] });
  const [isLoading,   setIsLoading]   = useState(true);
  const [isPolling,   setIsPolling]   = useState(false);
  const [error,       setError]       = useState(null);
  const [rangeIdx,    setRangeIdx]    = useState(1); // default: 1h
  const [stats,       setStats]       = useState(null); // { min, max, avg, last }
  const [isDark,      setIsDark]      = useState(
    () => document.documentElement.getAttribute("data-theme") === "dark"
  );

  const intervalRef = useRef(null);

  /* watch theme changes */
  useEffect(() => {
    const obs = new MutationObserver(() => {
      setIsDark(document.documentElement.getAttribute("data-theme") === "dark");
    });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => obs.disconnect();
  }, []);

  const loadDefaultDevice = () => {
    if (assignedDeviceId) return assignedDeviceId;

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw).defaultId ?? null;
    } catch { return null; }
  };

  const buildChartData = useCallback((points, key, label, unit, dark) => {
    if (!points?.length) return { labels: [], datasets: [], values: [] };
    const sorted = [...points].sort((a, b) => a.ts - b.ts);
    const labels = sorted.map(p =>
      new Date(p.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    );
    const values = sorted.map(p => parseFloat(p.value));

    const accent = dark ? "#ff6b6b" : "#980000";
    const fill   = dark ? "rgba(255,107,107,0.10)" : "rgba(152,0,0,0.08)";

    return {
      labels,
      values,
      datasets: [{
        label:           `${label} (${unit})`,
        data:            values,
        borderColor:     accent,
        backgroundColor: fill,
        tension:         0.45,
        fill:            true,
        pointRadius:     2.5,
        pointHoverRadius: 6,
        pointBackgroundColor: accent,
        borderWidth:     2,
      }],
    };
  }, []);

  const fetchTimeSeries = useCallback(async (devId, rIdx = rangeIdx) => {
    if (!devId) return;

    const range = RANGES[rIdx];
    const endTs = Date.now();
    const startTs = endTs - range.ms;

    const data = await fetchTelemetryHistory({
      deviceId: devId,
      keys: [dataKey],
      startTs,
      endTs,
      limit: range.limit,
    });

    const points = data.data?.[dataKey] || [];
    const built = buildChartData(points, dataKey, title, unit, isDark);

    setChartData({ labels: built.labels, datasets: built.datasets });

    if (built.values.length) {
      const mn = Math.min(...built.values);
      const mx = Math.max(...built.values);
      const avg = built.values.reduce((s, v) => s + v, 0) / built.values.length;
      const last = built.values[built.values.length - 1];

      setStats({ min: mn, max: mx, avg, last });
    } else {
      setStats(null);
    }
  }, [dataKey, title, unit, rangeIdx, isDark, buildChartData]);

  const connectToDefault = useCallback(async (rIdx) => {
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
      await fetchTimeSeries(defaultId, rIdx ?? rangeIdx);
      setIsConnected(true);
    } catch (err) {
      let msg = "Failed to connect.";

      if (err.message.includes("401") || err.message.includes("403")) {
        msg = "Invalid or expired session.";
      } else if (err.message.includes("404")) {
        msg = "Device not found.";
      } else if (err.message.includes("Failed to fetch")) {
        msg = "Unable to reach server.";
      } else if (err.message) {
        msg = err.message;
      }

      setError(msg);
      setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  }, [assignedDeviceId, fetchTimeSeries, rangeIdx]);

  /* ── initial connect ── */
  useEffect(() => { void connectToDefault(rangeIdx); }, []);

  /* ── polling ── */
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (!isConnected || !deviceId) return;
    intervalRef.current = setInterval(async () => {
      try {
        setIsPolling(true);
        await fetchTimeSeries(deviceId, rangeIdx);
      } catch (err) { console.error("Chart polling error:", err); }
      finally { setIsPolling(false); }
    }, 10000);
    return () => clearInterval(intervalRef.current);
  }, [isConnected, deviceId, rangeIdx, fetchTimeSeries]);

  /* ── re-fetch when range changes ── */
  const handleRangeChange = async (idx) => {
    setRangeIdx(idx);
    if (!isConnected || !deviceId) return;
    try {
      await fetchTimeSeries(deviceId, idx);
    } catch (err) { console.error("Range change error:", err); }
  };

  /* ── storage change ── */
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key !== STORAGE_KEY) return;
      const newId = loadDefaultDevice();
      if (newId && newId !== deviceId) {
        setDeviceId(newId);
        setIsConnected(false);
        setChartData({ labels: [], datasets: [] });
        setTimeout(() => void connectToDefault(rangeIdx), 300);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [deviceId, rangeIdx, connectToDefault]);

  const handleReconnect = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setIsConnected(false);
    setError(null);
    setChartData({ labels: [], datasets: [] });
    void connectToDefault(rangeIdx);
  };

  const shortDeviceId = deviceId
    ? deviceId.length > 16 ? `${deviceId.slice(0, 8)}…${deviceId.slice(-6)}` : deviceId
    : null;

  /* ── chart options (theme-aware) ── */
  const gridColor   = isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)";
  const tickColor   = isDark ? "#636366" : "#8e8e93";
  const legendColor = isDark ? "#ebebf0" : "#1c1c1e";

  const chartOptions = {
    responsive:          true,
    maintainAspectRatio: false,
    animation:           { duration: 400 },
    interaction:         { mode: "index", intersect: false },
    plugins: {
      legend: {
        display: true,
        position: "top",
        labels: {
          color:     legendColor,
          font:      { size: 11, weight: 500, family: "-apple-system, SF Pro Text, sans-serif" },
          boxWidth:  10,
          boxHeight: 10,
          usePointStyle: true,
          pointStyle: "circle",
        },
      },
      tooltip: {
        backgroundColor: isDark ? "rgba(28,28,30,0.92)" : "rgba(255,255,255,0.96)",
        titleColor:      isDark ? "#f2f2f7" : "#1c1c1e",
        bodyColor:       isDark ? "#aeaeb2" : "#636366",
        borderColor:     isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)",
        borderWidth:     1,
        padding:         10,
        cornerRadius:    10,
        callbacks: {
          label: (ctx) => ` ${ctx.formattedValue} ${unit}`,
        },
      },
    },
    scales: {
      x: {
        grid:  { color: gridColor, drawBorder: false },
        ticks: {
          color:     tickColor,
          font:      { size: 10, family: "-apple-system, SF Pro Text, sans-serif" },
          maxTicksLimit: 8,
          maxRotation: 0,
        },
        border: { display: false },
      },
      y: {
        grid:  { color: gridColor, drawBorder: false },
        ticks: {
          color:     tickColor,
          font:      { size: 10, family: "-apple-system, SF Pro Text, sans-serif" },
          callback:  (v) => `${v}${unit}`,
        },
        border: { display: false },
        title: { display: false },
      },
    },
  };

  return (
    <div className="cs-widget tsc-widget">
      {/* ── Header ── */}
      <div className="cs-header">
        <span className="cs-title">{title}</span>
        <div className="tsc-header-right">
          {isPolling && (
            <span className="tsc-poll-spinner">
              <div className="cs-spinner" style={{ width: 14, height: 14 }}>
                <div className="cs-spinner-arc" />
              </div>
            </span>
          )}
          <div className={`cs-status-dot ${isConnected ? "cs-status-dot--connected" : ""}`} />
        </div>
      </div>

      {isLoading ? (
        <div className="cs-state-view">
          <div className="cs-spinner"><div className="cs-spinner-arc" /></div>
          <p className="cs-state-label">Connecting…</p>
        </div>
      ) : !deviceId ? (
        <div className="cs-state-view">
          <div className="cs-icon-circle cs-icon-circle--warn">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          </div>
          <p className="cs-state-label">No device selected</p>
          <p className="cs-state-sublabel">Open <strong>Devices</strong> and set a default.</p>
        </div>
      ) : (
        <div className="cs-body tsc-body">
          {/* Device pill */}
          <div className="cs-device-pill">
            <svg className="cs-device-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="5" y="2" width="14" height="20" rx="2"/><circle cx="12" cy="17" r="1"/>
            </svg>
            <span>{shortDeviceId}</span>
          </div>

          {/* ── Time range selector ── */}
          <div className="tsc-range-row">
            {RANGES.map((r, i) => (
              <button
                key={r.label}
                className={`tsc-range-btn ${rangeIdx === i ? "tsc-range-btn--active" : ""}`}
                onClick={() => handleRangeChange(i)}
              >
                {r.label}
              </button>
            ))}
          </div>

          {/* ── Stats strip ── */}
          {stats && (
            <div className="tsc-stats-row">
              {[
                { label: "Last",  value: stats.last.toFixed(1) },
                { label: "Min",   value: stats.min.toFixed(1)  },
                { label: "Max",   value: stats.max.toFixed(1)  },
                { label: "Avg",   value: stats.avg.toFixed(1)  },
              ].map(s => (
                <div key={s.label} className="tsc-stat">
                  <span className="tsc-stat-label">{s.label}</span>
                  <span className="tsc-stat-value">{s.value}<span className="tsc-stat-unit">{unit}</span></span>
                </div>
              ))}
            </div>
          )}

          {/* ── Chart ── */}
          <div className="tsc-chart-wrap">
            {chartData.labels.length === 0 && !error ? (
              <div className="tsc-no-data">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                </svg>
                <span>No data for this range</span>
              </div>
            ) : (
              <Line data={chartData} options={chartOptions} />
            )}
          </div>

          {/* ── Live badge ── */}
          {isConnected && (
            <div className="tsc-footer">
              <div className="cw-live-badge">
                <span className="cw-live-dot" />
                <span>Live · 10s</span>
              </div>
              <span className="vc2-key-pill">{dataKey}</span>
            </div>
          )}

          {error && (
            <div className="cs-error">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              <span>{error}</span>
            </div>
          )}

          {!isConnected && !isLoading && (
            <button className="cs-reconnect-btn" onClick={handleReconnect}>Reconnect</button>
          )}
        </div>
      )}
    </div>
  );
}

export default TimeSeriesChart;