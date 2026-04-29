import { useEffect, useState, useCallback } from 'react'
import Swal from 'sweetalert2'
import 'sweetalert2/dist/sweetalert2.min.css'
import logo from '../Pictures/Avinya.png'
import '../Styles/Logs.css'
import { getCurrentUserProfile, isAdministratorRole } from '../Utils/getCurrentUserProfile'
import { performReliableLogout } from '../Utils/performReliableLogout'
import { API_URL, buildApiAssetUrl } from '../Config/API'
import {
  ProfileMenuIcon,
  SearchIcon,
  FilterIcon,
  SortIcon,
  TrashIcon,
  DownloadIcon,
  FirstPageIcon,
  PreviousPageIcon,
  NextPageIcon,
  LastPageIcon
} from '../Components/Icons.jsx'
import { getStoredAuthToken } from '../Utils/authStorage'
import { fetchActivityLogs, clearActivityLogs } from '../Utils/activityLogsApi'

const ACCOUNT_MODAL_TRANSITION_MS = 280
const LOGS_PER_PAGE = 15
const LOGS_VISIBLE_PAGE_BUTTONS = 5

const getLogsFilterOptionLabel = (options, value, fallback) =>
  options.find((option) => option.value === value)?.label || fallback

const getLogsExportQueryParams = ({
  actionType,
  role,
  sortBy,
  search
}) => {
  const params = new URLSearchParams()

  if (actionType && actionType !== 'all') params.set('actionType', actionType)
  if (role && role !== 'all') params.set('role', role)
  if (sortBy) params.set('sortBy', sortBy)
  if (search) params.set('search', String(search).trim())

  return params
}

const getReadableLogsPdfDate = (date = new Date()) =>
  new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  }).format(date)

const getDefaultLogsPdfFileName = (date = new Date()) =>
  `Avinya Logs - ${getReadableLogsPdfDate(date)}.pdf`

const getLogsPdfFileNameFromResponse = (response) => {
  const contentDisposition = response.headers.get('content-disposition') || ''
  const match = contentDisposition.match(/filename="?([^"]+)"?/i)

  return match?.[1] || getDefaultLogsPdfFileName()
}

export const LOG_TYPES = {
  LOGIN:          'login',
  LOGOUT:         'logout',
  DEVICE_ADDED:   'device_added',
  DEVICE_UPDATED: 'device_updated',
  DEVICE_REMOVED: 'device_removed',
}

const LOG_TYPE_META = {
  [LOG_TYPES.LOGIN]:          { label: 'Login',          color: 'success' },
  [LOG_TYPES.LOGOUT]:         { label: 'Logout',         color: 'neutral' },
  [LOG_TYPES.DEVICE_ADDED]:   { label: 'Device Added',   color: 'info'    },
  [LOG_TYPES.DEVICE_UPDATED]: { label: 'Device Updated', color: 'warning' },
  [LOG_TYPES.DEVICE_REMOVED]: { label: 'Device Removed', color: 'danger'  },
}

