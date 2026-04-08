import React, { useState, useEffect } from "react";
import "./Styles/CountWidget.css";

function CountWidgets() {
  const [alarmCount, setAlarmCount] = useState(0);
  const [entityCount, setEntityCount] = useState(0);
  const [token, setToken] = useState(null);

  const TB_BASE_URL = "";
  const TB_EMAIL = import.meta.env.VITE_TB_EMAIL;
  const TB_PASSWORD = import.meta.env.VITE_TB_PASSWORD;

  const login = async () => {
    const res = await fetch(`${TB_BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        username: TB_EMAIL,
        password: TB_PASSWORD
      })
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

  const fetchCounts = async () => {
    try {
      const jwt = token || await login();

      const alarmRes = await fetch(
        `${TB_BASE_URL}/api/alarm/count?status=ACTIVE`,
        {
          headers: { "X-Authorization": `Bearer ${jwt}` },
        }
      );

      const entityRes = await fetch(
        `${TB_BASE_URL}/api/tenant/entities?pageSize=1&page=0&textSearch=`,
        {
          headers: { "X-Authorization": `Bearer ${jwt}` },
        }
      );

      if (!alarmRes.ok || !entityRes.ok) {
        throw new Error("Failed to fetch counts");
      }

      const alarmData = await alarmRes.json();
      const entityData = await entityRes.json();

      setAlarmCount(alarmData.count || 0);
      setEntityCount(entityData.totalElements || 0);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchCounts();
    const interval = setInterval(fetchCounts, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="count-widget">
      <div className="count-title">COUNT WIDGETS</div>

      <div className="counts-grid">
        <div className="count-panel alarm-panel">
          <div className="panel-header">
            <span className="panel-title">Alarm count</span>
            <div className="panel-meta">
              <span className="latest-badge">LIVE</span>
            </div>
          </div>

          <div className="panel-content">
            <div className="icon-wrapper alarm-icon">
              <span>⚠️</span>
            </div>
            <div className="count-value">{alarmCount}</div>
          </div>
        </div>

        <div className="count-panel entity-panel">
          <div className="panel-header">
            <span className="panel-title">Entity count</span>
            <div className="panel-meta">
              <span className="latest-badge">LIVE</span>
            </div>
          </div>

          <div className="panel-content">
            <div className="icon-wrapper entity-icon">
              <span>📦</span>
            </div>
            <div className="count-value">{entityCount}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CountWidgets;