import React, { useState, useEffect } from "react";
import "./Styles/EntitiesTable.css";

const TB_URL = import.meta.env.VITE_TB_URL;
const TB_API_KEY = import.meta.env.VITE_TB_API_KEY;

function EntitiesTable() {
  const [entities, setEntities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchEntities = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        `${TB_URL}/api/tenant/entities?pageSize=50&page=0&sortProperty=createdTime&sortOrder=DESC`,
        {
          headers: {
            "X-Authorization": `ApiKey ${TB_API_KEY}`,
          },
        }
      );

      if (!response.ok) throw new Error("Failed to fetch entities");

      const data = await response.json();
      setEntities(data.data || []);
      setLastUpdated(new Date());
    } catch (err) {
      console.error(err);
      setError("Failed to load entities table");
    } finally {
      setLoading(false);
    }
  };

  // Initial fetch + auto-refresh every 30 seconds
  useEffect(() => {
    fetchEntities();
    const interval = setInterval(fetchEntities, 30000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (date) => {
    if (!date) return "";
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="entities-table-widget">
      <div className="widget-header">
        <h3>Entities Table</h3>
        <div className="header-actions">
          <button
            className="btn-refresh"
            onClick={fetchEntities}
            disabled={loading}
            title="Refresh"
          >
            ↻
          </button>
          <span className="last-updated">
            {lastUpdated ? `Last updated: ${formatTime(lastUpdated)}` : ""}
          </span>
        </div>
      </div>

      <div className="table-container">
        {loading && <div className="loading-overlay">Loading entities...</div>}

        {error && <div className="error-message">{error}</div>}

        <table className="entities-table">
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
                    <span className={`entity-type ${entity.type?.toLowerCase()}`}>
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