import { useEffect, useState, useCallback } from 'react'
import Swal from 'sweetalert2'
import 'sweetalert2/dist/sweetalert2.min.css'
import logo from '../Pictures/Avinya.png'
import '../Styles/Logs.css'
import { getCurrentUserProfile, isAdministratorRole } from '../Utils/getCurrentUserProfile'
import { performReliableLogout } from '../Utils/performReliableLogout'
import { buildApiAssetUrl } from '../Config/API'

const LOGS_STORAGE_KEY = 'avinya_activity_logs'
const LOGS_PER_PAGE = 15
const LOGS_VISIBLE_PAGE_BUTTONS = 5

export const LOG_TYPES = {
  LOGIN:         'login',
  LOGOUT:        'logout',
  DEVICE_ADDED:  'device_added',
  DEVICE_REMOVED:'device_removed',
}

const LOG_TYPE_META = {
  [LOG_TYPES.LOGIN]:          { label: 'Login',          color: 'success' },
  [LOG_TYPES.LOGOUT]:         { label: 'Logout',         color: 'neutral' },
  [LOG_TYPES.DEVICE_ADDED]:   { label: 'Device Added',   color: 'info'    },
  [LOG_TYPES.DEVICE_REMOVED]: { label: 'Device Removed', color: 'danger'  },
}

const ALL_LOG_TYPE_FILTER_OPTIONS = [
  { value: 'all',                       label: 'All Actions'    },
  { value: LOG_TYPES.LOGIN,             label: 'Login'          },
  { value: LOG_TYPES.LOGOUT,            label: 'Logout'         },
  { value: LOG_TYPES.DEVICE_ADDED,      label: 'Device Added'   },
  { value: LOG_TYPES.DEVICE_REMOVED,    label: 'Device Removed' },
]

