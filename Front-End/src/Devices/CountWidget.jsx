import React, { useState, useEffect } from "react";
import "./Styles/WidgetStyle.css";

function CountWidgets() {
  const [alarmCount, setAlarmCount] = useState(0);
  const [entityCount, setEntityCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [token, setToken] = useState(null);

  const TB_BASE_URL = "https://thingsboard.cloud";

  const TB_EMAIL = import.meta.env.VITE_TB_EMAIL;
  const TB_PASSWORD = import.meta.env.VITE_TB_PASSWORD;

  const login = async () => {
    const res = await fetch(`${TB_BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: TB_EMAIL,
        password: TB_PASSWORD
      })
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Login failed (${res.status}): ${text}`);
    }

    const data = await res.json();
    setToken(data.token);
    return data.token;
  };

  const fetchCounts = async () => {
    try {
      const jwt = token || await login();

      const alarmRes = await fetch(
        `${TB_BASE_URL}/api/alarm/count?status=ACTIVE`,
        { headers: { "X-Authorization": `Bearer ${jwt}` } }
      );

      const entityRes = await fetch(
        `${TB_BASE_URL}/api/tenant/entities?pageSize=1&page=0&textSearch=`,
        { headers: { "X-Authorization": `Bearer ${jwt}` } }
      );

      if (!alarmRes.ok || !entityRes.ok) {
        throw new Error("Failed to fetch counts");
      }

      const alarmData = await alarmRes.json();
      const entityData = await entityRes.json();

      setAlarmCount(alarmData.count || 0);
      setEntityCount(entityData.totalElements || 0);
      setError(null);
    } catch (err) {
      console.error("Count fetch error:", err);
      setError("Failed to load counts");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = () => {
    setIsLoading(true);
    setError(null);
    fetchCounts();
  };

  useEffect(() => {
    fetchCounts();
    const interval = setInterval(fetchCounts, 30000);
    return () => clearInterval(interval);
  }, [token]);

  return (
    <div className="widget">
      <div className="widget-title">SYSTEM COUNTS</div>

      {isLoading && (
        <div className="widget-loading">Loading counts...</div>
      )}

      {error && (
        <div className="widget-error">⚠️ {error}</div>
      )}

      <div className="counts-grid">
        <div className="widget-panel alarm-panel">
          <div className="panel-header">
            <span className="panel-title">Active Alarms</span>
            <div className="panel-meta">
              <span className="latest-badge">LIVE</span>
            </div>
          </div>

          <div className="panel-content">
            <div className="icon-wrapper alarm-icon">
              <span>⚠️</span>
            </div>
            <div className="widget-value">{alarmCount}</div>
          </div>
        </div>

        <div className="widget-panel entity-panel">
          <div className="panel-header">
            <span className="panel-title">Total Entities</span>
            <div className="panel-meta">
              <span className="latest-badge">LIVE</span>
            </div>
          </div>

          <div className="panel-content">
            <div className="icon-wrapper entity-icon">
              <span>📦</span>
            </div>
            <div className="widget-value">{entityCount}</div>
          </div>
        </div>
      </div>

      <button 
        className="widget-reconnect-btn" 
        onClick={handleRefresh}
        style={{ marginTop: "12px" }}
      >
        Refresh Counts
      </button>
    </div>
  );
}

export default CountWidgets;