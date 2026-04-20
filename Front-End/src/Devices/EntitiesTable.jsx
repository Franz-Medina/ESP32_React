import React, { useState, useEffect } from "react";
import "./Styles/WidgetStyle.css";

function EntitiesTable() {
  const [entities, setEntities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);
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

  const fetchEntities = async () => {
    try {
      setLoading(true);
      setError("");

      const jwt = token || await login();

      const response = await fetch(
        `${TB_BASE_URL}/api/tenant/entities?pageSize=50&page=0&sortProperty=createdTime&sortOrder=DESC`,
        {
          headers: {
            "X-Authorization": `Bearer ${jwt}`
          }
        }
      );

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();

      setEntities(data.data || []);
      setLastUpdated(new Date());
    } catch (err) {
      console.error("FETCH ERROR:", err);
      setError("Failed to load entities table");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEntities();

    const interval = setInterval(fetchEntities, 30000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (date) => {
    if (!date) return "";
    return date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  return (
    <div className="widget">
      <div className="widget-title">ENTITIES TABLE</div>

      <div className="widget-header">
        <div className="last-updated">
          {lastUpdated
            ? `Last updated: ${formatTime(lastUpdated)}`
            : "Loading..."}
        </div>

        <button
          className="widget-refresh-btn"
          onClick={fetchEntities}
          disabled={loading}
          title="Refresh"
        >
          ↻
        </button>
      </div>

      <div className="table-container">
        {loading && entities.length === 0 && (
          <div className="loading-state">Loading entities...</div>
        )}

        {error && <div className="error-state">{error}</div>}

        <table className="widget-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Random</th>
            </tr>
          </thead>

          <tbody>
            {entities.length === 0 && !loading ? (
              <tr>
                <td colSpan="3" className="empty-row">
                  No entities found
                </td>
              </tr>
            ) : (
              entities.map((entity, index) => (
                <tr key={entity.id?.id || index}>
                  <td className="entity-name">{entity.name}</td>

                  <td>
                    <span
                      className={`entity-type ${
                        entity.type?.toLowerCase() || ""
                      }`}
                    >
                      {entity.type || "Unknown"}
                    </span>
                  </td>

                  <td className="random-value">
                    {entity.additionalInfo?.randomValue !== undefined
                      ? Number(entity.additionalInfo.randomValue).toFixed(2)
                      : "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default EntitiesTable;