// ==================== LOAD / SAVE LOGS ====================
export const loadLogs = () => {
  try {
    const raw = localStorage.getItem(LOGS_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const saveLogs = (logs) => {
  try {
    localStorage.setItem(LOGS_STORAGE_KEY, JSON.stringify(logs))
  } catch {}
}

// ==================== LOGGING FUNCTIONS ====================
export const appendLog = (type, actorUser, detail = '', extra = {}) => {
  const existing = loadLogs()

  const entry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    actorName:  actorUser?.fullName  || actorUser?.email || 'System',
    actorEmail: actorUser?.email     || '',
    actorRole:  actorUser?.roleLabel || '',
    detail:     detail || '',
    timestamp:  new Date().toISOString(),
    ...extra,                    // For deviceId, etc.
  }

  saveLogs([entry, ...existing])
}

// Helper functions to call from other components
export const logLogin = (user) => {
  appendLog(LOG_TYPES.LOGIN, user, `User logged in successfully`)
}

export const logLogout = (user) => {
  appendLog(LOG_TYPES.LOGOUT, user, `User logged out`)
}

export const logDeviceAdded = (user, deviceId, description = '') => {
  appendLog(
    LOG_TYPES.DEVICE_ADDED,
    user,
    `Device ID "${deviceId}" was added`,
    { deviceId, deviceDescription: description }
  )
}

export const logDeviceRemoved = (user, deviceId) => {
  appendLog(
    LOG_TYPES.DEVICE_REMOVED,
    user,
    `Device ID "${deviceId}" was removed`,
    { deviceId }
  )
}

// ==================== MAIN LOGS COMPONENT ====================
const Logs = ({ onLogout, onNavigate, isDarkMode, onThemeToggle }) => {
  const [isEntitiesOpen,    setIsEntitiesOpen]    = useState(false)
  const [isSidebarCollapsed,setIsSidebarCollapsed]= useState(false)
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false)

  const [allLogs,          setAllLogs]          = useState(() => loadLogs())
  const [typeFilter,       setTypeFilter]        = useState('all')
  const [searchInput,      setSearchInput]       = useState('')
  const [appliedSearch,    setAppliedSearch]     = useState('')
  const [currentPage,      setCurrentPage]       = useState(1)
  const [isTypeDropOpen,   setIsTypeDropOpen]    = useState(false)
  const [tableAnimKey,     setTableAnimKey]      = useState(0)

  const user = getCurrentUserProfile()
  const isAdministrator = isAdministratorRole(user.roleLabel)
  const sidebarProfileImagePreview = buildApiAssetUrl(user.profilePictureUrl)
  const sidebarUserInitials =
    [user.firstName, user.lastName]
      .filter(Boolean)
      .map((v) => String(v).trim().charAt(0).toUpperCase())
      .join('')
      .slice(0, 2) || 'A'

  useEffect(() => {
    const sync = () => setAllLogs(loadLogs())
    window.addEventListener('focus', sync)
    return () => window.removeEventListener('focus', sync)
  }, [])

  useEffect(() => {
    document.title = 'Avinya | Logs'

    const handleOutsideClick = (event) => {
      if (!(event.target instanceof Element)) return
      if (!event.target.closest('.dashboard-sidebar-user-group')) setIsProfileMenuOpen(false)
      if (!event.target.closest('.logs-filter-dropdown')) setIsTypeDropOpen(false)
    }

    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [])

  useEffect(() => {
    if (!isAdministrator) onNavigate('dashboard')
  }, [isAdministrator, onNavigate])

  // Filter logs
  const filteredLogs = allLogs.filter((log) => {
    const matchType = typeFilter === 'all' || log.type === typeFilter
    if (!matchType) return false

    if (appliedSearch) {
      const q = appliedSearch.toLowerCase()
      return (
        log.actorName.toLowerCase().includes(q)  ||
        log.actorEmail.toLowerCase().includes(q) ||
        log.detail.toLowerCase().includes(q)     ||
        (log.deviceId || '').toLowerCase().includes(q) ||
        (LOG_TYPE_META[log.type]?.label || '').toLowerCase().includes(q)
      )
    }
    return true
  })

  const totalCount = filteredLogs.length
  const totalPages = Math.max(1, Math.ceil(totalCount / LOGS_PER_PAGE))
  const safePage   = Math.min(currentPage, totalPages)
  const pageStart  = (safePage - 1) * LOGS_PER_PAGE
  const pageLogs   = filteredLogs.slice(pageStart, pageStart + LOGS_PER_PAGE)
  const paginationItems = getLogsPaginationItems(safePage, totalPages)

  const resetToFirstPage = useCallback(() => {
    setCurrentPage(1)
    setTableAnimKey((k) => k + 1)
  }, [])

  const handleTypeFilterChange = (value) => {
    setTypeFilter(value)
    setIsTypeDropOpen(false)
    resetToFirstPage()
  }

  const handleSearchSubmit = (e) => {
    e.preventDefault()
    setAppliedSearch(searchInput.trim())
    resetToFirstPage()
  }

  const handleSearchInputChange = (e) => {
    setSearchInput(e.target.value)
    if (!e.target.value.trim()) {
      setAppliedSearch('')
      resetToFirstPage()
    }
  }

  const handleClearLogs = async () => {
    const result = await Swal.fire({
      title: 'Clear All Logs?',
      text: 'This will permanently delete all activity logs. This cannot be undone.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Clear All',
      cancelButtonText: 'Cancel',
      reverseButtons: true,
      buttonsStyling: false,
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

    if (!result.isConfirmed) return
    saveLogs([])
    setAllLogs([])
    resetToFirstPage()
  }

  const areFiltersAtDefault = typeFilter === 'all' && !appliedSearch && !searchInput

  const handleResetFilters = () => {
    setTypeFilter('all')
    setSearchInput('')
    setAppliedSearch('')
    resetToFirstPage()
  }

  const closeDropdowns = () => {
    setIsEntitiesOpen(false)
    setIsProfileMenuOpen(false)
  }

  const handleSidebarToggle = () => {
    if (!isSidebarCollapsed) closeDropdowns()
    setIsSidebarCollapsed((prev) => !prev)
  }

  const handleEntitiesToggle = () => {
    setIsProfileMenuOpen(false)
    setIsEntitiesOpen((prev) => !prev)
  }

  const handleProfileMenuToggle = (event) => {
    event.stopPropagation()
    setIsEntitiesOpen(false)
    setIsProfileMenuOpen((prev) => !prev)
  }

  const handleLogout = async (event) => {
    event.preventDefault()
    event.stopPropagation()

    const result = await Swal.fire({
      title: 'Log Out?',
      text: 'Are you sure you want to log out?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Yes',
      cancelButtonText: 'No',
      reverseButtons: true,
      buttonsStyling: false,
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

    if (!result.isConfirmed) return
    closeDropdowns()
    performReliableLogout(onLogout)
  }

  if (!isAdministrator) return null

  const selectedTypeOption = ALL_LOG_TYPE_FILTER_OPTIONS.find((o) => o.value === typeFilter) || ALL_LOG_TYPE_FILTER_OPTIONS[0]

  return (
    <main className="dashboard-page logs-page">
      <aside className={`dashboard-sidebar ${isSidebarCollapsed ? 'collapsed' : ''}`}>
        {/* Sidebar code remains exactly the same as your original */}
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
              <button
                type="button"
                className={`dashboard-sidebar-link dashboard-sidebar-toggle ${isEntitiesOpen ? 'dashboard-sidebar-link-open' : ''}`}
                onClick={handleEntitiesToggle}
                aria-expanded={isEntitiesOpen}
                data-tooltip="Entities"
              >
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

            <button type="button" className="dashboard-sidebar-link" data-tooltip="Users" onClick={() => onNavigate('users')}>
              <span className="dashboard-sidebar-link-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
                  <path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </span>
              <span className="dashboard-sidebar-link-label">Users</span>
            </button>

            <button type="button" className="dashboard-sidebar-link active" data-tooltip="Logs" aria-current="page">
              <span className="dashboard-sidebar-link-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                </svg>
              </span>
              <span className="dashboard-sidebar-link-label">Logs</span>
            </button>
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
                onClick={isSidebarCollapsed ? handleProfileMenuToggle : undefined}
                role={isSidebarCollapsed ? 'button' : undefined}
                tabIndex={isSidebarCollapsed ? 0 : undefined}
                onKeyDown={
                  isSidebarCollapsed
                    ? (event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          handleProfileMenuToggle(event)
                        }
                      }
                    : undefined
                }
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
                  aria-label="More user options"
                  aria-expanded={isProfileMenuOpen}
                  onClick={handleProfileMenuToggle}
                >
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <circle cx="12" cy="5" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="12" cy="19" r="1.8" />
                  </svg>
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

          <div className="dashboard-header logs-page-topbar">
            <h1 id="logs-page-title" className="dashboard-content-title">Logs</h1>
            <span className="logs-topbar-count">{totalCount} {totalCount === 1 ? 'Entry' : 'Entries'}</span>
          </div>

          <section className="logs-panel" aria-labelledby="logs-page-title">

            <div className="logs-panel-toolbar">

              <div className="logs-filters-group">

                <div className={`logs-filter-dropdown ${isTypeDropOpen ? 'open' : ''}`}>
                  <button
                    type="button"
                    id="logs-type-filter"
                    className={`logs-filter-field logs-filter-dropdown-trigger ${isTypeDropOpen ? 'logs-filter-dropdown-trigger-open' : ''}`}
                    onClick={() => setIsTypeDropOpen((p) => !p)}
                    aria-haspopup="listbox"
                    aria-expanded={isTypeDropOpen}
                  >
                    <span className="logs-filter-field-icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
                      </svg>
                    </span>
                    <div className="logs-filter-floating-control">
                      <span className="logs-filter-dropdown-value">
                        {selectedTypeOption.label}
                      </span>
                      <span className="logs-filter-label logs-filter-label-static">Action Type</span>
                    </div>
                    <span className="logs-filter-field-arrow" aria-hidden="true">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d={isTypeDropOpen ? 'M18 15l-6-6-6 6' : 'M6 9l6 6 6-6'} />
                      </svg>
                    </span>
                  </button>

                  <div className={`logs-filter-dropdown-menu ${isTypeDropOpen ? 'open' : ''}`} role="listbox" aria-labelledby="logs-type-filter">
                    {ALL_LOG_TYPE_FILTER_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        className={`logs-filter-dropdown-option ${typeFilter === option.value ? 'active' : ''}`}
                        onClick={() => handleTypeFilterChange(option.value)}
                        role="option"
                        aria-selected={typeFilter === option.value}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  className="logs-filter-reset-button"
                  onClick={handleResetFilters}
                  disabled={areFiltersAtDefault}
                >
                  Reset Filters
                </button>
              </div>

              <div className="logs-toolbar-right">
                <button
                  type="button"
                  className="logs-clear-button"
                  onClick={handleClearLogs}
                  disabled={allLogs.length === 0}
                >
                  <span className="logs-clear-button-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
                    </svg>
                  </span>
                  <span>Clear All</span>
                </button>

                <form className="logs-search-form" onSubmit={handleSearchSubmit} role="search" aria-label="Search logs">
                  <div className="logs-search-field">
                    <span className="logs-search-input-icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                      </svg>
                    </span>
                    <div className="logs-search-floating-control">
                      <input
                        id="logs-search-input"
                        type="search"
                        className="logs-search-input logs-search-floating-input"
                        placeholder=" "
                        value={searchInput}
                        onChange={handleSearchInputChange}
                        aria-label="Search logs"
                      />
                      <label htmlFor="logs-search-input" className="logs-search-floating-label">Search</label>
                    </div>
                  </div>
                  <button type="submit" className="logs-search-button">
                    <span className="logs-search-button-icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                      </svg>
                    </span>
                    <span>Search</span>
                  </button>
                </form>
              </div>
            </div>

            <div className="logs-table-shell">
              <div
                className={`logs-table-scroll ${pageLogs.length === 0 ? 'logs-table-scroll-empty' : ''}`}
                role="region"
                aria-label="Activity logs table"
                tabIndex="0"
              >
                <table className="logs-table">
                  <colgroup>
                    <col className="logs-table-col-no" />
                    <col className="logs-table-col-action" />
                    <col className="logs-table-col-actor" />
                    <col className="logs-table-col-role" />
                    <col className="logs-table-col-detail" />
                    <col className="logs-table-col-timestamp" />
                  </colgroup>
                  <thead>
                    <tr className="logs-table-head-row">
                      <th scope="col">No.</th>
                      <th scope="col">Action</th>
                      <th scope="col">Performed By</th>
                      <th scope="col">Role</th>
                      <th scope="col">Details</th>
                      <th scope="col">Timestamp</th>
                    </tr>
                  </thead>

                  <tbody key={tableAnimKey}>
                    {pageLogs.length === 0 ? (
                      <tr className="logs-table-state-row logs-table-state-row-empty" aria-hidden="true">
                        <td colSpan="6" className="logs-table-state-cell">&nbsp;</td>
                      </tr>
                    ) : (
                      pageLogs.map((log, index) => {
                        const meta  = LOG_TYPE_META[log.type] || { label: log.type, color: 'neutral' }
                        const rowNo = pageStart + index + 1

                        return (
                          <tr
                            key={log.id}
                            className="logs-table-body-row logs-table-body-row-reveal"
                            style={{ '--logs-row-delay': `${index * 28}ms` }}
                          >
                            <td><span className="logs-cell-text">{rowNo}</span></td>
                            <td>
                              <span className={`logs-action-badge logs-action-badge-${meta.color}`}>
                                {meta.label}
                              </span>
                            </td>
                            <td>
                              <div className="logs-actor-cell">
                                <span className="logs-actor-name">{log.actorName}</span>
                                {log.actorEmail && (
                                  <span className="logs-actor-email">{log.actorEmail}</span>
                                )}
                              </div>
                            </td>
                            <td>
                              <span className="logs-cell-text logs-role-text">{log.actorRole || '—'}</span>
                            </td>
                            <td>
                              <span className="logs-cell-text logs-detail-text">
                                {log.detail}
                                {log.deviceId && (
                                  <span className="logs-device-id"> ({log.deviceId})</span>
                                )}
                              </span>
                            </td>
                            <td>
                              <span className="logs-cell-text logs-timestamp-text">
                                {formatTimestamp(log.timestamp)}
                              </span>
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>

                {pageLogs.length === 0 && (
                  <div className="logs-table-empty-state" aria-live="polite">
                    {allLogs.length === 0
                      ? 'No activity has been recorded yet.'
                      : 'No logs match your current filters.'}
                  </div>
                )}
              </div>

              {/* Pagination remains the same */}
              <div className="logs-pagination-shell">
                <div className="logs-pagination">
                  <div className="logs-pagination-group logs-pagination-group-start">
                    <button
                      type="button"
                      className="logs-pagination-button logs-pagination-button-with-icon logs-pagination-button-start"
                      onClick={() => { setCurrentPage(1); setTableAnimKey((k) => k + 1) }}
                      disabled={safePage === 1}
                      aria-label="First page"
                    >
                      <span className="logs-pagination-button-icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M11 17l-5-5 5-5" /><path d="M18 17l-5-5 5-5" />
                        </svg>
                      </span>
                      <span>First</span>
                    </button>

                    <button
                      type="button"
                      className="logs-pagination-button logs-pagination-button-with-icon logs-pagination-button-start"
                      onClick={() => { setCurrentPage((p) => Math.max(1, p - 1)); setTableAnimKey((k) => k + 1) }}
                      disabled={safePage === 1}
                      aria-label="Previous page"
                    >
                      <span className="logs-pagination-button-icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M15 18l-6-6 6-6" />
                        </svg>
                      </span>
                      <span>Prev</span>
                    </button>
                  </div>

                  <div className="logs-pagination-group logs-pagination-group-center">
                    {paginationItems.map((item) =>
                      typeof item === 'string' ? (
                        <span key={item} className="logs-pagination-ellipsis">…</span>
                      ) : (
                        <button
                          key={item}
                          type="button"
                          className={`logs-pagination-button logs-pagination-number ${item === safePage ? 'active' : ''}`}
                          onClick={() => { setCurrentPage(item); setTableAnimKey((k) => k + 1) }}
                          aria-current={item === safePage ? 'page' : undefined}
                          aria-label={`Page ${item}`}
                        >
                          {item}
                        </button>
                      )
                    )}
                  </div>

                  <div className="logs-pagination-group logs-pagination-group-end">
                    <button
                      type="button"
                      className="logs-pagination-button logs-pagination-button-with-icon logs-pagination-button-end"
                      onClick={() => { setCurrentPage((p) => Math.min(totalPages, p + 1)); setTableAnimKey((k) => k + 1) }}
                      disabled={safePage === totalPages}
                      aria-label="Next page"
                    >
                      <span>Next</span>
                      <span className="logs-pagination-button-icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M9 18l6-6-6-6" />
                        </svg>
                      </span>
                    </button>

                    <button
                      type="button"
                      className="logs-pagination-button logs-pagination-button-with-icon logs-pagination-button-end"
                      onClick={() => { setCurrentPage(totalPages); setTableAnimKey((k) => k + 1) }}
                      disabled={safePage === totalPages}
                      aria-label="Last page"
                    >
                      <span>Last</span>
                      <span className="logs-pagination-button-icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M13 17l5-5-5-5" /><path d="M6 17l5-5-5-5" />
                        </svg>
                      </span>
                    </button>

                    <span className="logs-pagination-info">
                      Rows: {totalCount}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </section>
    </main>
  )
}

// Helper functions used in the component
const getLogsPaginationItems = (currentPage, totalPages) => {
  if (totalPages <= 1) return [1]

  const pages = new Set([1, totalPages])

  if (totalPages <= LOGS_VISIBLE_PAGE_BUTTONS + 2) {
    for (let p = 1; p <= totalPages; p++) pages.add(p)
  } else if (currentPage <= 3) {
    for (let p = 1; p <= Math.min(totalPages, LOGS_VISIBLE_PAGE_BUTTONS); p++) pages.add(p)
  } else if (currentPage >= totalPages - 2) {
    for (let p = Math.max(1, totalPages - LOGS_VISIBLE_PAGE_BUTTONS + 1); p <= totalPages; p++) pages.add(p)
  } else {
    for (let p = currentPage - 1; p <= currentPage + 1; p++) pages.add(p)
  }

  const sorted = [...pages].sort((a, b) => a - b)
  const items = []
  sorted.forEach((page, idx) => {
    const prev = sorted[idx - 1]
    if (idx > 0 && page - prev > 1) items.push(`ellipsis-${prev}-${page}`)
    items.push(page)
  })
  return items
}

const formatTimestamp = (iso) => {
  try {
    const date = new Date(iso)
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day:   'numeric',
      year:  'numeric',
      hour:  'numeric',
      minute:'2-digit',
      second:'2-digit',
      hour12: true,
    }).format(date)
  } catch {
    return iso
  }
}

export default Logs