import React, { useState, useEffect } from "react";
import "./Styles/CountWidgets.css";

const TB_URL = import.meta.env.VITE_TB_URL;
const TB_API_KEY = import.meta.env.VITE_TB_API_KEY;

function CountWidgets() {
  const [alarmCount, setAlarmCount] = useState(0);
  const [entityCount, setEntityCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchCounts = async () => {
    try {
      setLoading(true);
      setError("");

      const alarmRes = await fetch(
        `${TB_URL}/api/alarm/count?status=ACTIVE`,
        {
          headers: { "X-Authorization": `ApiKey ${TB_API_KEY}` },
        }
      );

      const entityRes = await fetch(
        `${TB_URL}/api/tenant/entities?pageSize=1&page=0&textSearch=`,
        {
          headers: { "X-Authorization": `ApiKey ${TB_API_KEY}` },
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
      setError("Failed to load counts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCounts();
    const interval = setInterval(fetchCounts, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="count-widgets-container">
      <div className="count-card alarm-card">
        <div className="card-header">
          <span className="card-title">Alarm count</span>
          <div className="card-meta">
            <span className="latest-badge">latest</span>
            <button className="info-btn" title="Information">ℹ</button>
          </div>
        </div>

        <div className="count-content">
          <div className="icon-wrapper alarm-icon">
            <span>⚠️</span>
          </div>
          <div className="count-info">
            <div className="count-label">Total</div>
            <div className="count-value">{alarmCount}</div>
          </div>
        </div>
      </div>

      <div className="count-card entity-card">
        <div className="card-header">
          <span className="card-title">Entity count</span>
          <div className="card-meta">
            <span className="latest-badge">latest</span>
            <button className="info-btn" title="Information">ℹ</button>
          </div>
        </div>

        <div className="count-content">
          <div className="icon-wrapper entity-icon">
            <span>📦</span>
          </div>
          <div className="count-info">
            <div className="count-label">Device</div>
            <div className="count-value">{entityCount}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CountWidgets;