import { useState } from 'react'
import './ScheduledReportManager.css'
import '../Dashboard.css'

export default function ScheduledReportManager() {
  const [showForm, setShowForm] = useState(false)

  return (
    <div className="dashboard-page">

      <aside className="dashboard-sidebar">
        <div className="dashboard-sidebar-panel">

          <div className="dashboard-sidebar-header">
            <div className="dashboard-sidebar-top">
              <img src="/logo.png" className="dashboard-sidebar-logo" />
              <span className="dashboard-sidebar-brand">Avinya</span>
            </div>
          </div>

          <nav className="dashboard-sidebar-nav">
            <a className="dashboard-sidebar-link" href="/dashboard">
              Dashboard
            </a>

            <a className="dashboard-sidebar-link active" href="/reports">
              Reports
            </a>

            <a className="dashboard-sidebar-link" href="/devices">
              Devices
            </a>
          </nav>

        </div>
      </aside>

      <main className="dashboard-content">
        <div className="dashboard-content-body dashboard-content-body-frame">

          <div className="dashboard-page-title-row">
            <h1 className="dashboard-content-title">Reports</h1>
          </div>

          <div className="srm-container">

            <div className="srm-header">
              <div>
                <div className="srm-title">Reports</div>
                <div className="srm-subtitle">2 active schedules</div>
              </div>

              <button
                className="srm-btn-primary"
                onClick={() => setShowForm(true)}
              >
                + New Schedule
              </button>
            </div>

            <div className="srm-tabs">
              <button className="srm-tab active">Schedules</button>
              <button className="srm-tab">History</button>
            </div>

            <div className="srm-card">
              <div className="srm-card-row">
                <div>
                  <div className="srm-card-title">Daily System Health</div>
                  <div className="srm-card-sub">
                    Daily · temperature, humidity
                  </div>
                </div>

                <div className="srm-card-actions">
                  <input type="checkbox" className="srm-toggle" />
                  <button className="srm-btn-ghost">Run</button>
                  <button className="srm-btn-ghost">Edit</button>
                </div>
              </div>
            </div>

            {showForm && (
              <div className="srm-modal-overlay">
                <div className="srm-modal">

                  <div className="srm-modal-header">
                    <span>New Report Schedule</span>
                    <button onClick={() => setShowForm(false)}>×</button>
                  </div>

                  <div className="srm-modal-body">
                    <label className="srm-label">Report Name</label>
                    <input className="srm-input" placeholder="Enter name..." />

                    <label className="srm-label">Frequency</label>
                    <div className="srm-grid">
                      <button className="freq-chip active">Daily</button>
                      <button className="freq-chip">Weekly</button>
                      <button className="freq-chip">Monthly</button>
                    </div>

                    <label className="srm-label">Metrics</label>
                    <div className="srm-chip-group">
                      <button className="metric-chip active">🌡️ Temp</button>
                      <button className="metric-chip">💧 Humidity</button>
                    </div>

                    <label className="srm-label">Format</label>
                    <select className="srm-select">
                      <option>PDF</option>
                      <option>CSV</option>
                    </select>
                  </div>

                  <div className="srm-modal-footer">
                    <button
                      className="srm-btn-ghost"
                      onClick={() => setShowForm(false)}
                    >
                      Cancel
                    </button>
                    <button className="srm-btn-primary">Save</button>
                  </div>

                </div>
              </div>
            )}

          </div>
        </div>
      </main>
    </div>
  )
}