const ALL_LOG_TYPE_FILTER_OPTIONS = [
  { value: 'all',                    label: 'All Actions'    },
  { value: LOG_TYPES.LOGIN,          label: 'Login'          },
  { value: LOG_TYPES.LOGOUT,         label: 'Logout'         },
  { value: LOG_TYPES.DEVICE_ADDED,   label: 'Device Added'   },
  { value: LOG_TYPES.DEVICE_UPDATED, label: 'Device Updated' },
  { value: LOG_TYPES.DEVICE_REMOVED, label: 'Device Removed' },
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

const LogsFilterDropdown = ({
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

const Logs = ({ onLogout, onNavigate, isDarkMode, onThemeToggle }) => {
  const [isEntitiesOpen,    setIsEntitiesOpen]    = useState(false)
  const [isSidebarCollapsed,setIsSidebarCollapsed]= useState(false)
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false)

  const [allLogs, setAllLogs] = useState([])
  const [logsPagination, setLogsPagination] = useState({
    page: 1,
    limit: LOGS_PER_PAGE,
    totalCount: 0,
    totalPages: 1,
    hasPreviousPage: false,
    hasNextPage: false,
  })
  const [logsReloadKey, setLogsReloadKey] = useState(0)
  const [logsRequestError, setLogsRequestError] = useState('')
  const [typeFilter,              setTypeFilter]              = useState('all')
  const [roleFilter,              setRoleFilter]              = useState('all')
  const [sortBy,                  setSortBy]                  = useState('newest')
  const [searchInput,             setSearchInput]             = useState('')
  const [appliedSearch,           setAppliedSearch]           = useState('')
  const [currentPage,             setCurrentPage]             = useState(1)
  const [openLogsFilterDropdown,  setOpenLogsFilterDropdown]  = useState('')
  const [tableAnimKey,            setTableAnimKey]            = useState(0)
  const [isLogsLoading, setIsLogsLoading] = useState(true)
  const [logsTableLoadingTitle, setLogsTableLoadingTitle] = useState('Loading Logs')
  const [isLogsTableTransitioning, setIsLogsTableTransitioning] = useState(true)
  const [hasLogsLoadedOnce, setHasLogsLoadedOnce] = useState(false)

  const [isPreparingLogsPdfPreview, setIsPreparingLogsPdfPreview] = useState(false)
  const [isLogsPdfPreviewModalOpen, setIsLogsPdfPreviewModalOpen] = useState(false)
  const [isLogsPdfPreviewModalClosing, setIsLogsPdfPreviewModalClosing] = useState(false)
  const [logsPdfPreviewUrl, setLogsPdfPreviewUrl] = useState('')
  const [logsPdfFileName, setLogsPdfFileName] = useState('')
  const [isDownloadingLogsPdf, setIsDownloadingLogsPdf] = useState(false)

  const user = getCurrentUserProfile()
  const isAdministrator = isAdministratorRole(user.roleLabel)
  const sidebarProfileImagePreview = buildApiAssetUrl(user.profilePictureUrl)
  const sidebarUserInitials =
    [user.firstName, user.lastName]
      .filter(Boolean)
      .map((v) => String(v).trim().charAt(0).toUpperCase())
      .join('')
      .slice(0, 2) || 'A'

  const startLogsTableTransition = useCallback((title = 'Loading Logs') => {
    setLogsTableLoadingTitle(title)
    setIsLogsLoading(true)
    setIsLogsTableTransitioning(true)
    setTableAnimKey((k) => k + 1)
  }, [])

  const resetToFirstPage = useCallback((title = 'Loading Logs') => {
    startLogsTableTransition(title)
    setCurrentPage(1)
  }, [startLogsTableTransition])

  useEffect(() => {
    document.title = 'Avinya | Logs'

    const handleOutsideClick = (event) => {
      if (!(event.target instanceof Element)) return
      if (!event.target.closest('.dashboard-sidebar-user-group')) setIsProfileMenuOpen(false)
      if (!event.target.closest('.logs-filter-dropdown')) setOpenLogsFilterDropdown('')
    }

    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [])

  useEffect(() => {
    return () => {
      if (logsPdfPreviewUrl) {
        URL.revokeObjectURL(logsPdfPreviewUrl)
      }
    }
  }, [logsPdfPreviewUrl])

  useEffect(() => {
    if (!isAdministrator) onNavigate('dashboard')
  }, [isAdministrator, onNavigate])

  useEffect(() => {
    let isMounted = true

    const loadLogsFromServer = async () => {
      try {
        setLogsRequestError('')

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
        setLogsPagination(
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
        setLogsPagination({
          page: 1,
          limit: LOGS_PER_PAGE,
          totalCount: 0,
          totalPages: 1,
          hasPreviousPage: false,
          hasNextPage: false,
        })
        setLogsRequestError(
          error instanceof TypeError || error.message === 'Failed to fetch'
            ? 'Unable to connect to the server. Please check your internet connection and try again.'
            : error.message || 'Unable to load logs right now.'
        )
      } finally {
        if (!isMounted) return

        setIsLogsLoading(false)
        setIsLogsTableTransitioning(false)
        setHasLogsLoadedOnce(true)
      }
    }

    void loadLogsFromServer()

    return () => {
      isMounted = false
    }
  }, [appliedSearch, currentPage, logsReloadKey, roleFilter, sortBy, typeFilter])

  const roleFilterOptions = ALL_ROLE_FILTER_OPTIONS

  const totalCount = Number(logsPagination.totalCount || 0)
  const totalPages = Math.max(1, Number(logsPagination.totalPages || 1))
  const safePage = Math.max(1, Number(logsPagination.page || 1))
  const pageStart = (safePage - 1) * Number(logsPagination.limit || LOGS_PER_PAGE)
  const pageLogs = allLogs
  const paginationItems = getLogsPaginationItems(safePage, totalPages)

  const shouldShowLogsPagination =
    !isLogsLoading &&
    !logsRequestError

  const logsFillerRowsCount =
    !logsRequestError && pageLogs.length > 0
      ? Math.max(LOGS_PER_PAGE - pageLogs.length, 0)
      : 0

  const logsFillerRows = Array.from(
    { length: logsFillerRowsCount },
    (_, index) => index
  )

  const isLogsToolbarDisabled =
    isLogsLoading || isPreparingLogsPdfPreview || isDownloadingLogsPdf

  const isLogsSearchDisabled =
    isLogsToolbarDisabled ||
    (searchInput.trim().length === 0 && appliedSearch.length === 0)

  const logsPdfPreviewTags = [
    `Search: ${appliedSearch || 'All logs'}`,
    `Action Type: ${getLogsFilterOptionLabel(ALL_LOG_TYPE_FILTER_OPTIONS, typeFilter, 'All Actions')}`,
    `Role: ${getLogsFilterOptionLabel(roleFilterOptions, roleFilter, 'All Roles')}`,
    `Sort: ${getLogsFilterOptionLabel(LOG_SORT_OPTIONS, sortBy, 'Newest')}`,
    `Rows: ${totalCount}`
  ]

  const handleLogsPageChange = (nextPage) => {
    if (isLogsLoading) {
      return
    }

    if (nextPage < 1 || nextPage > totalPages || nextPage === safePage) {
      return
    }

    startLogsTableTransition('Loading Logs')
    setCurrentPage(nextPage)
  }

  const handleLogsFilterDropdownToggle = (dropdownName) => {
    setIsProfileMenuOpen(false)
    setOpenLogsFilterDropdown((prev) => (prev === dropdownName ? '' : dropdownName))
  }

  const handleTypeFilterChange = (value) => {
    if (value === typeFilter) {
      setOpenLogsFilterDropdown('')
      return
    }

    setTypeFilter(value)
    setOpenLogsFilterDropdown('')
    resetToFirstPage('Filtering Logs')
  }

  const handleRoleFilterChange = (value) => {
    if (value === roleFilter) {
      setOpenLogsFilterDropdown('')
      return
    }

    setRoleFilter(value)
    setOpenLogsFilterDropdown('')
    resetToFirstPage('Filtering Logs')
  }

  const handleSortByChange = (value) => {
    if (value === sortBy) {
      setOpenLogsFilterDropdown('')
      return
    }

    setSortBy(value)
    setOpenLogsFilterDropdown('')
    resetToFirstPage('Sorting Logs')
  }

  const handleSearchSubmit = (e) => {
    e.preventDefault()

    const nextSearchValue = searchInput.trim()

    if (nextSearchValue === appliedSearch) {
      if (currentPage !== 1) {
        startLogsTableTransition('Searching Logs')
        setCurrentPage(1)
      }
      return
    }

    startLogsTableTransition('Searching Logs')
    setAppliedSearch(nextSearchValue)
    setCurrentPage(1)
  }

  const handleSearchInputChange = (e) => {
    setSearchInput(e.target.value)
  }

  const resetLogsPdfPreviewState = () => {
    if (logsPdfPreviewUrl) {
      URL.revokeObjectURL(logsPdfPreviewUrl)
    }

    setIsLogsPdfPreviewModalOpen(false)
    setIsLogsPdfPreviewModalClosing(false)
    setLogsPdfPreviewUrl('')
    setLogsPdfFileName('')
    setIsPreparingLogsPdfPreview(false)
    setIsDownloadingLogsPdf(false)
  }

  const handleOpenLogsPdfPreview = async () => {
    const authToken = getStoredAuthToken()

    if (!authToken) {
      closeDropdowns()
      onLogout()
      return
    }

    try {
      closeDropdowns()
      setIsPreparingLogsPdfPreview(true)

      const logsExportQueryParams = getLogsExportQueryParams({
        actionType: typeFilter,
        role: roleFilter,
        sortBy,
        search: appliedSearch
      })

      const response = await fetch(`${API_URL}/logs/export/pdf?${logsExportQueryParams.toString()}`, {
        method: 'GET',
        headers: {
          Accept: 'application/pdf',
          Authorization: `Bearer ${authToken}`
        }
      })

      if (!response.ok) {
        const errorData = response.headers.get('content-type')?.includes('application/json')
          ? await response.json().catch(() => ({}))
          : {}

        throw new Error(errorData.message || 'Unable to generate the PDF file right now.')
      }

      const pdfBlob = await response.blob()
      const nextPreviewUrl = URL.createObjectURL(pdfBlob)

      if (logsPdfPreviewUrl) {
        URL.revokeObjectURL(logsPdfPreviewUrl)
      }

      setLogsPdfPreviewUrl(nextPreviewUrl)
      setLogsPdfFileName(getLogsPdfFileNameFromResponse(response))
      setIsLogsPdfPreviewModalOpen(true)
    } catch (error) {
      await showLogsStatusAlert({
        type: 'error',
        title: 'PDF Preview Unavailable',
        message: error.message || 'Unable to generate the PDF file right now.'
      })
    } finally {
      setIsPreparingLogsPdfPreview(false)
    }
  }

  const handleCloseLogsPdfPreviewModal = async () => {
    if (isLogsPdfPreviewModalClosing || isDownloadingLogsPdf) {
      return
    }

    setIsLogsPdfPreviewModalClosing(true)

    await new Promise((resolve) => setTimeout(resolve, ACCOUNT_MODAL_TRANSITION_MS))

    resetLogsPdfPreviewState()
  }

  const handleDownloadLogsPdf = async () => {
    if (!logsPdfPreviewUrl) return

    try {
      setIsDownloadingLogsPdf(true)

      await new Promise((resolve) => setTimeout(resolve, 620))

      const downloadLink = document.createElement('a')
      downloadLink.href = logsPdfPreviewUrl
      downloadLink.download = logsPdfFileName || getDefaultLogsPdfFileName()
      downloadLink.rel = 'noopener'

      document.body.appendChild(downloadLink)
      downloadLink.click()
      downloadLink.remove()

      setIsDownloadingLogsPdf(false)
      await handleCloseLogsPdfPreviewModal()
    } catch (error) {
      setIsDownloadingLogsPdf(false)

      await showLogsStatusAlert({
        type: 'error',
        title: 'Download Failed',
        message: error.message || 'Unable to download the PDF file right now.'
      })
    }
  }

  const handleClearLogs = async () => {
    const result = await Swal.fire({
      title: 'Clear All Logs?',
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

    startLogsTableTransition('Clearing Logs')

    try {
      await Promise.all([
        clearActivityLogs(),
        new Promise((resolve) => window.setTimeout(resolve, 420)),
      ])

      setAllLogs([])
      setLogsPagination({
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
      setLogsRequestError('')
      setTableAnimKey((k) => k + 1)
    } catch (error) {
      console.error('CLEAR LOGS ERROR:', error)

      setLogsRequestError(
        error instanceof TypeError || error.message === 'Failed to fetch'
          ? 'Unable to connect to the server. Please check your internet connection and try again.'
          : error.message || 'Unable to clear logs right now.'
      )
    } finally {
      setIsLogsLoading(false)
      setIsLogsTableTransitioning(false)
      setHasLogsLoadedOnce(true)
    }
  }

  const areFiltersAtDefault =
    typeFilter === 'all' &&
    roleFilter === 'all' &&
    sortBy === 'newest' &&
    !appliedSearch &&
    !searchInput

  const logsEmptyStateMessage =
    logsRequestError ||
    (appliedSearch || typeFilter !== 'all' || roleFilter !== 'all'
      ? 'No matching logs found.'
      : 'No logs found.')

  const handleResetFilters = () => {
    if (areFiltersAtDefault) {
      return
    }

    setTypeFilter('all')
    setRoleFilter('all')
    setSortBy('newest')
    setSearchInput('')
    setAppliedSearch('')
    setOpenLogsFilterDropdown('')
    resetToFirstPage('Filtering Logs')
  }

  const closeDropdowns = () => {
    setIsEntitiesOpen(false)
    setIsProfileMenuOpen(false)
    setOpenLogsFilterDropdown('')
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

  const showLogsStatusAlert = async ({ type, title, message }) => {
    const isSuccess = type === 'success'

    await Swal.fire({
      html: `
        <div class="auth-swal-card">
          <div class="auth-swal-symbol ${isSuccess ? 'auth-swal-symbol-success' : 'auth-swal-symbol-error'}" aria-hidden="true">
            ${
              isSuccess
                ? `
                  <svg viewBox="0 0 24 24">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                `
                : `
                  <svg viewBox="0 0 24 24">
                    <path d="M15 9l-6 6" />
                    <path d="m9 9 6 6" />
                  </svg>
                `
            }
          </div>

          <h2 class="auth-swal-heading">${title}</h2>

          <p class="auth-swal-message">
            ${message}
          </p>
        </div>
      `,
      timer: 3500,
      showConfirmButton: false,
      showCancelButton: false,
      showCloseButton: false,
      buttonsStyling: false,
      allowOutsideClick: true,
      allowEscapeKey: true,
      customClass: {
        popup: 'auth-swal-popup',
        htmlContainer: 'auth-swal-html'
      }
    })
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
    <main className="dashboard-page logs-page">
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

            {isAdministrator && (
              <button type="button" className="dashboard-sidebar-link" data-tooltip="Reports" onClick={() => onNavigate('reports')}>
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
            <h1 id="logs-page-title" className="dashboard-content-title">Logs</h1>
          </div>

          <section className="logs-panel" aria-labelledby="logs-page-title">

            <div className="logs-panel-toolbar">
              <div className="logs-toolbar-top">
                <div className="logs-filters-group">
                  <LogsFilterDropdown
                    id="logs-type-filter"
                    label="Action Type"
                    icon={<FilterIcon />}
                    value={typeFilter}
                    options={ALL_LOG_TYPE_FILTER_OPTIONS}
                    isOpen={openLogsFilterDropdown === 'type'}
                    onToggle={() => handleLogsFilterDropdownToggle('type')}
                    onSelect={handleTypeFilterChange}
                    disabled={isLogsToolbarDisabled}
                  />

                  <LogsFilterDropdown
                    id="logs-role-filter"
                    label="Role"
                    icon={<FilterIcon />}
                    value={roleFilter}
                    options={roleFilterOptions}
                    isOpen={openLogsFilterDropdown === 'role'}
                    onToggle={() => handleLogsFilterDropdownToggle('role')}
                    onSelect={handleRoleFilterChange}
                    disabled={isLogsToolbarDisabled}
                  />

                  <LogsFilterDropdown
                    id="logs-sort-filter"
                    label="Sort By"
                    icon={<SortIcon />}
                    value={sortBy}
                    options={LOG_SORT_OPTIONS}
                    isOpen={openLogsFilterDropdown === 'sort'}
                    onToggle={() => handleLogsFilterDropdownToggle('sort')}
                    onSelect={handleSortByChange}
                    disabled={isLogsToolbarDisabled}
                  />
                </div>

                <div className="logs-toolbar-actions">
                  <button
                    type="button"
                    className="logs-filter-reset-button"
                    onClick={handleResetFilters}
                    disabled={isLogsToolbarDisabled || areFiltersAtDefault}
                  >
                    Reset Filters
                  </button>

                  <button
                    type="button"
                    className="logs-clear-button"
                    onClick={handleClearLogs}
                    disabled={isLogsToolbarDisabled || allLogs.length === 0}
                  >
                    <span className="logs-clear-button-icon" aria-hidden="true">
                      <TrashIcon />
                    </span>
                    <span>Clear All</span>
                  </button>

                  <button
                    type="button"
                    className="logs-export-button logs-export-button-toolbar"
                    onClick={handleOpenLogsPdfPreview}
                    disabled={isLogsToolbarDisabled}
                  >
                    <span className="logs-export-button-icon" aria-hidden="true">
                      <DownloadIcon />
                    </span>
                    <span>Export PDF</span>
                  </button>
                </div>
              </div>

              <form className="logs-search-form" onSubmit={handleSearchSubmit} role="search" aria-label="Search logs">
                <div className="logs-search-field">
                  <span className="logs-search-input-icon" aria-hidden="true">
                    <SearchIcon />
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
                      disabled={isLogsToolbarDisabled}
                    />
                    <label htmlFor="logs-search-input" className="logs-search-floating-label">Search</label>
                  </div>
                </div>

                <button type="submit" className="logs-search-button" disabled={isLogsSearchDisabled}>
                  <span className="logs-search-button-icon" aria-hidden="true">
                    <SearchIcon />
                  </span>
                  <span>Search</span>
                </button>
              </form>
            </div>

            <div className="logs-table-shell">
              {isLogsTableTransitioning && hasLogsLoadedOnce && (
                <div
                  className="logs-table-loading-overlay"
                  role="status"
                  aria-live="polite"
                  aria-busy="true"
                >
                  <div className="logs-table-loading-card">
                    <img src={logo} alt="Avinya Logo" className="logs-table-loading-logo" />
                    <p className="logs-table-loading-title">{logsTableLoadingTitle}</p>
                    <div className="logs-table-loading-loader" aria-hidden="true">
                      <span className="logs-table-loading-loader-bar"></span>
                    </div>
                  </div>
                </div>
              )}

              <div
                className={`logs-table-scroll ${
                  !isLogsLoading && !logsRequestError && pageLogs.length === 0
                    ? 'logs-table-scroll-empty'
                    : ''
                }`}
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
                    <>
                      {pageLogs.map((log, index) => {
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
                            })}

                          {logsFillerRows.map((fillerIndex) => (
                            <tr
                              key={`logs-filler-row-${safePage}-${fillerIndex}`}
                              className="logs-table-body-row logs-table-body-row-filler"
                              aria-hidden="true"
                            >
                              <td>&nbsp;</td>
                              <td>&nbsp;</td>
                              <td>&nbsp;</td>
                              <td>&nbsp;</td>
                              <td>&nbsp;</td>
                              <td>&nbsp;</td>
                            </tr>
                          ))}
                        </>
                  </tbody>
                </table>

                {!isLogsLoading && pageLogs.length === 0 && (
                  <div className="logs-table-empty-state" aria-live="polite">
                    {logsEmptyStateMessage}
                  </div>
                )}
              </div>

              {shouldShowLogsPagination && (
                <div className="logs-pagination-shell">
                  <nav className="logs-pagination" aria-label="Logs pagination">
                    <div className="logs-pagination-group logs-pagination-group-start">
                      <button
                        type="button"
                        className="logs-pagination-button logs-pagination-button-with-icon logs-pagination-button-start"
                        onClick={() => handleLogsPageChange(1)}
                        disabled={safePage === 1 || isLogsLoading}
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
                        onClick={() => handleLogsPageChange(safePage - 1)}
                        disabled={safePage === 1 || isLogsLoading}
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
                            onClick={() => handleLogsPageChange(item)}
                            disabled={item === safePage || isLogsLoading}
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
                        onClick={() => handleLogsPageChange(safePage + 1)}
                        disabled={safePage === totalPages || isLogsLoading}
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
                        onClick={() => handleLogsPageChange(totalPages)}
                        disabled={safePage === totalPages || isLogsLoading}
                        aria-label="Last page"
                      >
                        <span>Last</span>
                        <span className="logs-pagination-button-icon" aria-hidden="true">
                          <LastPageIcon />
                        </span>
                      </button>
                    </div>
                  </nav>
                </div>
              )}
            </div>
          </section>
        </div>
      </section>
      {isLogsPdfPreviewModalOpen && (
        <div
          className={`account-photo-modal-overlay ${isLogsPdfPreviewModalClosing ? 'account-modal-closing' : ''}`}
          onClick={handleCloseLogsPdfPreviewModal}
        >
          <div
            className={`account-photo-modal logs-pdf-preview-modal ${isLogsPdfPreviewModalClosing ? 'account-modal-closing' : ''}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="logs-pdf-preview-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="account-photo-modal-close"
              onClick={handleCloseLogsPdfPreviewModal}
              aria-label="Close PDF preview dialog"
              disabled={isDownloadingLogsPdf}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18" />
                <path d="M6 6l12 12" />
              </svg>
            </button>

            <div className="account-photo-modal-header logs-pdf-preview-modal-header">
              <h2 id="logs-pdf-preview-title" className="account-photo-modal-title">
                Logs PDF Preview
              </h2>
              <p className="account-photo-modal-text">
                Review the file below before downloading.
              </p>
            </div>

            <div className="logs-pdf-preview-meta">
              <div className="logs-pdf-preview-meta-card">
                <span className="logs-pdf-preview-meta-label">File Name</span>
                <span className="logs-pdf-preview-meta-value" title={logsPdfFileName}>
                  {logsPdfFileName}
                </span>
              </div>

              <div className="logs-pdf-preview-tags">
                {logsPdfPreviewTags.map((tag) => (
                  <span key={tag} className="logs-pdf-preview-tag">
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            <div className="logs-pdf-preview-frame-shell">
              {logsPdfPreviewUrl ? (
                <iframe
                  title="Logs PDF Preview"
                  src={logsPdfPreviewUrl}
                  className="logs-pdf-preview-frame"
                />
              ) : (
                <div className="logs-pdf-preview-empty">
                  Preview unavailable.
                </div>
              )}
            </div>

            <div className="account-actions logs-pdf-preview-actions">
              <button
                type="button"
                className="account-button account-button-secondary"
                onClick={handleCloseLogsPdfPreviewModal}
                disabled={isDownloadingLogsPdf}
              >
                Cancel
              </button>

              <button
                type="button"
                className="account-button account-button-primary"
                onClick={handleDownloadLogsPdf}
                disabled={isDownloadingLogsPdf || !logsPdfPreviewUrl}
              >
                <span className="account-button-icon" aria-hidden="true">
                  <DownloadIcon />
                </span>
                <span>Download PDF</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {isPreparingLogsPdfPreview && (
        <div className="account-save-overlay" role="status" aria-live="polite" aria-busy="true">
          <div className="account-save-card">
            <img src={logo} alt="Avinya Logo" className="account-save-logo" />
            <p className="account-save-title">Preparing PDF Preview</p>
            <div className="account-save-loader" aria-hidden="true">
              <span className="account-save-loader-bar"></span>
            </div>
          </div>
        </div>
      )}

      {isLogsPdfPreviewModalOpen && isDownloadingLogsPdf && (
        <div className="account-save-overlay" role="status" aria-live="polite" aria-busy="true">
          <div className="account-save-card">
            <img src={logo} alt="Avinya Logo" className="account-save-logo" />
            <p className="account-save-title">Downloading PDF</p>
            <div className="account-save-loader" aria-hidden="true">
              <span className="account-save-loader-bar"></span>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

export default Logs