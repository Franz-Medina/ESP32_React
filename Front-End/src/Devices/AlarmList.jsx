import React, { useState, useEffect } from "react";
import "./Styles/AlarmList.css";

const TB_URL = import.meta.env.VITE_TB_URL;
const TB_API_KEY = import.meta.env.VITE_TB_API_KEY;

function AlarmList() {
  const [alarms, setAlarms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchAlarms = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        `${TB_URL}/api/alarm?status=ACTIVE&sortProperty=createdTime&sortOrder=DESC&limit=10`,
        {
          headers: {
            "X-Authorization": `ApiKey ${TB_API_KEY}`,
          },
        }
      );

      if (!response.ok) throw new Error("Failed to fetch alarms");

      const data = await response.json();
      setAlarms(data.data || []);
      setLastUpdated(new Date());
    } catch (err) {
      console.error(err);
      setError("Failed to load active alarms");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlarms();
    const interval = setInterval(fetchAlarms, 15000);
    return () => clearInterval(interval);
  }, []);

  const getSeverityColor = (severity) => {
    switch (severity?.toUpperCase()) {
      case "CRITICAL":
        return "severity-critical";
      case "MAJOR":
        return "severity-major";
      case "MINOR":
        return "severity-minor";
      default:
        return "severity-normal";
    }
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return "";
    return new Date(timestamp).toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="alarm-list-widget">
      <div className="widget-header">
        <h3>Active Alarms</h3>
        <div className="header-actions">
          <button
            className="btn-refresh"
            onClick={fetchAlarms}
            disabled={loading}
            title="Refresh alarms"
          >
            ↻
          </button>
          {lastUpdated && (
            <span className="last-updated">
              Updated: {lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
        </div>
      </div>

      <div className="alarm-list-container">
        {loading && alarms.length === 0 && (
          <div className="loading-state">Loading active alarms...</div>
        )}

        {error && <div className="error-message">{error}</div>}

        {alarms.length === 0 && !loading && !error ? (
          <div className="no-alarms">
            <span className="no-alarms-icon"></span>
            <p>No active alarms</p>
          </div>
        ) : (
          <div className="alarm-items">
            {alarms.map((alarm) => (
              <div key={alarm.id?.id} className="alarm-item">
                <div className="alarm-icon">
                  <span className={`severity-dot ${getSeverityColor(alarm.severity)}`}></span>
                </div>

                <div className="alarm-content">
                  <div className="alarm-type">{alarm.type}</div>
                  <div className="alarm-entity">
                    {alarm.originatorName || "Unknown Device"}
                  </div>
                  <div className="alarm-time">
                    {formatTime(alarm.createdTime)}
                  </div>
                </div>

                <div className={`alarm-severity ${getSeverityColor(alarm.severity)}`}>
                  {alarm.severity || "NORMAL"}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default AlarmList;