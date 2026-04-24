import { useEffect, useState, useCallback } from 'react'
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
  SortIcon,
  TrashIcon,
  FirstPageIcon,
  PreviousPageIcon,
  NextPageIcon,
  LastPageIcon
} from '../Components/Icons.jsx'
import { fetchActivityLogs, clearActivityLogs } from '../Utils/activityLogsApi'

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

const ALL_ROLE_FILTER_OPTIONS = [
  { value: 'all', label: 'All Roles' },
  { value: 'Administrator', label: 'Administrator' },
  { value: 'User', label: 'User' },
]

const LOG_SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' }
]

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
  const selectedOption =
    options.find((option) => option.value === value) || options[0]

  return (
    <div className={`logs-filter-dropdown ${isOpen ? 'open' : ''}`}>
      <button
        type="button"
        id={id}
        className={`logs-filter-field logs-filter-dropdown-trigger ${isOpen ? 'logs-filter-dropdown-trigger-open' : ''}`}
        onClick={onToggle}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
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

      <div
        className={`logs-filter-dropdown-menu ${isOpen ? 'open' : ''}`}
        role="listbox"
        aria-labelledby={id}
      >
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className={`logs-filter-dropdown-option ${value === option.value ? 'active' : ''}`}
            onClick={() => onSelect(option.value)}
            role="option"
            aria-selected={value === option.value}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}

const getReportsPaginationItems = (currentPage, totalPages) => {
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

    if (Number.isNaN(date.getTime())) {
      return iso
    }

    const dateParts = new Intl.DateTimeFormat('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    }).formatToParts(date)

    const month = dateParts.find((part) => part.type === 'month')?.value || ''
    const day = dateParts.find((part) => part.type === 'day')?.value || ''
    const year = dateParts.find((part) => part.type === 'year')?.value || ''

    const timePart = new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    }).format(date)

    return `${month}, ${day}, ${year} | ${timePart}`
  } catch {
    return iso
  }
}

