import { useEffect, useState, useCallback, useRef } from 'react'
import Swal from 'sweetalert2'
import 'sweetalert2/dist/sweetalert2.min.css'
import logo from '../Pictures/Avinya.png'
import '../Styles/Reports.css'
import { getCurrentUserProfile, isAdministratorRole } from '../Utils/getCurrentUserProfile'
import { performReliableLogout } from '../Utils/performReliableLogout'
import { buildApiAssetUrl } from '../Config/API'
import {
  ProfileMenuIcon,
  SearchIcon,
  FilterIcon,
  FirstPageIcon,
  PreviousPageIcon,
  NextPageIcon,
  LastPageIcon
} from '../Components/Icons.jsx'

const TELEMETRY_KEYS = [
  'temperature', 'humidity', 'pressure', 'voltage',
  'current', 'power', 'progress',
]

const POLL_INTERVAL_MS = 10000

const formatTimestamp = (ts) => {
  try {
    const date = new Date(ts)
    if (Number.isNaN(date.getTime())) return String(ts)

    return new Intl.DateTimeFormat('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    }).format(date)
  } catch {
    return String(ts)
  }
}

const ReportsFilterDropdown = ({
  id,
  label,
  icon,
  value,
  options,
  isOpen,
  onToggle,
  onSelect,
  disabled = false
}) => {
  const selectedOption = options.find((option) => option.value === value) || options[0]

  return (
    <div className={`logs-filter-dropdown ${isOpen ? 'open' : ''}`}>
      <button
        type="button"
        id={id}
        className={`logs-filter-field logs-filter-dropdown-trigger ${isOpen ? 'logs-filter-dropdown-trigger-open' : ''}`}
        onClick={onToggle}
        disabled={disabled}
      >
        <span className="logs-filter-field-icon" aria-hidden="true">
          {icon}
        </span>
        <div className="logs-filter-floating-control">
          <span className="logs-filter-dropdown-value">
            {selectedOption.label}
          </span>
          <span className="logs-filter-label logs-filter-label-static">{label}</span>
        </div>
        <span className="logs-filter-field-arrow" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d={isOpen ? 'M18 15l-6-6-6 6' : 'M6 9l6 6 6-6'} />
          </svg>
        </span>
      </button>

      <div className={`logs-filter-dropdown-menu ${isOpen ? 'open' : ''}`}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className={`logs-filter-dropdown-option ${value === option.value ? 'active' : ''}`}
            onClick={() => onSelect(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}

const Reports = ({ onLogout, onNavigate, isDarkMode, onThemeToggle, deviceId }) => {
  const [isEntitiesOpen, setIsEntitiesOpen] = useState(false)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false)

  const [telemetryData, setTelemetryData] = useState([])
  const [allKeys, setAllKeys] = useState([])
  const [metricFilter, setMetricFilter] = useState('all')
  const [searchInput, setSearchInput] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')

  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState('')

  const [openFilterDropdown, setOpenFilterDropdown] = useState('')

  const pollIntervalRef = useRef(null)
  const user = getCurrentUserProfile()
  const isAdministrator = isAdministratorRole(user.roleLabel)

  const sidebarProfileImagePreview = buildApiAssetUrl(user.profilePictureUrl)
  const sidebarUserInitials = [user.firstName, user.lastName]
    .filter(Boolean)
    .map(v => String(v).trim().charAt(0).toUpperCase())
    .join('')
    .slice(0, 2) || 'A'

  const getAuthHeaders = () => ({
    'Content-Type': 'application/json',
    'X-Authorization': `Bearer ${localStorage.getItem('jwtToken') || ''}`,
  })

const fetchTelemetry = useCallback(async (showLoading = true) => {
  if (!deviceId) {
    setError('Device ID is missing. Please select a device.');
    setIsLoading(false);
    return;
  }

  if (showLoading) setIsLoading(true);
  setError('');
  setTelemetryData([]);

  try {
    const token = localStorage.getItem('jwtToken') || localStorage.getItem('token');
    if (!token) {
      throw new Error('Authentication token not found. Please log in again.');
    }

    const keysParam = TELEMETRY_KEYS.length ? `?keys=${TELEMETRY_KEYS.join(',')}` : '';
    const baseUrl = buildApiAssetUrl('');

    const url = `${baseUrl}/api/plugins/telemetry/DEVICE/${deviceId}/values/timeseries${keysParam}`;

    console.log('Fetching telemetry from:', url);

    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Authorization': `Bearer ${token}`,
      },
    });

    console.log('Response status:', res.status);

    if (!res.ok) {
      if (res.status === 401) throw new Error('Unauthorized – token invalid or expired');
      if (res.status === 404) throw new Error(`Device not found (ID: ${deviceId})`);
      throw new Error(`HTTP error ${res.status}`);
    }

    const rawData = await res.json();
    console.log('Telemetry raw data received:', rawData);

    let flatData = [];
    const detectedKeys = new Set();

    Object.entries(rawData || {}).forEach(([metric, entries]) => {
      if (!Array.isArray(entries) || entries.length === 0) return;
      detectedKeys.add(metric);

      entries.forEach(entry => {
        flatData.push({
          metric,
          value: entry.value != null ? entry.value : '—',
          ts: entry.ts || Date.now(),
          deviceId,
        });
      });
    });

    flatData.sort((a, b) => b.ts - a.ts);

    setTelemetryData(flatData);
    setAllKeys(Array.from(detectedKeys).sort());

    if (metricFilter !== 'all' && !detectedKeys.has(metricFilter)) {
      setMetricFilter('all');
    }

    setError('');
  } catch (err) {
    console.error('Telemetry fetch error:', err);
    setError(err.message || 'Failed to load telemetry. Check console for details.');
    setTelemetryData([]);
  } finally {
    setIsLoading(false);
    setIsRefreshing(false);
  }
}, [deviceId, metricFilter]);

  useEffect(() => {
    if (!isAdministrator || !deviceId) return

    fetchTelemetry(true)

    pollIntervalRef.current = setInterval(() => {
      fetchTelemetry(false)
    }, POLL_INTERVAL_MS)

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
    }
  }, [fetchTelemetry, isAdministrator, deviceId])

  const handleRefresh = () => {
    setIsRefreshing(true)
    fetchTelemetry(false)
  }

  const metricFilterOptions = [
    { value: 'all', label: 'All Metrics' },
    ...allKeys.map(key => ({
      value: key,
      label: key.charAt(0).toUpperCase() + key.slice(1)
    }))
  ]

  const filteredData = telemetryData.filter(item => {
    const matchesMetric = metricFilter === 'all' || item.metric === metricFilter
    const matchesSearch = !appliedSearch ||
      item.metric.toLowerCase().includes(appliedSearch.toLowerCase()) ||
      String(item.value).toLowerCase().includes(appliedSearch.toLowerCase())
    return matchesMetric && matchesSearch
  })

  const handleExportCSV = () => {
    if (filteredData.length === 0) return

    const header = ['Device ID', 'Metric', 'Value', 'Timestamp']
    const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`

    const csv = [
      header.map(escape).join(','),
      ...filteredData.map(row => [
        row.deviceId,
        row.metric,
        row.value,
        formatTimestamp(row.ts)
      ].map(escape).join(','))
    ].join('\r\n')

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `device-report-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleMetricFilterChange = (value) => {
    setMetricFilter(value)
    setOpenFilterDropdown('')
  }

  const handleSearchSubmit = (e) => {
    e.preventDefault()
    setAppliedSearch(searchInput.trim())
  }

  const handleSearchInputChange = (e) => setSearchInput(e.target.value)

  const resetFilters = () => {
    setMetricFilter('all')
    setSearchInput('')
    setAppliedSearch('')
  }

  const areFiltersDefault = metricFilter === 'all' && !appliedSearch && !searchInput

  const closeDropdowns = () => {
    setIsEntitiesOpen(false)
    setIsProfileMenuOpen(false)
    setOpenFilterDropdown('')
  }

  const handleSidebarToggle = () => {
    if (!isSidebarCollapsed) closeDropdowns()
    setIsSidebarCollapsed(prev => !prev)
  }

  const handleLogout = async (e) => {
    e.preventDefault()
    const result = await Swal.fire({
      title: 'Log Out?',
      text: 'Are you sure you want to log out?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Yes',
      cancelButtonText: 'No',
      reverseButtons: true,
      customClass: {
        popup: 'avinya-swal-popup',
        icon: 'avinya-swal-icon',
        title: 'avinya-swal-title',
        htmlContainer: 'avinya-swal-text',
        actions: 'avinya-swal-actions',
        confirmButton: 'avinya-swal-confirm',
        cancelButton: 'avinya-swal-cancel',
      },
    })

    if (result.isConfirmed) {
      closeDropdowns()
      performReliableLogout(onLogout)
    }
  }

  if (!isAdministrator) {
    onNavigate('dashboard')
    return null
  }

  return (
    <main className="dashboard-page reports-page">
      <aside className={`dashboard-sidebar ${isSidebarCollapsed ? 'collapsed' : ''}`}>
        <div className="dashboard-sidebar-panel">
          <div className="dashboard-sidebar-header">
            <div className="dashboard-sidebar-top">
              <img src={logo} alt="Avinya Logo" className="dashboard-sidebar-logo" />
              <span className="dashboard-sidebar-brand">AVINYA</span>
            </div>
            <button
              type="button"
              className="dashboard-sidebar-collapse"
              onClick={handleSidebarToggle}
              aria-label={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                {isSidebarCollapsed ? <path d="M9 6l6 6-6 6" /> : <path d="M15 6l-6 6 6 6" />}
              </svg>
            </button>
          </div>

          <nav className="dashboard-sidebar-nav">
            <button type="button" className="dashboard-sidebar-link" data-tooltip="Dashboard" onClick={() => onNavigate('dashboard')}>
              <span className="dashboard-sidebar-link-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" />
                  <rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" />
                </svg>
              </span>
              <span className="dashboard-sidebar-link-label">Dashboard</span>
            </button>

            <div className={`dashboard-sidebar-group ${isEntitiesOpen ? 'open' : ''}`}>
              <button type="button"
                className={`dashboard-sidebar-link dashboard-sidebar-toggle ${isEntitiesOpen ? 'dashboard-sidebar-link-open' : ''}`}
                onClick={() => { setIsProfileMenuOpen(false); setIsEntitiesOpen(p => !p) }}
                aria-expanded={isEntitiesOpen} data-tooltip="Entities">
                <span className="dashboard-sidebar-link-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 7h7" /><path d="M4 12h10" /><path d="M4 17h7" />
                    <circle cx="17" cy="7" r="2" /><circle cx="20" cy="12" r="2" /><circle cx="17" cy="17" r="2" />
                  </svg>
                </span>
                <span className="dashboard-sidebar-link-label">Entities</span>
                <span className="dashboard-sidebar-link-end" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    {isEntitiesOpen ? <path d="M18 15l-6-6-6 6" /> : <path d="M6 9l6 6 6-6" />}
                  </svg>
                </span>
              </button>
              <div className={`dashboard-sidebar-submenu ${isEntitiesOpen ? 'open' : ''}`}>
                <button type="button" className="dashboard-sidebar-sublink" onClick={() => onNavigate('devices')}>
                  <span className="dashboard-sidebar-sublink-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="7" width="7" height="10" rx="1.5" /><rect x="14" y="7" width="7" height="10" rx="1.5" />
                      <path d="M6.5 10.5h.01" /><path d="M17.5 10.5h.01" />
                    </svg>
                  </span>
                  <span className="dashboard-sidebar-sublink-label">Devices</span>
                </button>
              </div>
            </div>

            {isAdministrator && (
              <button type="button" className="dashboard-sidebar-link" data-tooltip="Users" onClick={() => onNavigate('users')}>
                <span className="dashboard-sidebar-link-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
                    <path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                </span>
                <span className="dashboard-sidebar-link-label">Users</span>
              </button>
            )}

            {isAdministrator && (
              <button type="button" className="dashboard-sidebar-link" data-tooltip="Logs" onClick={() => onNavigate('logs')}>
                <span className="dashboard-sidebar-link-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                  </svg>
                </span>
                <span className="dashboard-sidebar-link-label">Logs</span>
              </button>
            )}

            {isAdministrator && (
              <button type="button" className="dashboard-sidebar-link active" data-tooltip="Reports" aria-current="page">
                <span className="dashboard-sidebar-link-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                    <polyline points="10 9 9 9 8 9" />
                  </svg>
                </span>
                <span className="dashboard-sidebar-link-label">Reports</span>
              </button>
            )}
          </nav>

          <div className="dashboard-sidebar-footer">
            <button
              type="button"
              className={`dashboard-sidebar-theme ${isDarkMode ? 'active' : ''}`}
              onClick={onThemeToggle}
              aria-label={isDarkMode ? 'Turn off dark mode' : 'Turn on dark mode'}
              aria-pressed={isDarkMode}
              data-tooltip={isDarkMode ? 'Light Mode' : 'Dark Mode'}
            >
              <span className="dashboard-sidebar-theme-icon" aria-hidden="true">
                {isDarkMode ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="4" />
                    <path d="M12 2v2" /><path d="M12 20v2" />
                    <path d="m4.93 4.93 1.41 1.41" /><path d="m17.66 17.66 1.41 1.41" />
                    <path d="M2 12h2" /><path d="M20 12h2" />
                    <path d="m6.34 17.66-1.41 1.41" /><path d="m19.07 4.93-1.41 1.41" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z" />
                  </svg>
                )}
              </span>
              <span className="dashboard-sidebar-theme-label">{isDarkMode ? 'Light Mode' : 'Dark Mode'}</span>
              <span className="dashboard-sidebar-theme-switch" aria-hidden="true">
                <span className="dashboard-sidebar-theme-thumb" />
              </span>
            </button>

            <div className={`dashboard-sidebar-user-group ${isProfileMenuOpen ? 'open' : ''}`}>
              <div
                className="dashboard-sidebar-user"
                data-tooltip="Profile"
                onClick={isSidebarCollapsed ? () => setIsProfileMenuOpen(p => !p) : undefined}
                role={isSidebarCollapsed ? 'button' : undefined}
                tabIndex={isSidebarCollapsed ? 0 : undefined}
              >
                <div className="dashboard-sidebar-user-avatar" aria-hidden="true">
                  {sidebarProfileImagePreview ? (
                    <img src={sidebarProfileImagePreview} alt="" className="dashboard-sidebar-user-avatar-image" />
                  ) : (
                    <div className="dashboard-sidebar-user-avatar-fallback">
                      <span className="dashboard-sidebar-user-avatar-fallback-text">{sidebarUserInitials}</span>
                    </div>
                  )}
                </div>
                <div className="dashboard-sidebar-user-details">
                  <span className="dashboard-sidebar-user-name">{user.fullName}</span>
                  <span className="dashboard-sidebar-user-email">{user.roleLabel}</span>
                </div>
                <button
                  type="button"
                  className="dashboard-sidebar-user-more"
                  aria-label={isProfileMenuOpen ? 'Close profile menu' : 'Open profile menu'}
                  onClick={(e) => { e.stopPropagation(); setIsProfileMenuOpen(p => !p) }}
                >
                  <ProfileMenuIcon isOpen={isProfileMenuOpen} />
                </button>
              </div>

              <div className={`dashboard-sidebar-user-menu ${isProfileMenuOpen ? 'open' : ''}`}>
                <button type="button" className="dashboard-sidebar-user-menu-item" onClick={() => { closeDropdowns(); onNavigate('account') }}>
                  <span className="dashboard-sidebar-user-menu-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M20 21a8 8 0 0 0-16 0" /><circle cx="12" cy="8" r="4" />
                    </svg>
                  </span>
                  <span>Account</span>
                </button>

                <button type="button" className="dashboard-sidebar-user-menu-item dashboard-sidebar-user-menu-item-danger" onClick={handleLogout}>
                  <span className="dashboard-sidebar-user-menu-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                      <path d="M16 17l5-5-5-5" /><path d="M21 12H9" />
                    </svg>
                  </span>
                  <span>Log Out</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </aside>

      <section className="dashboard-content">
        <div className="dashboard-content-body dashboard-content-body-frame">
          <div className="dashboard-header dashboard-page-title-row">
            <h1 className="dashboard-content-title">Device Telemetry Reports</h1>

            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <button
                type="button"
                className={`refresh-button ${isRefreshing ? 'spinning' : ''}`}
                onClick={handleRefresh}
                disabled={isLoading}
                style={{
                  padding: '8px 16px',
                  background: '#980000',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontWeight: 600
                }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="18" height="18">
                  <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.058 11H1M12 3v2m0 16v2m9-9H15M10 11l-3 3m0-6l3 3" />
                </svg>
                Refresh
              </button>

              <button
                type="button"
                className="logs-export-button"
                onClick={handleExportCSV}
                disabled={filteredData.length === 0 || isLoading}
              >
                <span className="logs-export-button-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="12" y1="12" x2="12" y2="18" />
                    <polyline points="9 15 12 18 15 15" />
                  </svg>
                </span>
                <span>CSV Export</span>
              </button>
            </div>
          </div>

          <section className="logs-panel">
            <div className="logs-panel-toolbar">
              <div className="logs-toolbar-top">
                <div className="logs-filters-group" style={{ gridTemplateColumns: 'minmax(0, 1fr)' }}>
                  <ReportsFilterDropdown
                    id="metric-filter"
                    label="Metric"
                    icon={<FilterIcon />}
                    value={metricFilter}
                    options={metricFilterOptions}
                    isOpen={openFilterDropdown === 'metric'}
                    onToggle={() => setOpenFilterDropdown(prev => prev === 'metric' ? '' : 'metric')}
                    onSelect={handleMetricFilterChange}
                    disabled={isLoading}
                  />
                </div>

                <button
                  type="button"
                  className="logs-filter-reset-button"
                  onClick={resetFilters}
                  disabled={areFiltersDefault || isLoading}
                >
                  Reset Filters
                </button>
              </div>

              <form className="logs-search-form" onSubmit={handleSearchSubmit}>
                <div className="logs-search-field">
                  <span className="logs-search-input-icon" aria-hidden="true">
                    <SearchIcon />
                  </span>
                  <div className="logs-search-floating-control">
                    <input
                      type="search"
                      className="logs-search-input logs-search-floating-input"
                      placeholder=" "
                      value={searchInput}
                      onChange={handleSearchInputChange}
                      disabled={isLoading}
                    />
                    <label className="logs-search-floating-label">Search metric or value</label>
                  </div>
                </div>
                <button type="submit" className="logs-search-button" disabled={isLoading}>
                  Search
                </button>
              </form>
            </div>

            <div className="logs-table-shell">
              {isLoading && (
                <div className="logs-table-loading-overlay">
                  <div className="logs-table-loading-card">
                    <img src={logo} alt="Avinya Logo" className="logs-table-loading-logo" />
                    <p className="logs-table-loading-title">Loading Telemetry...</p>
                    <div className="logs-table-loading-loader">
                      <span className="logs-table-loading-loader-bar"></span>
                    </div>
                  </div>
                </div>
              )}

              <div className={`logs-table-scroll ${filteredData.length === 0 ? 'logs-table-scroll-empty' : ''}`}>
                <table className="logs-table">
                  <thead>
                    <tr className="logs-table-head-row">
                      <th>No.</th>
                      <th>Metric</th>
                      <th>Value</th>
                      <th>Timestamp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredData.length === 0 ? (
                      <tr className="logs-table-state-row logs-table-state-row-empty">
                        <td colSpan="4" className="logs-table-state-cell">
                          {error || (appliedSearch || metricFilter !== 'all' ? 'No matching telemetry records found.' : 'No telemetry data available yet.')}
                        </td>
                      </tr>
                    ) : (
                      filteredData.map((item, index) => (
                        <tr key={`${item.metric}-${item.ts}`} className="logs-table-body-row">
                          <td>{index + 1}</td>
                          <td><span className="logs-action-badge">{item.metric}</span></td>
                          <td>{item.value}</td>
                          <td>{formatTimestamp(item.ts)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </div>
      </section>
    </main>
  )
}

export default Reports