const Reports = ({ onLogout, onNavigate, isDarkMode, onThemeToggle }) => {
  const [isEntitiesOpen,    setIsEntitiesOpen]    = useState(false)
  const [isSidebarCollapsed,setIsSidebarCollapsed]= useState(false)
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false)

  const [allLogs, setAllLogs] = useState([])
  const [reportsPagination, setReportsPagination] = useState({
    page: 1,
    limit: LOGS_PER_PAGE,
    totalCount: 0,
    totalPages: 1,
    hasPreviousPage: false,
    hasNextPage: false,
  })
  const [reportsReloadKey, setReportsReloadKey] = useState(0)
  const [reportsRequestError, setReportsRequestError] = useState('')
  const [typeFilter,              setTypeFilter]              = useState('all')
  const [roleFilter,              setRoleFilter]              = useState('all')
  const [sortBy,                  setSortBy]                  = useState('newest')
  const [searchInput,             setSearchInput]             = useState('')
  const [appliedSearch,           setAppliedSearch]           = useState('')
  const [currentPage,             setCurrentPage]             = useState(1)
  const [openReportsFilterDropdown,  setOpenReportsFilterDropdown]  = useState('')
  const [tableAnimKey,            setTableAnimKey]            = useState(0)
  const [isReportsLoading,    setIsReportsLoading]     = useState(true)
  const [reportsTableLoadingTitle, setReportsTableLoadingTitle] = useState('Loading Reports')
  const [isReportsTableTransitioning, setIsReportsTableTransitioning] = useState(true)
  const [hasReportsLoadedOnce, setHasReportsLoadedOnce] = useState(false)

  const user = getCurrentUserProfile()
  const isAdministrator = isAdministratorRole(user.roleLabel)
  const sidebarProfileImagePreview = buildApiAssetUrl(user.profilePictureUrl)
  const sidebarUserInitials =
    [user.firstName, user.lastName]
      .filter(Boolean)
      .map((v) => String(v).trim().charAt(0).toUpperCase())
      .join('')
      .slice(0, 2) || 'A'

  const startReportsTableTransition = useCallback((title = 'Loading Reports') => {
    setReportsTableLoadingTitle(title)
    setIsReportsLoading(true)
    setIsReportsTableTransitioning(true)
    setTableAnimKey((k) => k + 1)
  }, [])

  const resetToFirstPage = useCallback((title = 'Loading Reports') => {
    startReportsTableTransition(title)
    setCurrentPage(1)
  }, [startReportsTableTransition])

  useEffect(() => {
    document.title = 'Avinya | Reports'

    const handleOutsideClick = (event) => {
      if (!(event.target instanceof Element)) return
      if (!event.target.closest('.dashboard-sidebar-user-group')) setIsProfileMenuOpen(false)
      if (!event.target.closest('.logs-filter-dropdown')) setOpenReportsFilterDropdown('')
    }

    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [])

  useEffect(() => {
    if (!isAdministrator) onNavigate('dashboard')
  }, [isAdministrator, onNavigate])

  useEffect(() => {
    let isMounted = true

    const loadReportsFromServer = async () => {
      try {
        setReportsRequestError('')

        const [data] = await Promise.all([
          fetchActivityLogs({
            page: currentPage,
            limit: LOGS_PER_PAGE,
            actionType: typeFilter,
            role: roleFilter,
            sortBy,
            search: appliedSearch,
          }),
          new Promise((resolve) => window.setTimeout(resolve, 420)),
        ])

        if (!isMounted) return

        setAllLogs(Array.isArray(data.logs) ? data.logs : [])
        setReportsPagination(
          data.pagination || {
            page: 1,
            limit: LOGS_PER_PAGE,
            totalCount: 0,
            totalPages: 1,
            hasPreviousPage: false,
            hasNextPage: false,
          }
        )
      } catch (error) {
        if (!isMounted) return

        setAllLogs([])
        setReportsPagination({
          page: 1,
          limit: LOGS_PER_PAGE,
          totalCount: 0,
          totalPages: 1,
          hasPreviousPage: false,
          hasNextPage: false,
        })
        setReportsRequestError(
          error instanceof TypeError || error.message === 'Failed to fetch'
            ? 'Unable to connect to the server. Please check your internet connection and try again.'
            : error.message || 'Unable to load reports right now.'
        )
      } finally {
        if (!isMounted) return

        setIsReportsLoading(false)
        setIsReportsTableTransitioning(false)
        setHasReportsLoadedOnce(true)
      }
    }

    void loadReportsFromServer()

    return () => {
      isMounted = false
    }
  }, [appliedSearch, currentPage, reportsReloadKey, roleFilter, sortBy, typeFilter])

  useEffect(() => {
    const handleWindowFocus = () => {
      startReportsTableTransition('Refreshing Reports')
      setReportsReloadKey((prev) => prev + 1)
    }

    window.addEventListener('focus', handleWindowFocus)
    return () => window.removeEventListener('focus', handleWindowFocus)
  }, [startReportsTableTransition])

  const roleFilterOptions = ALL_ROLE_FILTER_OPTIONS

  const totalCount = Number(reportsPagination.totalCount || 0)
  const totalPages = Math.max(1, Number(reportsPagination.totalPages || 1))
  const safePage = Math.max(1, Number(reportsPagination.page || 1))
  const pageStart = (safePage - 1) * Number(reportsPagination.limit || LOGS_PER_PAGE)
  const pageLogs = allLogs
  const paginationItems = getReportsPaginationItems(safePage, totalPages)

  const isReportsToolbarDisabled = isReportsLoading
  const isReportsSearchDisabled =
    isReportsLoading ||
    (searchInput.trim().length === 0 && appliedSearch.length === 0)

  const handleReportsPageChange = (nextPage) => {
    if (isReportsLoading) {
      return
    }

    if (nextPage < 1 || nextPage > totalPages || nextPage === safePage) {
      return
    }

    startReportsTableTransition('Loading Reports')
    setCurrentPage(nextPage)
  }

  const handleReportsFilterDropdownToggle = (dropdownName) => {
    setIsProfileMenuOpen(false)
    setOpenReportsFilterDropdown((prev) => (prev === dropdownName ? '' : dropdownName))
  }

  const handleTypeFilterChange = (value) => {
    if (value === typeFilter) {
      setOpenReportsFilterDropdown('')
      return
    }

    setTypeFilter(value)
    setOpenReportsFilterDropdown('')
    resetToFirstPage('Filtering Reports')
  }

  const handleRoleFilterChange = (value) => {
    if (value === roleFilter) {
      setOpenReportsFilterDropdown('')
      return
    }

    setRoleFilter(value)
    setOpenReportsFilterDropdown('')
    resetToFirstPage('Filtering Reports')
  }

  const handleSortByChange = (value) => {
    if (value === sortBy) {
      setOpenReportsFilterDropdown('')
      return
    }

    setSortBy(value)
    setOpenReportsFilterDropdown('')
    resetToFirstPage('Sorting Reports')
  }

  const handleSearchSubmit = (e) => {
    e.preventDefault()

    const nextSearchValue = searchInput.trim()

    if (nextSearchValue === appliedSearch) {
      if (currentPage !== 1) {
        startReportsTableTransition('Searching Reports')
        setCurrentPage(1)
      }
      return
    }

    startReportsTableTransition('Searching Reports')
    setAppliedSearch(nextSearchValue)
    setCurrentPage(1)
  }

  const handleSearchInputChange = (e) => {
    setSearchInput(e.target.value)
  }

  const handleClearLogs = async () => {
    const result = await Swal.fire({
      title: 'Clear All Reports?',
      text: 'This will permanently delete all activity logs. This cannot be undone.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Yes',
      cancelButtonText: 'No',
      reverseButtons: true,
      buttonsStyling: false,
      allowOutsideClick: true,
      allowEscapeKey: true,
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

    startReportsTableTransition('Clearing Reports')

    try {
      await Promise.all([
        clearActivityLogs(),
        new Promise((resolve) => window.setTimeout(resolve, 420)),
      ])

      setAllLogs([])
      setReportsPagination({
        page: 1,
        limit: LOGS_PER_PAGE,
        totalCount: 0,
        totalPages: 1,
        hasPreviousPage: false,
        hasNextPage: false,
      })
      setTypeFilter('all')
      setRoleFilter('all')
      setSortBy('newest')
      setSearchInput('')
      setAppliedSearch('')
      setCurrentPage(1)
      setReportsRequestError('')
      setTableAnimKey((k) => k + 1)
    } catch (error) {
      console.error('CLEAR LOGS ERROR:', error)

      setReportsRequestError(
        error instanceof TypeError || error.message === 'Failed to fetch'
          ? 'Unable to connect to the server. Please check your internet connection and try again.'
          : error.message || 'Unable to clear reports right now.'
      )
    } finally {
      setIsReportsLoading(false)
      setIsReportsTableTransitioning(false)
      setHasReportsLoadedOnce(true)
    }
  }

  const areFiltersAtDefault =
    typeFilter === 'all' &&
    roleFilter === 'all' &&
    sortBy === 'newest' &&
    !appliedSearch &&
    !searchInput

  const logsEmptyStateMessage =
    reportsRequestError ||
    (appliedSearch || typeFilter !== 'all' || roleFilter !== 'all'
      ? 'No matching reports found.'
      : 'No reports found.')

  const handleResetFilters = () => {
    if (areFiltersAtDefault) {
      return
    }

    setTypeFilter('all')
    setRoleFilter('all')
    setSortBy('newest')
    setSearchInput('')
    setAppliedSearch('')
    setOpenReportsFilterDropdown('')
    resetToFirstPage('Filtering Reports')
  }

  // ── Export helpers ──────────────────────────────────────────────────────────

  const buildExportRows = (logs) =>
    logs.map((log, index) => {
      const meta = LOG_TYPE_META[log.type] || { label: log.type }
      return {
        no:        index + 1,
        action:    meta.label,
        performer: log.actorName + (log.actorEmail ? ` <${log.actorEmail}>` : ''),
        role:      log.actorRole || '—',
        detail:    log.detail,
        timestamp: formatTimestamp(log.timestamp),
      }
    })

  const handleExportCSV = () => {
    const rows  = buildExportRows(allLogs)
    const header = ['No.', 'Action', 'Performed By', 'Role', 'Details', 'Timestamp']
    const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const csvContent = [
      header.map(escape).join(','),
      ...rows.map((r) =>
        [r.no, r.action, r.performer, r.role, r.detail, r.timestamp].map(escape).join(',')
      ),
    ].join('\r\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `activity-logs-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleExportPDF = async () => {
    const { jsPDF } = await import('jspdf')
    const autoTable  = (await import('jspdf-autotable')).default

    const doc  = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
    const rows = buildExportRows(allLogs)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(16)
    doc.text('Activity Reports', 40, 40)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(150)
    doc.text(
      `Exported on ${new Date().toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' })}  ·  ${rows.length} record${rows.length !== 1 ? 's' : ''}`,
      40,
      58
    )

    autoTable(doc, {
      startY: 72,
      head: [['No.', 'Action', 'Performed By', 'Role', 'Details', 'Timestamp']],
      body: rows.map((r) => [r.no, r.action, r.performer, r.role, r.detail, r.timestamp]),
      styles: { fontSize: 8, cellPadding: 5, overflow: 'linebreak' },
      headStyles: { fillColor: [152, 0, 0], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [250, 250, 250] },
      columnStyles: {
        0: { cellWidth: 30 },
        1: { cellWidth: 70 },
        2: { cellWidth: 130 },
        3: { cellWidth: 70 },
        4: { cellWidth: 'auto' },
        5: { cellWidth: 130 },
      },
    })

    doc.save(`activity-logs-${new Date().toISOString().slice(0, 10)}.pdf`)
  }

  const closeDropdowns = () => {
    setIsEntitiesOpen(false)
    setIsProfileMenuOpen(false)
    setOpenReportsFilterDropdown('')
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
                  aria-label={isProfileMenuOpen ? 'Close profile menu' : 'Open profile menu'}
                  aria-expanded={isProfileMenuOpen}
                  onClick={handleProfileMenuToggle}
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
            <h1 id="reports-page-title" className="dashboard-content-title">Reports</h1>
          </div>

          <section className="logs-panel" aria-labelledby="reports-page-title">

            <div className="logs-panel-toolbar">
              <div className="logs-toolbar-top">
                <div className="logs-filters-group">
                  <ReportsFilterDropdown
                    id="logs-type-filter"
                    label="Action Type"
                    icon={<FilterIcon />}
                    value={typeFilter}
                    options={ALL_LOG_TYPE_FILTER_OPTIONS}
                    isOpen={openReportsFilterDropdown === 'type'}
                    onToggle={() => handleReportsFilterDropdownToggle('type')}
                    onSelect={handleTypeFilterChange}
                    disabled={isReportsToolbarDisabled}
                  />

                  <ReportsFilterDropdown
                    id="logs-role-filter"
                    label="Role"
                    icon={<FilterIcon />}
                    value={roleFilter}
                    options={roleFilterOptions}
                    isOpen={openReportsFilterDropdown === 'role'}
                    onToggle={() => handleReportsFilterDropdownToggle('role')}
                    onSelect={handleRoleFilterChange}
                    disabled={isReportsToolbarDisabled}
                  />

                  <ReportsFilterDropdown
                    id="logs-sort-filter"
                    label="Sort By"
                    icon={<SortIcon />}
                    value={sortBy}
                    options={LOG_SORT_OPTIONS}
                    isOpen={openReportsFilterDropdown === 'sort'}
                    onToggle={() => handleReportsFilterDropdownToggle('sort')}
                    onSelect={handleSortByChange}
                    disabled={isReportsToolbarDisabled}
                  />
                </div>

                <div className="logs-toolbar-actions">
                  <button
                    type="button"
                    className="logs-filter-reset-button"
                    onClick={handleResetFilters}
                    disabled={isReportsToolbarDisabled || areFiltersAtDefault}
                  >
                    Reset Filters
                  </button>

                  <button
                    type="button"
                    className="logs-export-button"
                    onClick={handleExportCSV}
                    disabled={isReportsToolbarDisabled || allLogs.length === 0}
                    title="Export as CSV"
                  >
                    <span className="logs-export-button-icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                        <line x1="12" y1="12" x2="12" y2="18" />
                        <polyline points="9 15 12 18 15 15" />
                      </svg>
                    </span>
                    <span>CSV</span>
                  </button>

                  <button
                    type="button"
                    className="logs-export-button"
                    onClick={handleExportPDF}
                    disabled={isReportsToolbarDisabled || allLogs.length === 0}
                    title="Export as PDF"
                  >
                    <span className="logs-export-button-icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                        <line x1="9" y1="13" x2="15" y2="13" />
                        <line x1="9" y1="17" x2="15" y2="17" />
                        <polyline points="9 9 10 9 10 9" />
                      </svg>
                    </span>
                    <span>PDF</span>
                  </button>

                  <button
                    type="button"
                    className="logs-clear-button"
                    onClick={handleClearLogs}
                    disabled={isReportsToolbarDisabled || allLogs.length === 0}
                  >
                    <span className="logs-clear-button-icon" aria-hidden="true">
                      <TrashIcon />
                    </span>
                    <span>Clear All</span>
                  </button>
                </div>
              </div>

              <form className="logs-search-form" onSubmit={handleSearchSubmit} role="search" aria-label="Search reports">
                <div className="logs-search-field">
                  <span className="logs-search-input-icon" aria-hidden="true">
                    <SearchIcon />
                  </span>
                  <div className="logs-search-floating-control">
                    <input
                      id="reports-search-input"
                      type="search"
                      className="logs-search-input logs-search-floating-input"
                      placeholder=" "
                      value={searchInput}
                      onChange={handleSearchInputChange}
                      aria-label="Search reports"
                      disabled={isReportsToolbarDisabled}
                    />
                    <label htmlFor="reports-search-input" className="logs-search-floating-label">Search</label>
                  </div>
                </div>

                <button type="submit" className="logs-search-button" disabled={isReportsSearchDisabled}>
                  <span className="logs-search-button-icon" aria-hidden="true">
                    <SearchIcon />
                  </span>
                  <span>Search</span>
                </button>
              </form>
            </div>

            <div className="logs-table-shell">
              {isReportsTableTransitioning && hasReportsLoadedOnce && (
                <div
                  className="logs-table-loading-overlay"
                  role="status"
                  aria-live="polite"
                  aria-busy="true"
                >
                  <div className="logs-table-loading-card">
                    <img src={logo} alt="Avinya Logo" className="logs-table-loading-logo" />
                    <p className="logs-table-loading-title">{reportsTableLoadingTitle}</p>
                    <div className="logs-table-loading-loader" aria-hidden="true">
                      <span className="logs-table-loading-loader-bar"></span>
                    </div>
                  </div>
                </div>
              )}

              <div
                className={`logs-table-scroll ${pageLogs.length === 0 ? 'logs-table-scroll-empty' : ''}`}
                role="region"
                aria-label="Activity reports table"
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
                    {logsEmptyStateMessage}
                  </div>
                )}
              </div>

              <div className="logs-pagination-shell">
                <div className="logs-pagination">
                  <div className="logs-pagination-group logs-pagination-group-start">
                    <button
                      type="button"
                      className="logs-pagination-button logs-pagination-button-with-icon logs-pagination-button-start"
                      onClick={() => handleReportsPageChange(1)}
                      disabled={safePage === 1 || isReportsLoading}
                      aria-label="First page"
                    >
                      <span className="logs-pagination-button-icon" aria-hidden="true">
                        <FirstPageIcon />
                      </span>
                      <span>First</span>
                    </button>

                    <button
                      type="button"
                      className="logs-pagination-button logs-pagination-button-with-icon logs-pagination-button-start"
                      onClick={() => handleReportsPageChange(safePage - 1)}
                      disabled={safePage === 1 || isReportsLoading}
                      aria-label="Previous page"
                    >
                      <span className="logs-pagination-button-icon" aria-hidden="true">
                        <PreviousPageIcon />
                      </span>
                      <span>Back</span>
                    </button>
                  </div>

                  <div className="logs-pagination-group logs-pagination-group-center">
                    {paginationItems.map((item) =>
                      typeof item === 'string' ? (
                        <span key={item} className="logs-pagination-ellipsis">...</span>
                      ) : (
                        <button
                          key={item}
                          type="button"
                          className={`logs-pagination-button logs-pagination-number ${item === safePage ? 'active' : ''}`}
                          onClick={() => handleReportsPageChange(item)}
                          disabled={item === safePage || isReportsLoading}
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
                      onClick={() => handleReportsPageChange(safePage + 1)}
                      disabled={safePage === totalPages || isReportsLoading}
                      aria-label="Next page"
                    >
                      <span>Next</span>
                      <span className="logs-pagination-button-icon" aria-hidden="true">
                        <NextPageIcon />
                      </span>
                    </button>

                    <button
                      type="button"
                      className="logs-pagination-button logs-pagination-button-with-icon logs-pagination-button-end"
                      onClick={() => handleReportsPageChange(totalPages)}
                      disabled={safePage === totalPages || isReportsLoading}
                      aria-label="Last page"
                    >
                      <span>Last</span>
                      <span className="logs-pagination-button-icon" aria-hidden="true">
                        <LastPageIcon />
                      </span>
                    </button>
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

export default Reports