import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Swal from 'sweetalert2'
import 'sweetalert2/dist/sweetalert2.min.css'
import { Responsive, WidthProvider } from 'react-grid-layout/legacy'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import logo from '../Pictures/Avinya.png'
import '../Styles/Dashboard.css'
import { getCurrentUserProfile, isAdministratorRole } from '../Utils/getCurrentUserProfile'
import { performReliableLogout } from '../Utils/performReliableLogout'
import { buildApiAssetUrl } from '../Config/API'
import {
  ProfileMenuIcon,
  EditIcon,
  TrashIcon,
  SaveIcon,
  UserIcon,
  ErrorIcon,
  SearchIcon,
  FilterIcon,
  SortIcon,
  DashboardNameFieldIcon,
  LastNameFieldIcon,
  FirstNameFieldIcon,
  DashboardDeviceFieldIcon,
  DashboardDataKeyFieldIcon,
  DashboardSourceFileIcon,
  ViewDashboardIcon,
  BackDashboardIcon,
  EditModeIcon,
  AddWidgetIcon,
  CancelEditIcon,
  DashboardWidgetIcon,
  MoveWidgetIcon
} from '../Components/Icons.jsx'
import {
  fetchDashboards,
  fetchDashboardOptions,
  createDashboard,
  updateDashboard,
  deleteDashboardById,
  fetchCurrentDashboard,
  fetchDashboardWidgets,
  validateDashboardWidget,
  saveDashboardWidgets
} from '../Utils/dashboardApi'
import { fetchDeviceLatestTelemetry } from '../Utils/devicesApi'
import { useConnectionMode } from '../Utils/useConnectionMode'

import {
  BatteryGauge,
  PumpControl,
  ServoMotor,
  LEDIndicator,
  CountWidgets,
  EntitiesTable,
  ProgressWidget,
  TimeSeriesChart,
  MarkdownCard,
  UltraSonic,
  ValueCard,
  SpeedGauge
} from '../Devices'

const ResponsiveGridLayout = WidthProvider(Responsive)

const DASHBOARD_MODAL_TRANSITION_MS = 280
const DASHBOARD_WIDGET_LIBRARY_MODAL_TRANSITION_MS = 280
const DASHBOARD_NAME_MAX_LENGTH = 80
const DASHBOARD_SELECTED_VIEW_STORAGE_KEY = 'avinya_selected_dashboard_view'

const DASHBOARD_GRID_COLS = {
  lg: 24,
  md: 18,
  sm: 12,
  xs: 6,
  xxs: 6,
}

const DASHBOARD_GRID_ROW_HEIGHT = 24
const DASHBOARD_GRID_MARGIN = [10, 10]
const DASHBOARD_GRID_CONTAINER_PADDING = [0, 0]

const DASHBOARD_WIDGET_OPTIONAL_DATA_KEY = new Set([
  'count-widget',
  'entities-table',
  'mark-down-card',
])

const DASHBOARD_WIDGET_DEFAULT_LAYOUTS = {
  'battery-gauge': { w: 6, h: 8 },
  'control-switch': { w: 6, h: 8 },
  'count-widget': { w: 7, h: 8 },
  'entities-table': { w: 8, h: 9 },
  'led-indicator': { w: 6, h: 8 },
  'mark-down-card': { w: 6, h: 8 },
  'progress-widget': { w: 6, h: 8 },
  'servo-motor': { w: 6, h: 8 },
  'speed-gauge': { w: 6, h: 8 },
  'time-series-chart': { w: 9, h: 9 },
  ultrasonic: { w: 6, h: 8 },
  'value-card': { w: 6, h: 8 },
}

const DASHBOARD_WIDGET_LAYOUT_LIMITS = {
  'battery-gauge': { minW: 5, minH: 7, maxW: 12, maxH: 14 },
  'control-switch': { minW: 5, minH: 7, maxW: 12, maxH: 14 },
  'count-widget': { minW: 6, minH: 7, maxW: 14, maxH: 14 },
  'entities-table': { minW: 7, minH: 8, maxW: 18, maxH: 16 },
  'led-indicator': { minW: 5, minH: 7, maxW: 12, maxH: 14 },
  'mark-down-card': { minW: 5, minH: 7, maxW: 14, maxH: 16 },
  'progress-widget': { minW: 5, minH: 7, maxW: 12, maxH: 14 },
  'servo-motor': { minW: 5, minH: 8, maxW: 12, maxH: 16 },
  'speed-gauge': { minW: 5, minH: 8, maxW: 12, maxH: 16 },
  'time-series-chart': { minW: 8, minH: 8, maxW: 20, maxH: 18 },
  ultrasonic: { minW: 5, minH: 8, maxW: 12, maxH: 16 },
  'value-card': { minW: 5, minH: 7, maxW: 12, maxH: 14 },
}

const getDashboardWidgetLayoutLimits = (widgetKey) =>
  DASHBOARD_WIDGET_LAYOUT_LIMITS[widgetKey] || {
    minW: 4,
    minH: 6,
    maxW: 24,
    maxH: 18,
  }

const getInitialWidgetSetupForm = () => ({
  widgetName: '',
  dataKey: '',
  inoFileName: '',
  inoFileContent: '',
})

const createDashboardWidgetClientId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `widget-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

const getDashboardWidgetIdentity = (widget) =>
  String(widget.id || widget.clientId || widget.localId || '')

const getDashboardWidgetDuplicateSignature = (widget = {}) =>
  [
    String(widget.widgetKey || '').trim(),
    String(widget.widgetType || '').trim(),
    String(widget.widgetName || '').trim(),
    String(widget.dataKey || '').trim(),
    Number(widget.layout?.x || 0),
    Number(widget.layout?.y || 0),
    Number(widget.layout?.w || 6),
    Number(widget.layout?.h || 8),
  ].join('|')

const getUniqueDashboardWidgets = (widgets = []) => {
  const usedSignatures = new Set()

  return widgets.filter((widget) => {
    const signature = getDashboardWidgetDuplicateSignature(widget)

    if (usedSignatures.has(signature)) {
      return false
    }

    usedSignatures.add(signature)
    return true
  })
}

const DASHBOARD_WIDGET_COMPONENTS = {
  'battery-gauge': BatteryGauge,
  'control-switch': PumpControl,
  'count-widget': CountWidgets,
  'entities-table': EntitiesTable,
  'led-indicator': LEDIndicator,
  'mark-down-card': MarkdownCard,
  'progress-widget': ProgressWidget,
  'servo-motor': ServoMotor,
  'speed-gauge': SpeedGauge,
  'time-series-chart': TimeSeriesChart,
  ultrasonic: UltraSonic,
  'value-card': ValueCard,
}

const normalizeDashboardWidgetForSave = (widget) => ({
  id: widget.id || null,
  widgetKey: widget.widgetKey,
  widgetType: widget.widgetType,
  widgetName: String(widget.widgetName || '').trim(),
  dataKey: String(widget.dataKey || '').trim(),
  inoFileName: String(widget.inoFileName || '').trim(),
  validationStatus: widget.validationStatus || 'unchecked',
  validationMessage: widget.validationMessage || '',
  layout: {
    x: Number(widget.layout?.x || 0),
    y: Number(widget.layout?.y || 0),
    w: Number(widget.layout?.w || 6),
    h: Number(widget.layout?.h || 7),
  },
  settings: widget.settings || {},
})

const normalizeDashboardWidgetForCompare = (widget) => ({
  id: String(widget.id || ''),
  clientId: widget.id ? '' : String(widget.clientId || ''),
  widgetKey: String(widget.widgetKey || '').trim(),
  widgetType: String(widget.widgetType || '').trim(),
  widgetName: String(widget.widgetName || '').trim(),
  dataKey: String(widget.dataKey || '').trim(),
  inoFileName: String(widget.inoFileName || '').trim(),
  validationStatus: String(widget.validationStatus || '').trim(),
  validationMessage: String(widget.validationMessage || '').trim(),
  layout: {
    x: Number(widget.layout?.x || 0),
    y: Number(widget.layout?.y || 0),
    w: Number(widget.layout?.w || 6),
    h: Number(widget.layout?.h || 7),
  },
  settings: widget.settings || {},
})

const getDashboardWidgetCompareKey = (widget) =>
  String(widget.id || widget.clientId || widget.widgetName || '')

const areDashboardWidgetListsEqual = (leftWidgets = [], rightWidgets = []) => {
  const normalizeList = (widgets = []) =>
    widgets
      .map(normalizeDashboardWidgetForCompare)
      .sort((a, b) =>
        getDashboardWidgetCompareKey(a).localeCompare(getDashboardWidgetCompareKey(b))
      )

  return JSON.stringify(normalizeList(leftWidgets)) === JSON.stringify(normalizeList(rightWidgets))
}

const DASHBOARD_AVAILABLE_WIDGETS = [
  {
    id: 'battery-gauge',
    name: 'Battery Gauge',
    type: 'Telemetry',
    description: 'Shows the current battery level of the selected device.',
  },
  {
    id: 'control-switch',
    name: 'Control Switch',
    type: 'Control',
    description: 'Displays an on and off switch for device control.',
  },
  {
    id: 'count-widget',
    name: 'Count Widget',
    type: 'System',
    description: 'Shows system counts such as alarms and entities.',
  },
  {
    id: 'entities-table',
    name: 'Entities Table',
    type: 'Table',
    description: 'Displays ThingsBoard entities in a compact table view.',
  },
  {
    id: 'led-indicator',
    name: 'LED Indicator',
    type: 'Control',
    description: 'Shows and controls the current LED status.',
  },
  {
    id: 'mark-down-card',
    name: 'Mark Down Card',
    type: 'Information',
    description: 'Displays editable notes, instructions, or descriptions.',
  },
  {
    id: 'progress-widget',
    name: 'Progress Widget',
    type: 'Telemetry',
    description: 'Shows progress values using a gauge and progress bar.',
  },
  {
    id: 'servo-motor',
    name: 'Servo Motor',
    type: 'Control',
    description: 'Displays servo angle controls from 0 to 180 degrees.',
  },
  {
    id: 'speed-gauge',
    name: 'Speed Gauge',
    type: 'Telemetry',
    description: 'Shows speed readings in a gauge layout.',
  },
  {
    id: 'time-series-chart',
    name: 'Time Series Chart',
    type: 'Chart',
    description: 'Displays telemetry history using a line chart.',
  },
  {
    id: 'ultrasonic',
    name: 'Ultrasonic',
    type: 'Telemetry',
    description: 'Shows ultrasonic distance readings in centimeters.',
  },
  {
    id: 'value-card',
    name: 'Value Card',
    type: 'Telemetry',
    description: 'Displays one live telemetry value with status details.',
  },
]

const getStoredSelectedDashboardView = () => {
  if (typeof window === 'undefined') return null

  try {
    const storedDashboard = window.sessionStorage.getItem(DASHBOARD_SELECTED_VIEW_STORAGE_KEY)
    return storedDashboard ? JSON.parse(storedDashboard) : null
  } catch {
    return null
  }
}

const setStoredSelectedDashboardView = (dashboard) => {
  if (typeof window === 'undefined' || !dashboard) return

  try {
    window.sessionStorage.setItem(
      DASHBOARD_SELECTED_VIEW_STORAGE_KEY,
      JSON.stringify(dashboard)
    )
  } catch {
  }
}

const clearStoredSelectedDashboardView = () => {
  if (typeof window === 'undefined') return

  try {
    window.sessionStorage.removeItem(DASHBOARD_SELECTED_VIEW_STORAGE_KEY)
  } catch {
  }
}

const getInitialDashboardForm = () => ({
  dashboardName: '',
  lastName: '',
  firstName: '',
  assignedUserId: '',
  deviceId: '',
})

const normalizeDashboardForm = (form) => ({
  dashboardName: String(form.dashboardName || '').trim(),
  lastName: String(form.lastName || '').trim(),
  firstName: String(form.firstName || '').trim(),
  assignedUserId: String(form.assignedUserId || '').trim(),
  deviceId: String(form.deviceId || '').trim(),
})

const getDashboardOwnerDisplayName = (dashboard) =>
  [dashboard.lastName, dashboard.firstName]
    .filter(Boolean)
    .join(', ')
    .trim() || dashboard.email || 'User'

const AVINYA_TIME_ZONE = 'Asia/Manila'

const DASHBOARD_SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'dashboard_name_asc', label: 'Dashboard Name A-Z' },
  { value: 'dashboard_name_desc', label: 'Dashboard Name Z-A' },
  { value: 'user_asc', label: 'Assigned User A-Z' },
  { value: 'user_desc', label: 'Assigned User Z-A' },
  { value: 'device_asc', label: 'Device Name A-Z' },
  { value: 'device_desc', label: 'Device Name Z-A' }
]

const formatDashboardCreatedAt = (value) => {
  if (!value) return 'N/A'

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return 'N/A'

  const dateText = new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: AVINYA_TIME_ZONE
  }).format(date)

  const timeText = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: AVINYA_TIME_ZONE
  }).format(date)

  return `${dateText} | ${timeText}`
}

const DashboardWidgetEditPreview = ({ widget }) => (
  <div className="dashboard-widget-edit-preview">
    <span className="dashboard-widget-edit-preview-icon" aria-hidden="true">
      <DashboardWidgetIcon />
    </span>
    <span className="dashboard-widget-edit-preview-title">
      {widget.widgetName || 'Widget'}
    </span>
    <span className="dashboard-widget-edit-preview-subtitle">
      Preview only while editing
    </span>
  </div>
)

const DashboardWidgetHardwareNotice = ({
  title = 'Hardware not ready',
  message = 'Connect the device, run the verified Arduino code, upload it successfully, and wait for telemetry to appear.',
  isChecking = false,
}) => (
  <div className="dashboard-widget-hardware-notice">
    <span className="dashboard-widget-hardware-notice-icon" aria-hidden="true">
      {isChecking ? <span className="dashboard-widget-hardware-spinner" /> : <ErrorIcon />}
    </span>

    <span className="dashboard-widget-hardware-title">
      {title}
    </span>

    <p>{message}</p>
  </div>
)

const DashboardFilterDropdown = ({
  id,
  label,
  icon,
  className = '',
  value,
  options,
  isOpen,
  onToggle,
  onSelect,
  disabled = false
}) => {
  const selectedOption =
    options.find((option) => String(option.value) === String(value)) || options[0]

  return (
    <div className={`dashboard-list-filter-dropdown ${className} ${isOpen ? 'open' : ''}`}>
      <button
        type="button"
        id={id}
        className={`dashboard-list-filter-field dashboard-list-filter-dropdown-trigger ${isOpen ? 'dashboard-list-filter-dropdown-trigger-open' : ''}`}
        onClick={onToggle}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        disabled={disabled}
      >
        <span className="dashboard-list-filter-field-icon" aria-hidden="true">
          {icon}
        </span>

        <div className="dashboard-list-filter-floating-control">
          <span className="dashboard-list-filter-dropdown-value">
            <span className="dashboard-list-filter-dropdown-value-text">
              {selectedOption?.label || ''}
            </span>
          </span>

          <span className="dashboard-list-filter-label dashboard-list-filter-label-static">
            {label}
          </span>
        </div>

        <span className="dashboard-list-filter-field-arrow" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d={isOpen ? 'M18 15l-6-6-6 6' : 'M6 9l6 6 6-6'} />
          </svg>
        </span>
      </button>

      <div
        className={`dashboard-list-filter-dropdown-menu ${isOpen ? 'open' : ''}`}
        role="listbox"
        aria-labelledby={id}
      >
        {options.map((option) => (
          <button
            key={`${id}-${option.value}`}
            type="button"
            className={`dashboard-list-filter-dropdown-option ${String(value) === String(option.value) ? 'active' : ''}`}
            onClick={() => onSelect(option.value)}
          >
            <span className="dashboard-list-filter-dropdown-option-label">
              <span className="dashboard-list-filter-dropdown-option-text">
                {option.label}
              </span>
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

const Dashboard = ({ onLogout, onNavigate, isDarkMode, onThemeToggle }) => {
  const [isEntitiesOpen,     setIsEntitiesOpen]     = useState(false)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [isProfileMenuOpen,  setIsProfileMenuOpen]  = useState(false)

  const [dashboards, setDashboards] = useState([])
  const [dashboardUsers, setDashboardUsers] = useState([])
  const [dashboardDevices, setDashboardDevices] = useState([])
  const [isDashboardLoading, setIsDashboardLoading] = useState(true)
  const [dashboardRequestError, setDashboardRequestError] = useState('')

  const [isDashboardModalOpen, setIsDashboardModalOpen] = useState(false)
  const [isDashboardModalClosing, setIsDashboardModalClosing] = useState(false)
  const [dashboardModalMode, setDashboardModalMode] = useState('add')
  const [editingDashboard, setEditingDashboard] = useState(null)
  const [dashboardForm, setDashboardForm] = useState(() => getInitialDashboardForm())
  const [savedDashboardForm, setSavedDashboardForm] = useState(() => getInitialDashboardForm())

  const [dashboardNameError, setDashboardNameError] = useState('')
  const [lastNameError, setLastNameError] = useState('')
  const [firstNameError, setFirstNameError] = useState('')
  const [deviceError, setDeviceError] = useState('')

  const [isDashboardActionLoading, setIsDashboardActionLoading] = useState(false)
  const [dashboardActionLoadingTitle, setDashboardActionLoadingTitle] = useState('Loading Dashboards')
  const [openDashboardDropdown, setOpenDashboardDropdown] = useState('')

  const [dashboardSearchInput, setDashboardSearchInput] = useState('')
  const [appliedDashboardSearchQuery, setAppliedDashboardSearchQuery] = useState('')
  const [dashboardUserFilter, setDashboardUserFilter] = useState('all')
  const [dashboardDeviceFilter, setDashboardDeviceFilter] = useState('all')
  const [dashboardSortBy, setDashboardSortBy] = useState('newest')
  const [openDashboardFilterDropdown, setOpenDashboardFilterDropdown] = useState('')
  const [dashboardRefreshKey, setDashboardRefreshKey] = useState(0)
  const [selectedDashboardView, setSelectedDashboardView] = useState(null)
  const [dashboardListLoadingTitle, setDashboardListLoadingTitle] = useState('Loading Dashboards')
  const [isDashboardListTransitioning, setIsDashboardListTransitioning] = useState(false)
  const [hasDashboardLoadedOnce, setHasDashboardLoadedOnce] = useState(false)

  const [isDashboardEditMode, setIsDashboardEditMode] = useState(false)
  const [hasDashboardViewChanges, setHasDashboardViewChanges] = useState(false)

  const [isWidgetLibraryModalOpen, setIsWidgetLibraryModalOpen] = useState(false)
  const [isWidgetLibraryModalClosing, setIsWidgetLibraryModalClosing] = useState(false)
  const [widgetLibrarySearchInput, setWidgetLibrarySearchInput] = useState('')
  const [appliedWidgetLibrarySearchQuery, setAppliedWidgetLibrarySearchQuery] = useState('')

  const [isWidgetSetupModalOpen, setIsWidgetSetupModalOpen] = useState(false)
  const [isWidgetSetupModalClosing, setIsWidgetSetupModalClosing] = useState(false)
  const [selectedWidgetType, setSelectedWidgetType] = useState(null)
  const [editingDashboardWidget, setEditingDashboardWidget] = useState(null)
  const [widgetSetupForm, setWidgetSetupForm] = useState(getInitialWidgetSetupForm())
  const [savedWidgetSetupForm, setSavedWidgetSetupForm] = useState(getInitialWidgetSetupForm())
  const [widgetSetupError, setWidgetSetupError] = useState('')
  const [widgetSetupCheckStatus, setWidgetSetupCheckStatus] = useState('idle')
  const [widgetSetupCheckMessage, setWidgetSetupCheckMessage] = useState('')
  const [isWidgetChecking, setIsWidgetChecking] = useState(false)
  const [isWidgetSetupLoading, setIsWidgetSetupLoading] = useState(false)
  const [dashboardTelemetryKeys, setDashboardTelemetryKeys] = useState([])
  const [isWidgetDataKeyDropdownOpen, setIsWidgetDataKeyDropdownOpen] = useState(false)
  const {
    isDetecting: isDashboardConnectionDetecting,
    isNone: isDashboardHardwareUnavailable,
  } = useConnectionMode()

  const [savedDashboardWidgets, setSavedDashboardWidgets] = useState([])
  const [draftDashboardWidgets, setDraftDashboardWidgets] = useState([])
  const [isDashboardWidgetsLoading, setIsDashboardWidgetsLoading] = useState(false)
  const [dashboardRuntimeTelemetryKeys, setDashboardRuntimeTelemetryKeys] = useState([])
  const [isDashboardRuntimeChecking, setIsDashboardRuntimeChecking] = useState(false)
  const [dashboardRuntimeError, setDashboardRuntimeError] = useState('')

  const dashboardModalRef = useRef(null)
  const isDashboardBrowserLeavingRef = useRef(false)
  const isDashboardEditModeRef = useRef(false)
  const hasDashboardViewChangesRef = useRef(false)

  const user = getCurrentUserProfile()
  const isAdministrator = isAdministratorRole(user.roleLabel)
  const sidebarProfileImagePreview = buildApiAssetUrl(user.profilePictureUrl)
  const sidebarUserInitials = [user.firstName, user.lastName]
    .filter(Boolean).map(v => String(v).trim().charAt(0).toUpperCase()).join('').slice(0, 2) || 'A'

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (!(e.target instanceof Element)) return

      if (!e.target.closest('.dashboard-sidebar-user-group')) {
        setIsProfileMenuOpen(false)
      }

      if (!e.target.closest('.dashboard-list-filter-dropdown')) {
        setOpenDashboardFilterDropdown('')
      }

      if (!e.target.closest('.dashboard-widget-data-key-select')) {
        setIsWidgetDataKeyDropdownOpen(false)
      }
    }

    document.addEventListener('mousedown', handleOutsideClick)

    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [])

  useEffect(() => {
    document.title = selectedDashboardView
      ? `Avinya | ${selectedDashboardView.dashboardName}`
      : 'Avinya | Dashboard'
  }, [selectedDashboardView])

  const loadDashboardData = useCallback(async () => {
    setIsDashboardLoading(true)
    setDashboardRequestError('')

    if (!isAdministrator) {
      try {
        const [currentDashboardData] = await Promise.all([
          fetchCurrentDashboard(),
          new Promise((resolve) => window.setTimeout(resolve, 420)),
        ])

        const nextDashboard = currentDashboardData?.dashboard || null

        const nextWidgets = getUniqueDashboardWidgets(
          Array.isArray(currentDashboardData?.widgets)
            ? currentDashboardData.widgets
            : []
        )

        setSelectedDashboardView(nextDashboard)
        setSavedDashboardWidgets(nextWidgets)
        setDraftDashboardWidgets(nextWidgets)
        setHasDashboardViewChanges(false)
        setIsDashboardEditMode(false)
        setDashboards([])
        setDashboardUsers([])
        setDashboardDevices([])

        if (!nextDashboard) {
          clearStoredSelectedDashboardView()
        }
      } catch (error) {
        console.error('CURRENT DASHBOARD LOAD ERROR:', error)

        setSelectedDashboardView(null)
        setSavedDashboardWidgets([])
        setDraftDashboardWidgets([])
        setDashboardRequestError(
          error instanceof TypeError || error.message === 'Failed to fetch'
            ? 'Unable to connect to the server. Please check your connection and try again.'
            : error.message || 'Unable to load your dashboard right now.'
        )
      } finally {
        setIsDashboardLoading(false)
        setIsDashboardListTransitioning(false)
        setHasDashboardLoadedOnce(true)
      }

      return
    }

    try {
      const [dashboardsData, optionsData] = await Promise.all([
        fetchDashboards({
          search: appliedDashboardSearchQuery,
          assignedUserId: dashboardUserFilter,
          deviceId: dashboardDeviceFilter,
          sortBy: dashboardSortBy,
        }),
        fetchDashboardOptions(),
        new Promise((resolve) => window.setTimeout(resolve, 420)),
      ])

      setDashboards(Array.isArray(dashboardsData.dashboards) ? dashboardsData.dashboards : [])
      setDashboardUsers(Array.isArray(optionsData.users) ? optionsData.users : [])
      setDashboardDevices(Array.isArray(optionsData.devices) ? optionsData.devices : [])
    } catch (error) {
      console.error('DASHBOARD LOAD ERROR:', error)

      setDashboards([])
      setDashboardUsers([])
      setDashboardDevices([])
      setDashboardRequestError(
        error instanceof TypeError || error.message === 'Failed to fetch'
          ? 'Unable to connect to the server. Please check your connection and try again.'
          : error.message || 'Unable to load dashboards right now.'
      )
    } finally {
      setIsDashboardLoading(false)
      setIsDashboardListTransitioning(false)
      setHasDashboardLoadedOnce(true)
    }
  }, [
    isAdministrator,
    appliedDashboardSearchQuery,
    dashboardUserFilter,
    dashboardDeviceFilter,
    dashboardSortBy,
    dashboardRefreshKey
  ])

  useEffect(() => {
    void loadDashboardData()
  }, [loadDashboardData])

  useEffect(() => {
    isDashboardEditModeRef.current = isDashboardEditMode
    hasDashboardViewChangesRef.current = hasDashboardViewChanges
  }, [isDashboardEditMode, hasDashboardViewChanges])

  useEffect(() => {
    const handleBeforeUnload = (event) => {
      if (!isDashboardEditModeRef.current || !hasDashboardViewChangesRef.current) return

      event.preventDefault()
      event.returnValue = ''
    }

    const handleDashboardRefreshShortcut = async (event) => {
      const isRefreshShortcut =
        event.key === 'F5' ||
        ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'r')

      if (!isRefreshShortcut || !isDashboardEditModeRef.current || !hasDashboardViewChangesRef.current) {
        return
      }

      event.preventDefault()

      const confirmation = await confirmDashboardAction({
        title: 'Discard Changes?',
        text: 'You have unsaved dashboard changes. Are you sure you want to refresh without saving?',
      })

      if (!confirmation.isConfirmed) return

      setDashboardActionLoadingTitle('Discarding Changes')
      setIsDashboardActionLoading(true)

      await new Promise((resolve) => window.setTimeout(resolve, 680))

      setDraftDashboardWidgets(savedDashboardWidgets)
      setIsDashboardEditMode(false)
      setHasDashboardViewChanges(false)
      setIsDashboardActionLoading(false)
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    window.addEventListener('keydown', handleDashboardRefreshShortcut)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      window.removeEventListener('keydown', handleDashboardRefreshShortcut)
    }
  }, [savedDashboardWidgets])

  useEffect(() => {
    const nextHasChanges =
      isDashboardEditMode &&
      !areDashboardWidgetListsEqual(savedDashboardWidgets, draftDashboardWidgets)

    setHasDashboardViewChanges((currentValue) =>
      currentValue === nextHasChanges ? currentValue : nextHasChanges
    )
  }, [isDashboardEditMode, savedDashboardWidgets, draftDashboardWidgets])

  useEffect(() => {
    if (!isAdministrator || !hasDashboardLoadedOnce || selectedDashboardView) return

    const storedDashboard = getStoredSelectedDashboardView()

    if (!storedDashboard?.id) return

    const matchedDashboard = dashboards.find(
      (dashboard) => String(dashboard.id) === String(storedDashboard.id)
    )

    if (matchedDashboard) {
      setSelectedDashboardView(matchedDashboard)
    } else {
      clearStoredSelectedDashboardView()
    }
  }, [dashboards, hasDashboardLoadedOnce, isAdministrator, selectedDashboardView])

  useEffect(() => {
    if (selectedDashboardView) {
      setStoredSelectedDashboardView(selectedDashboardView)
    }
  }, [selectedDashboardView])

  useEffect(() => {
    if (!isAdministrator) return

    if (!selectedDashboardView?.id) {
      setSavedDashboardWidgets([])
      setDraftDashboardWidgets([])
      return
    }

    let isMounted = true

    const loadDashboardWidgets = async () => {
      setIsDashboardWidgetsLoading(true)

      try {
        const data = await fetchDashboardWidgets(selectedDashboardView.id)
        const nextWidgets = getUniqueDashboardWidgets(
          Array.isArray(data.widgets) ? data.widgets : []
        )

        if (!isMounted) return

        setSavedDashboardWidgets(nextWidgets)
        setDraftDashboardWidgets(nextWidgets)
        setHasDashboardViewChanges(false)
      } catch (error) {
        console.error('DASHBOARD WIDGET LOAD ERROR:', error)

        if (!isMounted) return

        setSavedDashboardWidgets([])
        setDraftDashboardWidgets([])
      } finally {
        if (isMounted) {
          setIsDashboardWidgetsLoading(false)
        }
      }
    }

    void loadDashboardWidgets()

    return () => {
      isMounted = false
    }
  }, [isAdministrator, selectedDashboardView?.id])

  const closeDropdowns = () => {
    setIsEntitiesOpen(false)
    setIsProfileMenuOpen(false)
    setOpenDashboardFilterDropdown('')
    setIsWidgetDataKeyDropdownOpen(false)
  }

  const startDashboardListTransition = (title = 'Loading Dashboards') => {
    setDashboardListLoadingTitle(title)
    setIsDashboardListTransitioning(true)
  }

  const handleProfileMenuToggle = (event) => {
    event.stopPropagation()
    setIsEntitiesOpen(false)
    setOpenDashboardFilterDropdown('')
    setIsProfileMenuOpen((prev) => !prev)
  }

  const handleDashboardFilterDropdownToggle = (dropdownName) => {
    setIsProfileMenuOpen(false)

    setOpenDashboardFilterDropdown((prev) =>
      prev === dropdownName ? '' : dropdownName
    )
  }

  const handleDashboardSearchInputChange = (event) => {
    setDashboardSearchInput(event.target.value)
  }

  const handleDashboardSearchSubmit = (event) => {
    event.preventDefault()

    const nextSearchQuery = dashboardSearchInput.trim()

    if (!nextSearchQuery) return

    setOpenDashboardFilterDropdown('')
    startDashboardListTransition('Searching Dashboards')

    if (nextSearchQuery === appliedDashboardSearchQuery) {
      setDashboardRefreshKey((prev) => prev + 1)
      return
    }

    setAppliedDashboardSearchQuery(nextSearchQuery)
  }

  const handleDashboardUserFilterChange = (value) => {
    setOpenDashboardFilterDropdown('')

    if (value === dashboardUserFilter) return

    startDashboardListTransition('Filtering Dashboards')
    setDashboardUserFilter(value)
  }

  const handleDashboardDeviceFilterChange = (value) => {
    setOpenDashboardFilterDropdown('')

    if (value === dashboardDeviceFilter) return

    startDashboardListTransition('Filtering Dashboards')
    setDashboardDeviceFilter(value)
  }

  const handleDashboardSortByChange = (value) => {
    setOpenDashboardFilterDropdown('')

    if (value === dashboardSortBy) return

    startDashboardListTransition('Sorting Dashboards')
    setDashboardSortBy(value)
  }

  const handleDashboardResetFilters = () => {
    setOpenDashboardFilterDropdown('')

    if (!hasDashboardListFilters) return

    startDashboardListTransition('Filtering Dashboards')
    setDashboardSearchInput('')
    setAppliedDashboardSearchQuery('')
    setDashboardUserFilter('all')
    setDashboardDeviceFilter('all')
    setDashboardSortBy('newest')
  }

  const handleOpenDashboardView = async (dashboard) => {
    if (isDashboardActionLoading) return

    closeDropdowns()
    setDashboardActionLoadingTitle('Opening Dashboard')
    setIsDashboardActionLoading(true)

    await new Promise((resolve) => window.setTimeout(resolve, 680))

    setSelectedDashboardView(dashboard)
    setStoredSelectedDashboardView(dashboard)
    setIsDashboardEditMode(false)
    setHasDashboardViewChanges(false)
    setIsDashboardActionLoading(false)
  }

  const handleBackToDashboardList = async () => {
    if (isDashboardActionLoading) return

    const canLeaveDashboardView = await confirmLeaveDashboardView({
      title: 'Discard Changes?',
      text: 'You have unsaved dashboard changes. If you go back, your latest changes will not be saved.',
    })

    if (!canLeaveDashboardView) return

    closeDropdowns()
    setDashboardActionLoadingTitle('Loading Dashboards')
    setIsDashboardActionLoading(true)

    await new Promise((resolve) => window.setTimeout(resolve, 520))

    clearStoredSelectedDashboardView()
    setSelectedDashboardView(null)
    setSavedDashboardWidgets([])
    setDraftDashboardWidgets([])
    setIsDashboardEditMode(false)
    setHasDashboardViewChanges(false)
    setIsDashboardActionLoading(false)
  }

  const selectedLastNameUsers = useMemo(() => {
    if (!dashboardForm.lastName) return []

    return dashboardUsers.filter(
      (item) => String(item.lastName || '').trim() === dashboardForm.lastName
    )
  }, [dashboardForm.lastName, dashboardUsers])

  const dashboardLastNameOptions = useMemo(
    () =>
      [...new Set(dashboardUsers.map((item) => String(item.lastName || '').trim()).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b))
        .map((lastName) => ({
          value: lastName,
          label: lastName,
        })),
    [dashboardUsers]
  )

  const dashboardFirstNameOptions = useMemo(
    () =>
      selectedLastNameUsers.map((item) => ({
        value: String(item.firstName || '').trim(),
        label: String(item.firstName || '').trim(),
      })),
    [selectedLastNameUsers]
  )

  const dashboardDeviceOptions = useMemo(
    () =>
      dashboardDevices.map((device) => ({
        value: String(device.id),
        label: device.deviceName,
      })),
    [dashboardDevices]
  )

  const dashboardUserFilterOptions = useMemo(
    () => [
      { value: 'all', label: 'All Assigned Users' },
      ...dashboardUsers.map((item) => ({
        value: String(item.id),
        label:
          [item.lastName, item.firstName]
            .filter(Boolean)
            .join(', ')
            .trim() || item.email || 'User',
      })),
    ],
    [dashboardUsers]
  )

  const dashboardDeviceFilterOptions = useMemo(
    () => [
      { value: 'all', label: 'All Devices' },
      ...dashboardDevices.map((device) => ({
        value: String(device.id),
        label: device.deviceName,
      })),
    ],
    [dashboardDevices]
  )

  const hasDashboardListFilters =
    appliedDashboardSearchQuery.trim() !== '' ||
    dashboardUserFilter !== 'all' ||
    dashboardDeviceFilter !== 'all' ||
    dashboardSortBy !== 'newest'

  const isDashboardToolbarDisabled =
    isDashboardLoading ||
    isDashboardActionLoading ||
    isDashboardListTransitioning ||
    Boolean(selectedDashboardView)

  const isDashboardSearchDisabled =
    isDashboardToolbarDisabled ||
    dashboardSearchInput.trim().length === 0

  const normalizedDashboardForm = useMemo(
    () => normalizeDashboardForm(dashboardForm),
    [dashboardForm]
  )

  const normalizedSavedDashboardForm = useMemo(
    () => normalizeDashboardForm(savedDashboardForm),
    [savedDashboardForm]
  )

  const hasDashboardFormChanges = useMemo(() => {
    if (dashboardModalMode === 'add') return true

    return JSON.stringify(normalizedDashboardForm) !== JSON.stringify(normalizedSavedDashboardForm)
  }, [dashboardModalMode, normalizedDashboardForm, normalizedSavedDashboardForm])

  const canSubmitDashboard =
    !isDashboardModalClosing &&
    !isDashboardActionLoading &&
    (dashboardModalMode === 'add' || hasDashboardFormChanges)

  const widgetLibraryQuery = appliedWidgetLibrarySearchQuery.trim().toLowerCase()

  const filteredDashboardWidgets = useMemo(() => {
    if (!widgetLibraryQuery) return DASHBOARD_AVAILABLE_WIDGETS

    return DASHBOARD_AVAILABLE_WIDGETS.filter((widget) =>
      `${widget.name} ${widget.type} ${widget.description}`
        .toLowerCase()
        .includes(widgetLibraryQuery)
    )
  }, [widgetLibraryQuery])

  const widgetDataKeyOptions = useMemo(() => {
    const telemetryOptions = dashboardTelemetryKeys
      .filter(Boolean)
      .map((key) => ({
        value: key,
        label: key,
      }))

    if (selectedWidgetType && DASHBOARD_WIDGET_OPTIONAL_DATA_KEY.has(selectedWidgetType.id)) {
      return [
        { value: '', label: 'No data key' },
        ...telemetryOptions,
      ]
    }

    return telemetryOptions
  }, [dashboardTelemetryKeys, selectedWidgetType])

  const selectedWidgetDataKeyOption = widgetDataKeyOptions.find(
    (option) => String(option.value) === String(widgetSetupForm.dataKey)
  )

  const selectedDashboardDeviceThingsBoardId =
    selectedDashboardView?.thingsboardDeviceId || ''

  const selectedDashboardInternalDeviceId =
    selectedDashboardView?.deviceId || ''

  const dashboardWidgetsToDisplay = isDashboardEditMode
    ? draftDashboardWidgets
    : savedDashboardWidgets

  const dashboardRuntimeTelemetryKeySet = useMemo(
    () => new Set(dashboardRuntimeTelemetryKeys),
    [dashboardRuntimeTelemetryKeys]
  )

  const shouldRenderDashboardWidgetsReadOnly =
    isAdministrator && !isDashboardEditMode

  const getDashboardWidgetRuntimeStatus = useCallback((widget) => {
    if (isDashboardEditMode) {
      return { isReady: true }
    }

    if (!selectedDashboardInternalDeviceId || !selectedDashboardDeviceThingsBoardId) {
      return {
        isReady: false,
        title: 'Device unavailable',
        message: 'This dashboard has no valid device assigned.',
      }
    }

    if (isDashboardConnectionDetecting || isDashboardRuntimeChecking) {
      return {
        isReady: false,
        isChecking: true,
        title: 'Checking hardware status',
        message: 'Please wait while Avinya checks the assigned device telemetry.',
      }
    }

    if (isDashboardHardwareUnavailable) {
      return {
        isReady: false,
        title: 'Connection unavailable',
        message: 'Connect the hardware device or check your internet connection, then try again.',
      }
    }

    if (dashboardRuntimeError) {
      return {
        isReady: false,
        title: 'Hardware not ready',
        message: dashboardRuntimeError,
      }
    }

    if (!DASHBOARD_WIDGET_OPTIONAL_DATA_KEY.has(widget.widgetKey)) {
      const dataKey = String(widget.dataKey || '').trim()

      if (!dataKey || !dashboardRuntimeTelemetryKeySet.has(dataKey)) {
        return {
          isReady: false,
          title: 'Hardware not ready',
          message: 'Connect the device, run the verified Arduino code, upload it successfully, and wait for the required data key to appear.',
        }
      }
    }

    return { isReady: true }
  }, [
    dashboardRuntimeError,
    dashboardRuntimeTelemetryKeySet,
    isDashboardConnectionDetecting,
    isDashboardEditMode,
    isDashboardHardwareUnavailable,
    isDashboardRuntimeChecking,
    selectedDashboardDeviceThingsBoardId,
    selectedDashboardInternalDeviceId,
  ])

  useEffect(() => {
    if (!selectedDashboardInternalDeviceId || isDashboardEditMode) {
      setDashboardRuntimeTelemetryKeys([])
      setDashboardRuntimeError('')
      setIsDashboardRuntimeChecking(false)
      return
    }

    let isMounted = true
    let intervalId = null

    const loadRuntimeTelemetryKeys = async (showLoading = false) => {
      if (showLoading) {
        setIsDashboardRuntimeChecking(true)
      }

      try {
        const data = await fetchDeviceLatestTelemetry(selectedDashboardInternalDeviceId)
        const keys = [
          ...new Set(
            (Array.isArray(data.telemetry) ? data.telemetry : [])
              .map((row) => String(row.key || '').trim())
              .filter(Boolean)
          ),
        ]

        if (!isMounted) return

        setDashboardRuntimeTelemetryKeys(keys)
        setDashboardRuntimeError('')
      } catch (error) {
        if (!isMounted) return

        setDashboardRuntimeTelemetryKeys([])
        setDashboardRuntimeError(
          error instanceof TypeError || error.message === 'Failed to fetch'
            ? 'Unable to check the device right now. Please check the server, hardware connection, and ThingsBoard connection.'
            : error.message || 'Unable to check the hardware status right now.'
        )
      } finally {
        if (isMounted) {
          setIsDashboardRuntimeChecking(false)
        }
      }
    }

    void loadRuntimeTelemetryKeys(true)

    intervalId = window.setInterval(() => {
      void loadRuntimeTelemetryKeys(false)
    }, 10000)

    return () => {
      isMounted = false
      window.clearInterval(intervalId)
    }
  }, [
    selectedDashboardInternalDeviceId,
    selectedDashboardView?.id,
    isDashboardEditMode,
  ])

  const isWidgetLibrarySearchDisabled =
    isDashboardActionLoading ||
    (
      widgetLibrarySearchInput.trim().length === 0 &&
      appliedWidgetLibrarySearchQuery.length === 0
    )

  const renderDashboardDropdown = ({
    field,
    label,
    value,
    options,
    error,
    disabled = false,
    icon,
  }) => {
    const isOpen = openDashboardDropdown === field
    const selectedOption = options.find((option) => String(option.value) === String(value))
    const displayValue = selectedOption?.label || ''

    return (
      <div className="dashboard-modal-field-group">
        <div className={`dashboard-custom-select ${isOpen ? 'open' : ''}`}>
          <button
            type="button"
            className={`dashboard-account-field dashboard-floating-field dashboard-dropdown-trigger ${isOpen ? 'dashboard-dropdown-trigger-open' : ''} ${disabled ? 'dashboard-dropdown-trigger-disabled' : ''} ${error ? 'dashboard-field-error-state' : ''}`}
            onClick={() => {
              if (disabled) return
              setOpenDashboardDropdown((current) => (current === field ? '' : field))
            }}
            disabled={disabled}
            aria-expanded={isOpen}
          >
            <span className="dashboard-account-field-icon" aria-hidden="true">
              {icon}
            </span>

            <span className="dashboard-floating-control dashboard-dropdown-control">
              <span className={`dashboard-floating-label ${isOpen || displayValue ? 'dashboard-floating-label-static' : ''}`}>
                {label} <span className="dashboard-field-required">*</span>
              </span>

              <span className="dashboard-dropdown-value">
                {displayValue}
              </span>
            </span>

            <span className="dashboard-dropdown-arrow" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                {isOpen ? <path d="M6 14l6-6 6 6" /> : <path d="M6 10l6 6 6-6" />}
              </svg>
            </span>
          </button>

          <div className={`dashboard-dropdown-menu ${isOpen ? 'open' : ''}`}>
            {options.map((option) => (
              <button
                key={`${field}-${option.value}`}
                type="button"
                className={`dashboard-dropdown-option ${String(option.value) === String(value) ? 'active' : ''}`}
                onClick={() => {
                  handleDashboardFormChange(field, option.value)
                  setOpenDashboardDropdown('')
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="dashboard-modal-error-row">
            <span className="dashboard-modal-error-icon" aria-hidden="true">
              <ErrorIcon />
            </span>
            <span>{error}</span>
          </div>
        )}
      </div>
    )
  }

  const validateDashboardForm = () => {
    let isValid = true

    setDashboardNameError('')
    setLastNameError('')
    setFirstNameError('')
    setDeviceError('')

    if (!normalizedDashboardForm.dashboardName) {
      setDashboardNameError('Dashboard Name cannot be empty.')
      isValid = false
    } else if (normalizedDashboardForm.dashboardName.length > DASHBOARD_NAME_MAX_LENGTH) {
      setDashboardNameError(`Dashboard Name must not exceed ${DASHBOARD_NAME_MAX_LENGTH} characters.`)
      isValid = false
    } else {
      const hasDuplicate = dashboards.some((dashboard) => {
        if (editingDashboard && dashboard.id === editingDashboard.id) return false
        return String(dashboard.dashboardName || '').trim().toLowerCase() ===
          normalizedDashboardForm.dashboardName.toLowerCase()
      })

      if (hasDuplicate) {
        setDashboardNameError('This Dashboard Name already exists.')
        isValid = false
      }
    }

    if (!normalizedDashboardForm.lastName) {
      setLastNameError('Please select a last name.')
      isValid = false
    }

    if (!normalizedDashboardForm.firstName || !normalizedDashboardForm.assignedUserId) {
      setFirstNameError('Please select a first name.')
      isValid = false
    }

    if (!normalizedDashboardForm.deviceId) {
      setDeviceError('Please select a device.')
      isValid = false
    }

    return isValid
  }

  const openAddDashboardModal = () => {
    const nextForm = getInitialDashboardForm()

    setDashboardModalMode('add')
    setEditingDashboard(null)
    setDashboardForm(nextForm)
    setSavedDashboardForm(nextForm)
    setDashboardNameError('')
    setLastNameError('')
    setFirstNameError('')
    setDeviceError('')
    setOpenDashboardDropdown('')
    setIsDashboardModalClosing(false)
    setIsDashboardModalOpen(true)
  }

  const openEditDashboardModal = (dashboard) => {
    const nextForm = {
      dashboardName: dashboard.dashboardName || '',
      lastName: dashboard.lastName || '',
      firstName: dashboard.firstName || '',
      assignedUserId: String(dashboard.assignedUserId || ''),
      deviceId: String(dashboard.deviceId || ''),
    }

    setDashboardModalMode('edit')
    setEditingDashboard(dashboard)
    setDashboardForm(nextForm)
    setSavedDashboardForm(nextForm)
    setDashboardNameError('')
    setLastNameError('')
    setFirstNameError('')
    setDeviceError('')
    setOpenDashboardDropdown('')
    setIsDashboardModalClosing(false)
    setIsDashboardModalOpen(true)
  }

  const closeDashboardModal = async () => {
    if (isDashboardModalClosing) return

    setIsDashboardModalClosing(true)

    await new Promise((resolve) => setTimeout(resolve, DASHBOARD_MODAL_TRANSITION_MS))

    setOpenDashboardDropdown('')
    setIsDashboardModalOpen(false)
    setIsDashboardModalClosing(false)
    setDashboardModalMode('add')
    setEditingDashboard(null)
    setDashboardForm(getInitialDashboardForm())
    setSavedDashboardForm(getInitialDashboardForm())
    setDashboardNameError('')
    setLastNameError('')
    setFirstNameError('')
    setDeviceError('')
  }

  const handleDashboardFormChange = (field, value) => {
    if (field === 'dashboardName') {
      setOpenDashboardDropdown('')
    }

    setDashboardForm((prev) => {
      if (field === 'lastName') {
        return {
          ...prev,
          lastName: value,
          firstName: '',
          assignedUserId: '',
        }
      }

      if (field === 'firstName') {
        const selectedUser = dashboardUsers.find(
          (item) =>
            String(item.lastName || '').trim() === prev.lastName &&
            String(item.firstName || '').trim() === value
        )

        return {
          ...prev,
          firstName: value,
          assignedUserId: selectedUser ? String(selectedUser.id) : '',
        }
      }

      return {
        ...prev,
        [field]: value,
      }
    })

    if (field === 'dashboardName') setDashboardNameError('')
    if (field === 'lastName') {
      setLastNameError('')
      setFirstNameError('')
    }
    if (field === 'firstName') setFirstNameError('')
    if (field === 'deviceId') setDeviceError('')
  }

  const showDashboardStatusAlert = async ({ type, title, message }) => {
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
          <p class="auth-swal-message">${message}</p>
        </div>
      `,
      timer: 2600,
      showConfirmButton: false,
      showCancelButton: false,
      showCloseButton: false,
      buttonsStyling: false,
      allowOutsideClick: true,
      allowEscapeKey: true,
      customClass: {
        popup: 'auth-swal-popup',
        htmlContainer: 'auth-swal-html',
      },
    })
  }

  const confirmDashboardAction = async ({ title, text }) =>
    Swal.fire({
      title,
      text,
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

  const resetDashboardViewDraftChanges = () => {
    setDraftDashboardWidgets(savedDashboardWidgets)
    setIsDashboardEditMode(false)
    setHasDashboardViewChanges(false)
  }

  const confirmLeaveDashboardView = async ({
    title = 'Discard Changes?',
    text = 'You have unsaved dashboard changes. Are you sure you want to discard them?',
  } = {}) => {
    if (!selectedDashboardView || !isDashboardEditMode) {
      return true
    }

    if (!hasDashboardViewChanges) {
      resetDashboardViewDraftChanges()
      return true
    }

    const confirmation = await confirmDashboardAction({
      title,
      text,
    })

    if (!confirmation.isConfirmed) {
      return false
    }

    resetDashboardViewDraftChanges()
    return true
  }

  const handleEnterDashboardEditMode = () => {
    if (isDashboardActionLoading) return

    closeDropdowns()
    setIsDashboardEditMode(true)
  }

  const handleCancelDashboardEditMode = async () => {
    if (isDashboardActionLoading) return

    await confirmLeaveDashboardView({
      title: 'Cancel Editing?',
      text: 'You have unsaved dashboard changes. If you cancel, your latest changes will not be saved.',
    })
  }

  const handleSaveDashboardViewChanges = async () => {
    if (isDashboardActionLoading || !hasDashboardViewChanges || !selectedDashboardView?.id) return

    const confirmation = await confirmDashboardAction({
      title: 'Save Dashboard?',
      text: 'Are you sure you want to save your dashboard changes?',
    })

    if (!confirmation.isConfirmed) return

    setDashboardActionLoadingTitle('Saving Dashboard')
    setIsDashboardActionLoading(true)

    try {
      const widgetsPayload = draftDashboardWidgets.map(normalizeDashboardWidgetForSave)

      const [data] = await Promise.all([
        saveDashboardWidgets(selectedDashboardView.id, widgetsPayload),
        new Promise((resolve) => window.setTimeout(resolve, 680)),
      ])

      const nextWidgets = getUniqueDashboardWidgets(
        Array.isArray(data.widgets) ? data.widgets : []
      )

      setSavedDashboardWidgets(nextWidgets)
      setDraftDashboardWidgets(nextWidgets)
      setHasDashboardViewChanges(false)
      setIsDashboardEditMode(false)

      await showDashboardStatusAlert({
        type: 'success',
        title: 'Dashboard Saved',
        message: 'The dashboard widgets have been saved successfully.',
      })
    } catch (error) {
      await showDashboardStatusAlert({
        type: 'error',
        title: 'Save Failed',
        message: error.message || 'Something went wrong while saving the dashboard widgets.',
      })
    } finally {
      setIsDashboardActionLoading(false)
    }
  }

  const handleDashboardGridLayoutChange = (currentLayout = []) => {
    if (!isDashboardEditMode) return

    setDraftDashboardWidgets((prev) => {
      const nextWidgets = prev.map((widget) => {
        const widgetId = getDashboardWidgetIdentity(widget)
        const matchedLayout = currentLayout.find((layoutItem) => layoutItem.i === widgetId)

        if (!matchedLayout) return widget

        return {
          ...widget,
          layout: {
            x: matchedLayout.x,
            y: matchedLayout.y,
            w: matchedLayout.w,
            h: matchedLayout.h,
          },
        }
      })

      return areDashboardWidgetListsEqual(prev, nextWidgets) ? prev : nextWidgets
    })
  }

  const handleOpenWidgetLibraryModal = async () => {
    if (isDashboardActionLoading) return

    setWidgetLibrarySearchInput('')
    setAppliedWidgetLibrarySearchQuery('')
    setDashboardActionLoadingTitle('Loading Widgets')
    setIsDashboardActionLoading(true)

    await new Promise((resolve) => window.setTimeout(resolve, 520))

    setIsDashboardActionLoading(false)
    setIsWidgetLibraryModalClosing(false)
    setIsWidgetLibraryModalOpen(true)
  }

  const handleCloseWidgetLibraryModal = async () => {
    if (isWidgetLibraryModalClosing) return

    setIsWidgetLibraryModalClosing(true)

    await new Promise((resolve) =>
      window.setTimeout(resolve, DASHBOARD_WIDGET_LIBRARY_MODAL_TRANSITION_MS)
    )

    setIsWidgetLibraryModalOpen(false)
    setIsWidgetLibraryModalClosing(false)
    setWidgetLibrarySearchInput('')
    setAppliedWidgetLibrarySearchQuery('')
  }

  const handleWidgetLibrarySearchSubmit = (event) => {
    event.preventDefault()

    const nextSearchQuery = widgetLibrarySearchInput.trim()

    if (!nextSearchQuery && !appliedWidgetLibrarySearchQuery) return

    setAppliedWidgetLibrarySearchQuery(nextSearchQuery)
  }

  const loadDashboardTelemetryKeys = async () => {
    if (!selectedDashboardView?.deviceId) {
      setDashboardTelemetryKeys([])
      return
    }

    try {
      const data = await fetchDeviceLatestTelemetry(selectedDashboardView.deviceId)
      const rows = Array.isArray(data.telemetry) ? data.telemetry : []
      const keys = [...new Set(rows.map((row) => row.key).filter(Boolean))]

      setDashboardTelemetryKeys(keys)
    } catch (error) {
      console.error('DASHBOARD TELEMETRY KEYS ERROR:', error)
      setDashboardTelemetryKeys([])
    }
  }

  const handleSelectDashboardWidget = async (widgetTemplate) => {
    if (!widgetTemplate || isDashboardActionLoading) return

    await handleCloseWidgetLibraryModal()

    const nextSetupForm = getInitialWidgetSetupForm()

    setSelectedWidgetType(widgetTemplate)
    setEditingDashboardWidget(null)
    setWidgetSetupForm(nextSetupForm)
    setSavedWidgetSetupForm(nextSetupForm)
    setWidgetSetupError('')
    setWidgetSetupCheckStatus('idle')
    setWidgetSetupCheckMessage('')
    setDashboardTelemetryKeys([])
    setIsWidgetDataKeyDropdownOpen(false)
    setIsWidgetSetupModalClosing(false)
    setIsWidgetSetupModalOpen(true)

    await loadDashboardTelemetryKeys()
  }

  const closeWidgetSetupModal = async () => {
    if (isWidgetSetupModalClosing || isWidgetChecking || isWidgetSetupLoading) return

    setIsWidgetSetupModalClosing(true)

    await new Promise((resolve) =>
      window.setTimeout(resolve, DASHBOARD_WIDGET_LIBRARY_MODAL_TRANSITION_MS)
    )

    setIsWidgetSetupModalOpen(false)
    setIsWidgetSetupModalClosing(false)
    setSelectedWidgetType(null)
    setEditingDashboardWidget(null)
    setWidgetSetupForm(getInitialWidgetSetupForm())
    setSavedWidgetSetupForm(getInitialWidgetSetupForm())
    setWidgetSetupError('')
    setWidgetSetupCheckStatus('idle')
    setWidgetSetupCheckMessage('')
    setDashboardTelemetryKeys([])
    setIsWidgetDataKeyDropdownOpen(false)
  }

  const hideWidgetSetupModalTemporarily = async () => {
    setIsWidgetSetupModalClosing(true)

    await new Promise((resolve) =>
      window.setTimeout(resolve, DASHBOARD_WIDGET_LIBRARY_MODAL_TRANSITION_MS)
    )

    setIsWidgetSetupModalOpen(false)
    setIsWidgetSetupModalClosing(false)
  }

  const handleWidgetFileChange = async (event) => {
    const file = event.target.files?.[0]

    if (!file) return

    if (!file.name.toLowerCase().endsWith('.ino')) {
      event.target.value = ''
      setWidgetSetupError('Please upload an Arduino .ino file only.')
      setWidgetSetupCheckStatus('idle')
      setWidgetSetupCheckMessage('')
      return
    }

    const fileContent = await file.text()

    setWidgetSetupForm((prev) => ({
      ...prev,
      inoFileName: file.name,
      inoFileContent: fileContent,
    }))

    setWidgetSetupError('')
    setWidgetSetupCheckStatus('idle')
    setWidgetSetupCheckMessage('')
  }

  const hasWidgetSetupChanges =
    JSON.stringify(widgetSetupForm) !== JSON.stringify(savedWidgetSetupForm)

  const normalizedWidgetSetupForm = {
    widgetName: widgetSetupForm.widgetName.trim(),
    dataKey: widgetSetupForm.dataKey.trim(),
    inoFileName: widgetSetupForm.inoFileName.trim(),
    inoFileContent: widgetSetupForm.inoFileContent.trim(),
  }

  const selectedWidgetRequiresCompatibility =
    selectedWidgetType
      ? !DASHBOARD_WIDGET_OPTIONAL_DATA_KEY.has(selectedWidgetType.id)
      : true

  const canCheckWidgetCompatibility =
    Boolean(selectedWidgetType) &&
    Boolean(normalizedWidgetSetupForm.widgetName) &&
    (!selectedWidgetRequiresCompatibility || Boolean(normalizedWidgetSetupForm.dataKey)) &&
    (!selectedWidgetRequiresCompatibility ||
      (Boolean(normalizedWidgetSetupForm.inoFileName) &&
        Boolean(normalizedWidgetSetupForm.inoFileContent))) &&
    !isWidgetChecking &&
    !isWidgetSetupLoading

  const canSubmitWidgetSetup =
    hasWidgetSetupChanges &&
    widgetSetupCheckStatus === 'success' &&
    !isWidgetChecking &&
    !isWidgetSetupLoading

  const handleCheckWidgetCompatibility = async () => {
    if (!canCheckWidgetCompatibility || !selectedDashboardView?.id || !selectedWidgetType) return

    setIsWidgetChecking(true)
    setWidgetSetupError('')
    setWidgetSetupCheckStatus('checking')
    setWidgetSetupCheckMessage('Checking widget compatibility...')

    await hideWidgetSetupModalTemporarily()

    setDashboardActionLoadingTitle('Checking Compatibility')
    setIsDashboardActionLoading(true)

    try {
      const [result] = await Promise.all([
        validateDashboardWidget(selectedDashboardView.id, {
          widgetKey: selectedWidgetType.id,
          widgetName: normalizedWidgetSetupForm.widgetName,
          dataKey: normalizedWidgetSetupForm.dataKey,
          inoFileName: normalizedWidgetSetupForm.inoFileName,
          inoFileContent: widgetSetupForm.inoFileContent,
        }),
        new Promise((resolve) => window.setTimeout(resolve, 850)),
      ])

      const isCompatible = result.isCompatible === true || result.status === 'success'

      setWidgetSetupCheckStatus(isCompatible ? 'success' : 'failed')
      setWidgetSetupCheckMessage(
        result.message ||
          (isCompatible
            ? 'Widget is compatible with the selected device.'
            : 'Widget is not compatible with the selected device.')
      )
    } catch (error) {
      setWidgetSetupCheckStatus('failed')
      setWidgetSetupCheckMessage(error.message || 'Widget compatibility check failed.')
    } finally {
      setIsDashboardActionLoading(false)
      setIsWidgetChecking(false)
      setIsWidgetSetupModalClosing(false)
      setIsWidgetSetupModalOpen(true)
    }
  }

  const getNextWidgetLayout = (widgetKey) => {
    const defaultLayout = DASHBOARD_WIDGET_DEFAULT_LAYOUTS[widgetKey] || { w: 6, h: 8 }

    return {
      x: 0,
      y: Infinity,
      ...defaultLayout,
    }
  }

  const handleSubmitWidgetSetup = async () => {
    if (!canSubmitWidgetSetup || !selectedWidgetType) return

    setIsWidgetSetupLoading(true)

    await closeWidgetSetupModal()

    setDashboardActionLoadingTitle(editingDashboardWidget ? 'Updating Widget' : 'Adding Widget')
    setIsDashboardActionLoading(true)

    await new Promise((resolve) => window.setTimeout(resolve, 680))

    const nextWidget = {
      ...(editingDashboardWidget || {}),
      clientId: editingDashboardWidget?.clientId || createDashboardWidgetClientId(),
      widgetKey: selectedWidgetType.id,
      widgetType: selectedWidgetType.type,
      widgetName: widgetSetupForm.widgetName.trim(),
      dataKey: widgetSetupForm.dataKey.trim(),
      inoFileName: widgetSetupForm.inoFileName.trim(),
      validationStatus: 'success',
      validationMessage: widgetSetupCheckMessage,
      layout: editingDashboardWidget?.layout || getNextWidgetLayout(selectedWidgetType.id),
      settings: editingDashboardWidget?.settings || {},
    }

    setDraftDashboardWidgets((prev) =>
      editingDashboardWidget
        ? prev.map((item) =>
            getDashboardWidgetIdentity(item) === getDashboardWidgetIdentity(editingDashboardWidget)
              ? nextWidget
              : item
          )
        : [...prev, nextWidget]
    )

    setIsDashboardActionLoading(false)
    setIsWidgetSetupLoading(false)
  }

  const handleEditDashboardWidget = async (widget) => {
    const widgetType = DASHBOARD_AVAILABLE_WIDGETS.find((item) => item.id === widget.widgetKey)

    if (!widgetType) return

    setSelectedWidgetType(widgetType)
    setEditingDashboardWidget(widget)
    setWidgetSetupForm({
      widgetName: widget.widgetName || widgetType.name,
      dataKey: widget.dataKey || '',
      inoFileName: widget.inoFileName || '',
      inoFileContent: '',
    })
    setSavedWidgetSetupForm({
      widgetName: widget.widgetName || widgetType.name,
      dataKey: widget.dataKey || '',
      inoFileName: widget.inoFileName || '',
      inoFileContent: '',
    })
    setWidgetSetupError('')
    setWidgetSetupCheckStatus('success')
    setWidgetSetupCheckMessage(widget.validationMessage || 'Widget is ready to update.')
    setIsWidgetDataKeyDropdownOpen(false)
    setIsWidgetSetupModalClosing(false)
    setIsWidgetSetupModalOpen(true)

    await loadDashboardTelemetryKeys()
  }

  const handleDeleteDashboardWidget = async (widget) => {
    if (!widget || isDashboardActionLoading) return

    const confirmation = await confirmDashboardAction({
      title: 'Delete Widget?',
      text: `Are you sure you want to delete "${widget.widgetName}" from this dashboard?`,
    })

    if (!confirmation.isConfirmed) return

    const targetWidgetId = getDashboardWidgetIdentity(widget)

    setDraftDashboardWidgets((prev) =>
      prev.filter((item) => getDashboardWidgetIdentity(item) !== targetWidgetId)
    )
  }

  const handleDashboardPageNavigate = async (page) => {
    if (isDashboardActionLoading) return

    const canLeaveDashboardView = await confirmLeaveDashboardView({
      title: 'Discard Changes?',
      text: 'You have unsaved dashboard changes. If you leave this page, your latest changes will not be saved.',
    })

    if (!canLeaveDashboardView) return

    clearStoredSelectedDashboardView()
    setSelectedDashboardView(null)
    setIsDashboardEditMode(false)
    setHasDashboardViewChanges(false)
    closeDropdowns()
    onNavigate(page)
  }

  const handleSubmitDashboard = async () => {
    if (!canSubmitDashboard) return
    if (!validateDashboardForm()) return

    const isEditMode = dashboardModalMode === 'edit'
    const draftForm = dashboardForm
    const draftEditingDashboard = editingDashboard

    await closeDashboardModal()

    const confirmation = await confirmDashboardAction({
      title: isEditMode ? 'Edit Dashboard?' : 'Add Dashboard?',
      text: isEditMode
        ? `Are you sure you want to save changes to "${draftEditingDashboard?.dashboardName}"?`
        : `Are you sure you want to add "${normalizedDashboardForm.dashboardName}"?`,
    })

    if (!confirmation.isConfirmed) {
      if (isEditMode && draftEditingDashboard) {
        openEditDashboardModal({
          ...draftEditingDashboard,
          dashboardName: draftForm.dashboardName,
          firstName: draftForm.firstName,
          lastName: draftForm.lastName,
          assignedUserId: draftForm.assignedUserId,
          deviceId: draftForm.deviceId,
        })
      } else {
        setDashboardModalMode('add')
        setEditingDashboard(null)
        setDashboardForm(draftForm)
        setSavedDashboardForm(getInitialDashboardForm())
        setIsDashboardModalClosing(false)
        setIsDashboardModalOpen(true)
      }

      return
    }

    setDashboardActionLoadingTitle(isEditMode ? 'Updating Dashboard' : 'Adding Dashboard')
    setIsDashboardActionLoading(true)

    try {
      const payload = {
        dashboardName: normalizedDashboardForm.dashboardName,
        assignedUserId: Number(normalizedDashboardForm.assignedUserId),
        deviceId: Number(normalizedDashboardForm.deviceId),
      }

      const [data] = await Promise.all([
        isEditMode
          ? updateDashboard(draftEditingDashboard.id, payload)
          : createDashboard(payload),
        new Promise((resolve) => window.setTimeout(resolve, 680)),
      ])

      setDashboards((prev) =>
        isEditMode
          ? prev.map((item) => (item.id === draftEditingDashboard.id ? data.dashboard : item))
          : [data.dashboard, ...prev]
      )

      await showDashboardStatusAlert({
        type: 'success',
        title: isEditMode ? 'Dashboard Updated' : 'Dashboard Added',
        message: isEditMode
          ? 'The dashboard has been updated successfully.'
          : 'The dashboard has been added successfully.',
      })
    } catch (error) {
      await showDashboardStatusAlert({
        type: 'error',
        title: isEditMode ? 'Update Failed' : 'Add Failed',
        message: error.message || 'Something went wrong. Please try again.',
      })
    } finally {
      setIsDashboardActionLoading(false)
    }
  }

  const handleDeleteDashboard = async (dashboard) => {
    if (isDashboardActionLoading) return

    const confirmation = await confirmDashboardAction({
      title: 'Delete Dashboard?',
      text: `Are you sure you want to delete "${dashboard.dashboardName}"?`,
    })

    if (!confirmation.isConfirmed) return

    setDashboardActionLoadingTitle('Deleting Dashboard')
    setIsDashboardActionLoading(true)

    try {
      await Promise.all([
        deleteDashboardById(dashboard.id),
        new Promise((resolve) => window.setTimeout(resolve, 680)),
      ])

      setDashboards((prev) => prev.filter((item) => item.id !== dashboard.id))

      await showDashboardStatusAlert({
        type: 'success',
        title: 'Dashboard Deleted',
        message: 'The dashboard has been deleted successfully.',
      })
    } catch (error) {
      await showDashboardStatusAlert({
        type: 'error',
        title: 'Delete Failed',
        message: error.message || 'Something went wrong while deleting the dashboard.',
      })
    } finally {
      setIsDashboardActionLoading(false)
    }
  }

  const handleLogout = async (e) => {
    e.preventDefault()
    e.stopPropagation()

    const result = await Swal.fire({
      title: 'Log Out?', text: 'Are you sure you want to log out?', icon: 'question',
      showCancelButton: true, confirmButtonText: 'Yes', cancelButtonText: 'No',
      reverseButtons: true, buttonsStyling: false, allowOutsideClick: true, allowEscapeKey: true,
      customClass: {
        popup: 'avinya-swal-popup', icon: 'avinya-swal-icon', title: 'avinya-swal-title',
        htmlContainer: 'avinya-swal-text', actions: 'avinya-swal-actions',
        confirmButton: 'avinya-swal-confirm', cancelButton: 'avinya-swal-cancel',
      },
    })

    if (!result.isConfirmed) return

    Swal.close()

    const canLeaveDashboardView = await confirmLeaveDashboardView({
      title: 'Discard Changes?',
      text: 'You have unsaved dashboard changes. If you log out, your latest changes will not be saved.',
    })

    if (!canLeaveDashboardView) return

    closeDropdowns()
    clearStoredSelectedDashboardView()
    setSelectedDashboardView(null)
    setIsDashboardEditMode(false)
    setHasDashboardViewChanges(false)

    performReliableLogout(onLogout)
  }

  return (
    <main className="dashboard-page dashboard-home-page">
      <aside className={`dashboard-sidebar ${isSidebarCollapsed ? 'collapsed' : ''}`}>
        <div className="dashboard-sidebar-panel">
          <div className="dashboard-sidebar-header">
            <div className="dashboard-sidebar-top">
              <img src={logo} alt="Avinya Logo" className="dashboard-sidebar-logo" />
              <span className="dashboard-sidebar-brand">AVINYA</span>
            </div>
            <button type="button" className="dashboard-sidebar-collapse" onClick={() => { if (!isSidebarCollapsed) closeDropdowns(); setIsSidebarCollapsed(p => !p) }}
              aria-label={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                {isSidebarCollapsed ? <path d="M9 6l6 6-6 6" /> : <path d="M15 6l-6 6 6 6" />}
              </svg>
            </button>
          </div>

          <nav className="dashboard-sidebar-nav">
            <button type="button" className="dashboard-sidebar-link active" data-tooltip="Dashboard" aria-current="page">
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
                <button type="button" className="dashboard-sidebar-sublink" onClick={() => void handleDashboardPageNavigate('devices')}>
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
              <button type="button" className="dashboard-sidebar-link" data-tooltip="Users" onClick={() => void handleDashboardPageNavigate('users')}>
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
              <button type="button" className="dashboard-sidebar-link" data-tooltip="Logs" onClick={() => void handleDashboardPageNavigate('logs')}>
                <span className="dashboard-sidebar-link-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                  </svg>
                </span>
                <span className="dashboard-sidebar-link-label">Logs</span>
              </button>
            )}
          </nav>

          <div className="dashboard-sidebar-footer">
            <button type="button" className={`dashboard-sidebar-theme ${isDarkMode ? 'active' : ''}`}
              onClick={onThemeToggle} aria-label={isDarkMode ? 'Turn off dark mode' : 'Turn on dark mode'}
              aria-pressed={isDarkMode} data-tooltip={isDarkMode ? 'Light Mode' : 'Dark Mode'}>
              <span className="dashboard-sidebar-theme-icon" aria-hidden="true">
                {isDarkMode ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="4" /><path d="M12 2v2" /><path d="M12 20v2" />
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
                  {sidebarProfileImagePreview
                    ? <img src={sidebarProfileImagePreview} alt="" className="dashboard-sidebar-user-avatar-image" />
                    : <div className="dashboard-sidebar-user-avatar-fallback">
                        <span className="dashboard-sidebar-user-avatar-fallback-text">{sidebarUserInitials}</span>
                      </div>
                  }
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
                <button type="button" className="dashboard-sidebar-user-menu-item"
                  onClick={() => void handleDashboardPageNavigate('account')}>
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
          <div className="dashboard-page-title-row">
            <h1 className="dashboard-content-title">
              {selectedDashboardView ? selectedDashboardView.dashboardName : 'Dashboard'}
            </h1>
          </div>

          {selectedDashboardView ? (
              <section className={`dashboard-view-panel ${!isAdministrator ? 'dashboard-user-view-panel' : ''}`}>
                {isAdministrator && (
                  <div className="dashboard-view-toolbar">
                    <button
                      type="button"
                      className="dashboard-view-back-button"
                      onClick={() => void handleBackToDashboardList()}
                      disabled={isDashboardActionLoading}
                    >
                      <span className="dashboard-view-button-icon" aria-hidden="true">
                        <BackDashboardIcon />
                      </span>
                      Back
                    </button>

                    <div className="dashboard-view-actions">
                      {isDashboardEditMode ? (
                        <>
                          <button
                            type="button"
                            className="dashboard-add-widget-button dashboard-add-widget-button-inline"
                            onClick={() => void handleOpenWidgetLibraryModal()}
                            disabled={isDashboardActionLoading}
                          >
                            <span className="dashboard-view-button-icon" aria-hidden="true">
                              <AddWidgetIcon />
                            </span>
                            Add Widget
                          </button>

                          <button
                            type="button"
                            className="dashboard-view-edit-mode-button dashboard-view-secondary-button"
                            onClick={() => void handleCancelDashboardEditMode()}
                            disabled={isDashboardActionLoading}
                          >
                            <span className="dashboard-view-button-icon" aria-hidden="true">
                              <CancelEditIcon />
                            </span>
                            Cancel
                          </button>

                          <button
                            type="button"
                            className="dashboard-view-edit-mode-button dashboard-view-save-button"
                            onClick={() => void handleSaveDashboardViewChanges()}
                            disabled={isDashboardActionLoading || !hasDashboardViewChanges}
                          >
                            <span className="dashboard-view-button-icon" aria-hidden="true">
                              <SaveIcon />
                            </span>
                            Save
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          className="dashboard-view-edit-mode-button"
                          onClick={handleEnterDashboardEditMode}
                          disabled={isDashboardActionLoading}
                        >
                          <span className="dashboard-view-button-icon" aria-hidden="true">
                            <EditModeIcon />
                          </span>
                          Edit Mode
                        </button>
                      )}
                    </div>
                  </div>
                )}

                <div className={`dashboard-widget-grid-shell ${!isAdministrator ? 'dashboard-user-widget-shell' : ''} ${isDashboardEditMode ? 'editing' : ''}`}>
                  {isDashboardEditMode && (
                    <div className="dashboard-widget-grid-pattern" aria-hidden="true" />
                  )}

                  {isDashboardWidgetsLoading ? (
                    <div className="dashboard-view-empty-state dashboard-view-empty-state-loading">
                      <span className="dashboard-view-loading-spinner" aria-hidden="true"></span>
                      <p>Loading widgets...</p>
                    </div>
                  ) : dashboardWidgetsToDisplay.length === 0 && !isDashboardEditMode ? (
                    <div className="dashboard-view-empty-state">
                      <div className="dashboard-view-empty-icon" aria-hidden="true">
                        <DashboardWidgetIcon />
                      </div>
                      <h2>No widgets displayed yet</h2>
                      <p>
                        {isAdministrator
                          ? 'Enter edit mode and add widgets to start monitoring this dashboard.'
                          : 'This dashboard has no widgets yet.'}
                      </p>
                    </div>
                  ) : dashboardWidgetsToDisplay.length === 0 && isDashboardEditMode ? (
                    null
                  ) : (
                    <ResponsiveGridLayout
                      className={`dashboard-widget-grid ${!isAdministrator ? 'dashboard-user-widget-grid' : ''}`}
                      cols={DASHBOARD_GRID_COLS}
                      rowHeight={DASHBOARD_GRID_ROW_HEIGHT}
                      margin={DASHBOARD_GRID_MARGIN}
                      containerPadding={DASHBOARD_GRID_CONTAINER_PADDING}
                      isDraggable={isDashboardEditMode}
                      isResizable={isDashboardEditMode}
                      compactType="vertical"
                      preventCollision={false}
                      draggableHandle=".dashboard-widget-drag-handle"
                      resizeHandles={['se']}
                      useCSSTransforms
                      onLayoutChange={handleDashboardGridLayoutChange}
                    >
                      {dashboardWidgetsToDisplay.map((widget) => {
                        const WidgetComponent = DASHBOARD_WIDGET_COMPONENTS[widget.widgetKey]
                        const widgetId = getDashboardWidgetIdentity(widget)
                        const runtimeStatus = getDashboardWidgetRuntimeStatus(widget)

                        return (
                          <div
                            key={widgetId}
                            data-grid={{
                              i: widgetId,
                              x: Number(widget.layout?.x || 0),
                              y: Number(widget.layout?.y || 0),
                              w: Number(widget.layout?.w || 6),
                              h: Number(widget.layout?.h || 8),
                              ...getDashboardWidgetLayoutLimits(widget.widgetKey),
                            }}
                            className={`dashboard-widget-frame ${!isAdministrator ? 'dashboard-user-widget-frame' : ''} ${isDashboardEditMode ? 'editing' : ''}`}
                          >
                            {isDashboardEditMode && (
                              <div className="dashboard-widget-edit-toolbar">
                                <button
                                  type="button"
                                  className="dashboard-widget-move-icon-button dashboard-widget-drag-handle"
                                  title="Move widget"
                                  aria-label="Move widget"
                                >
                                  <MoveWidgetIcon />
                                </button>

                                <div className="dashboard-widget-edit-actions">
                                  <button
                                    type="button"
                                    className="dashboard-widget-edit-btn"
                                    onClick={() => handleEditDashboardWidget(widget)}
                                  >
                                    Edit
                                  </button>

                                  <button
                                    type="button"
                                    className="dashboard-widget-delete-btn"
                                    onClick={() => void handleDeleteDashboardWidget(widget)}
                                  >
                                    Delete
                                  </button>
                                </div>
                              </div>
                            )}

                            {isDashboardEditMode ? (
                              <DashboardWidgetEditPreview widget={widget} />
                            ) : WidgetComponent ? (
                              !runtimeStatus.isReady ? (
                                <DashboardWidgetHardwareNotice
                                  title={runtimeStatus.title}
                                  message={runtimeStatus.message}
                                  isChecking={runtimeStatus.isChecking}
                                />
                              ) : (
                                <WidgetComponent
                                  title={widget.widgetName}
                                  dataKey={widget.dataKey}
                                  telemetryKey={widget.dataKey}
                                  label={widget.widgetName}
                                  deviceId={selectedDashboardDeviceThingsBoardId}
                                  deviceName={selectedDashboardView.deviceName}
                                  dashboardDeviceId={selectedDashboardInternalDeviceId}
                                  readOnly={shouldRenderDashboardWidgetsReadOnly}
                                  allowEditing={!shouldRenderDashboardWidgetsReadOnly}
                                />
                              )
                            ) : (
                              <div className="dashboard-view-empty-state">Unsupported widget.</div>
                            )}
                          </div>
                        )
                      })}
                    </ResponsiveGridLayout>
                  )}
                </div>
              </section>
            ) : isAdministrator ? (
              <section className="dashboard-admin-panel">
                <div className="dashboard-list-toolbar">
                  <div className="dashboard-toolbar-top">
                    <div className="dashboard-filters-group" aria-label="Dashboard filters">
                      <DashboardFilterDropdown
                        id="dashboard-user-filter"
                        label="Assigned User"
                        icon={<FilterIcon />}
                        className="dashboard-list-filter-field-user"
                        value={dashboardUserFilter}
                        options={dashboardUserFilterOptions}
                        isOpen={openDashboardFilterDropdown === 'user'}
                        onToggle={() => handleDashboardFilterDropdownToggle('user')}
                        onSelect={handleDashboardUserFilterChange}
                        disabled={isDashboardToolbarDisabled}
                      />

                      <DashboardFilterDropdown
                        id="dashboard-device-filter"
                        label="Device"
                        icon={<DashboardDeviceFieldIcon />}
                        className="dashboard-list-filter-field-device"
                        value={dashboardDeviceFilter}
                        options={dashboardDeviceFilterOptions}
                        isOpen={openDashboardFilterDropdown === 'device'}
                        onToggle={() => handleDashboardFilterDropdownToggle('device')}
                        onSelect={handleDashboardDeviceFilterChange}
                        disabled={isDashboardToolbarDisabled}
                      />

                      <DashboardFilterDropdown
                        id="dashboard-sort-filter"
                        label="Sort By"
                        icon={<SortIcon />}
                        className="dashboard-list-filter-field-sort"
                        value={dashboardSortBy}
                        options={DASHBOARD_SORT_OPTIONS}
                        isOpen={openDashboardFilterDropdown === 'sort'}
                        onToggle={() => handleDashboardFilterDropdownToggle('sort')}
                        onSelect={handleDashboardSortByChange}
                        disabled={isDashboardToolbarDisabled}
                      />
                    </div>

                    <div className="dashboard-toolbar-actions">
                      <button
                        type="button"
                        className="dashboard-filter-reset-button"
                        onClick={handleDashboardResetFilters}
                        disabled={isDashboardToolbarDisabled || !hasDashboardListFilters}
                      >
                        Reset Filters
                      </button>

                      <button
                        type="button"
                        className="dashboard-add-btn dashboard-add-btn-toolbar"
                        onClick={openAddDashboardModal}
                        disabled={isDashboardToolbarDisabled}
                      >
                        <span className="dashboard-add-btn-icon" aria-hidden="true">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M12 5v14" />
                            <path d="M5 12h14" />
                          </svg>
                        </span>
                        Add Dashboard
                      </button>
                    </div>
                  </div>

                  <form className="dashboard-search-form" onSubmit={handleDashboardSearchSubmit}>
                    <label className="dashboard-search-field" htmlFor="dashboard-search-input">
                      <span className="dashboard-search-input-icon" aria-hidden="true">
                        <SearchIcon />
                      </span>

                      <span className="dashboard-search-floating-control">
                        <input
                          id="dashboard-search-input"
                          type="text"
                          className="dashboard-search-input dashboard-search-floating-input"
                          value={dashboardSearchInput}
                          onChange={handleDashboardSearchInputChange}
                          disabled={isDashboardToolbarDisabled}
                          placeholder=" "
                          autoComplete="off"
                        />

                        <span className="dashboard-search-floating-label">
                          Search
                        </span>
                      </span>
                    </label>

                    <button
                      type="submit"
                      className="dashboard-search-button"
                      disabled={isDashboardSearchDisabled}
                    >
                      <span className="dashboard-search-button-icon" aria-hidden="true">
                        <SearchIcon />
                      </span>
                      Search
                    </button>
                  </form>
                </div>

                {isDashboardLoading ? (
                  <div className="dashboard-list-empty-state" role="status" aria-live="polite">
                    <span className="dashboard-list-loading-spinner" aria-hidden="true"></span>
                  </div>
                ) : dashboardRequestError ? (
                  <div className="dashboard-list-empty-state dashboard-list-empty-state-error">
                    <div className="dashboard-list-empty-icon" aria-hidden="true">
                      <ErrorIcon />
                    </div>

                    <h2>Unable to load dashboards</h2>
                    <p>{dashboardRequestError}</p>

                    <button
                      type="button"
                      className="dashboard-list-empty-retry-btn"
                      onClick={() => void loadDashboardData()}
                    >
                      Retry
                    </button>
                  </div>
                ) : dashboards.length === 0 ? (
                  <div className="dashboard-list-empty-state">
                    <div className="dashboard-list-empty-icon" aria-hidden="true">
                      <DashboardWidgetIcon />
                    </div>

                    <h2>{hasDashboardListFilters ? 'No dashboards found' : 'No dashboards yet'}</h2>
                    <p>
                      {hasDashboardListFilters
                        ? 'Try changing your filters or search keyword.'
                        : 'Add a dashboard to start monitoring assigned devices.'}
                    </p>
                  </div>
                ) : (
                  <div className="dashboard-card-grid">
                    {dashboards.map((dashboard, index) => (
                      <article
                        key={dashboard.id}
                        className="dashboard-card dashboard-card-refined"
                        style={{ '--dashboard-card-delay': `${Math.min(index, 9) * 34}ms` }}
                      >
                        <div className="dashboard-card-main">
                          <div className="dashboard-card-icon" aria-hidden="true">
                            <UserIcon />
                          </div>

                          <div className="dashboard-card-title-group">
                            <h2 className="dashboard-card-title" title={dashboard.dashboardName}>
                              {dashboard.dashboardName}
                            </h2>
                            <p className="dashboard-card-subtitle" title={getDashboardOwnerDisplayName(dashboard)}>
                              {getDashboardOwnerDisplayName(dashboard)}
                            </p>
                          </div>

                          <div className="dashboard-card-actions dashboard-card-actions-compact">
                            <button
                              type="button"
                              className="dashboard-card-action dashboard-card-action-square dashboard-icon-action dashboard-card-view"
                              onClick={() => void handleOpenDashboardView(dashboard)}
                              disabled={isDashboardActionLoading}
                              aria-label="View dashboard"
                              data-dashboard-tooltip="View Dashboard"
                            >
                              <span className="dashboard-card-action-icon" aria-hidden="true">
                                <ViewDashboardIcon />
                              </span>
                            </button>

                            <button
                              type="button"
                              className="dashboard-card-action dashboard-card-action-square dashboard-icon-action dashboard-card-edit"
                              onClick={() => openEditDashboardModal(dashboard)}
                              disabled={isDashboardActionLoading}
                              aria-label="Edit dashboard"
                              data-dashboard-tooltip="Edit"
                            >
                              <span className="dashboard-card-action-icon" aria-hidden="true">
                                <EditIcon />
                              </span>
                            </button>

                            <button
                              type="button"
                              className="dashboard-card-action dashboard-card-action-square dashboard-icon-action dashboard-card-delete"
                              onClick={() => void handleDeleteDashboard(dashboard)}
                              disabled={isDashboardActionLoading}
                              aria-label="Delete dashboard"
                              data-dashboard-tooltip="Delete"
                            >
                              <span className="dashboard-card-action-icon" aria-hidden="true">
                                <TrashIcon />
                              </span>
                            </button>
                          </div>
                        </div>

                        <div className="dashboard-card-device-pill">
                          <span className="dashboard-card-device-label">Assigned Device</span>
                          <span className="dashboard-card-device-value" title={dashboard.deviceName}>
                            {dashboard.deviceName}
                          </span>
                        </div>

                        <div className="dashboard-card-created-pill">
                          <span className="dashboard-card-created-label">Created At</span>
                          <span className="dashboard-card-created-value" title={formatDashboardCreatedAt(dashboard.createdAt)}>
                            {formatDashboardCreatedAt(dashboard.createdAt)}
                          </span>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            ) : (
              <section className="dashboard-view-panel">
                <div className="dashboard-widget-grid-shell">
                  {isDashboardLoading ? (
                    <div className="dashboard-view-empty-state dashboard-view-empty-state-loading">
                      <span className="dashboard-view-loading-spinner" aria-hidden="true"></span>
                      <p>Loading dashboard...</p>
                    </div>
                  ) : dashboardRequestError ? (
                    <div className="dashboard-view-empty-state dashboard-view-empty-state-error">
                      <div className="dashboard-view-empty-icon" aria-hidden="true">
                        <ErrorIcon />
                      </div>
                      <h2>Unable to load dashboard</h2>
                      <p>{dashboardRequestError}</p>
                    </div>
                  ) : (
                    <div className="dashboard-view-empty-state">
                      <div className="dashboard-view-empty-icon" aria-hidden="true">
                        <DashboardWidgetIcon />
                      </div>
                      <h2>No dashboard assigned yet</h2>
                      <p>Please wait for an administrator to assign a dashboard to your account.</p>
                    </div>
                  )}
                </div>
              </section>
            )}
        </div>
      </section>
      {(isDashboardActionLoading || isDashboardListTransitioning) && (
        <div className="dashboard-action-overlay" role="status" aria-live="polite" aria-busy="true">
          <div className="dashboard-action-card">
            <img src={logo} alt="Avinya Logo" className="dashboard-action-logo" />
            {(isDashboardActionLoading ? dashboardActionLoadingTitle : dashboardListLoadingTitle) && (
              <p className="dashboard-action-title">
                {isDashboardActionLoading ? dashboardActionLoadingTitle : dashboardListLoadingTitle}
              </p>
            )}
            <div className="dashboard-action-loader" aria-hidden="true">
              <span className="dashboard-action-loader-bar"></span>
            </div>
          </div>
        </div>
      )}

      {isWidgetLibraryModalOpen && (
        <div
          className={`dashboard-modal-backdrop ${isWidgetLibraryModalClosing ? 'dashboard-modal-closing' : ''}`}
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              void handleCloseWidgetLibraryModal()
            }
          }}
        >
          <div
            className={`dashboard-modal dashboard-widget-library-modal ${isWidgetLibraryModalClosing ? 'dashboard-modal-closing' : ''}`}
            role="dialog"
            onMouseDown={(event) => event.stopPropagation()}
            aria-modal="true"
            aria-labelledby="dashboard-widget-library-title"
          >
            <div className="dashboard-modal-header">
              <div>
                <h2 className="dashboard-modal-title" id="dashboard-widget-library-title">
                  Add Widget
                </h2>
                <p className="dashboard-widget-library-subtitle">
                  Select a widget type to add to this dashboard.
                </p>
              </div>

              <button
                type="button"
                className="dashboard-modal-close"
                onClick={() => void handleCloseWidgetLibraryModal()}
                aria-label="Close"
                disabled={isWidgetLibraryModalClosing}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="dashboard-modal-body dashboard-widget-library-body">
              <form className="dashboard-search-form dashboard-widget-search-form" onSubmit={handleWidgetLibrarySearchSubmit}>
                <label className="dashboard-search-field">
                  <span className="dashboard-search-input-icon" aria-hidden="true">
                    <SearchIcon />
                  </span>

                  <span className="dashboard-search-floating-control">
                    <input
                      type="search"
                      className="dashboard-search-input dashboard-search-floating-input"
                      value={widgetLibrarySearchInput}
                      onChange={(event) => setWidgetLibrarySearchInput(event.target.value)}
                      placeholder="Search widgets"
                      disabled={isDashboardActionLoading}
                    />
                    <span className="dashboard-search-floating-label">
                      Search Widgets
                    </span>
                  </span>
                </label>

                <button
                  type="submit"
                  className="dashboard-search-button"
                  disabled={isWidgetLibrarySearchDisabled}
                >
                  <span className="dashboard-search-button-icon" aria-hidden="true">
                    <SearchIcon />
                  </span>
                  Search
                </button>
              </form>

              <div className="dashboard-widget-library-grid">
                {filteredDashboardWidgets.length === 0 ? (
                  <div className="dashboard-widget-library-empty">
                    No matching widgets found.
                  </div>
                ) : (
                  filteredDashboardWidgets.map((widget, index) => (
                    <button
                      key={widget.id}
                      type="button"
                      className="dashboard-widget-library-card"
                      onClick={() => void handleSelectDashboardWidget(widget)}
                      style={{ '--dashboard-widget-delay': `${Math.min(index, 9) * 28}ms` }}
                    >
                      <span className="dashboard-widget-library-icon" aria-hidden="true">
                        <DashboardWidgetIcon />
                      </span>

                      <span className="dashboard-widget-library-content">
                        <span className="dashboard-widget-library-name">
                          {widget.name}
                        </span>
                        <span className="dashboard-widget-library-type">
                          {widget.type}
                        </span>
                        <span className="dashboard-widget-library-description">
                          {widget.description}
                        </span>
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {isWidgetSetupModalOpen && (
        <div
          className={`dashboard-modal-backdrop ${isWidgetSetupModalClosing ? 'dashboard-modal-closing' : ''}`}
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              void closeWidgetSetupModal()
            }
          }}
        >
          <div
            className={`dashboard-modal dashboard-widget-setup-modal ${isWidgetSetupModalClosing ? 'dashboard-modal-closing' : ''}`}
            role="dialog"
            onMouseDown={(event) => event.stopPropagation()}
            aria-modal="true"
            aria-labelledby="dashboard-widget-setup-title"
          >
            <div className="dashboard-modal-header">
              <div>
                <h2 className="dashboard-modal-title" id="dashboard-widget-setup-title">
                  {editingDashboardWidget ? 'Edit Widget' : 'Setup Widget'}
                </h2>
                <p className="dashboard-modal-subtitle">
                  Check compatibility before adding this widget.
                </p>
              </div>

              <button
                type="button"
                className="dashboard-modal-close"
                onClick={() => void closeWidgetSetupModal()}
                disabled={isWidgetChecking || isWidgetSetupLoading}
                aria-label="Close"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="dashboard-modal-body dashboard-widget-setup-body">
              <div className="dashboard-modal-field-group">
                <div className={`dashboard-account-field dashboard-floating-field ${widgetSetupError ? 'dashboard-field-error-state' : ''}`}>
                  <span className="dashboard-account-field-icon" aria-hidden="true">
                    <DashboardWidgetIcon />
                  </span>

                  <div className="dashboard-floating-control">
                    <input
                      id="dashboard-widget-name-input"
                      type="text"
                      className="dashboard-account-input dashboard-floating-input"
                      value={widgetSetupForm.widgetName}
                      onChange={(event) => {
                        setWidgetSetupForm((prev) => ({ ...prev, widgetName: event.target.value }))
                        setWidgetSetupCheckStatus('idle')
                        setWidgetSetupCheckMessage('')
                        setWidgetSetupError('')
                      }}
                      placeholder=" "
                      maxLength={80}
                    />

                    <label htmlFor="dashboard-widget-name-input" className="dashboard-floating-label">
                      Widget Name <span className="dashboard-field-required">*</span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="dashboard-modal-field-group">
                <div className={`dashboard-custom-select dashboard-widget-data-key-select ${isWidgetDataKeyDropdownOpen ? 'open' : ''}`}>
                  <button
                    type="button"
                    id="dashboard-widget-data-key-input"
                    className={`dashboard-account-field dashboard-floating-field dashboard-dropdown-trigger dashboard-widget-data-key-trigger ${isWidgetDataKeyDropdownOpen ? 'dashboard-dropdown-trigger-open' : ''}`}
                    onClick={() => {
                      setOpenDashboardDropdown('')
                      setIsWidgetDataKeyDropdownOpen((prev) => !prev)
                    }}
                    aria-haspopup="listbox"
                    aria-expanded={isWidgetDataKeyDropdownOpen}
                  >
                    <span className="dashboard-account-field-icon" aria-hidden="true">
                      <DashboardDataKeyFieldIcon />
                    </span>

                    <span className="dashboard-floating-control dashboard-dropdown-control">
                      <span className={`dashboard-floating-label ${isWidgetDataKeyDropdownOpen || widgetSetupForm.dataKey ? 'dashboard-floating-label-static' : ''}`}>
                        Data Key {selectedWidgetType && DASHBOARD_WIDGET_OPTIONAL_DATA_KEY.has(selectedWidgetType.id) ? '(Optional)' : <span className="dashboard-field-required">*</span>}
                      </span>

                      <span className="dashboard-dropdown-value">
                        {selectedWidgetDataKeyOption?.label || ''}
                      </span>
                    </span>

                    <span className="dashboard-dropdown-arrow" aria-hidden="true">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        {isWidgetDataKeyDropdownOpen ? <path d="M6 14l6-6 6 6" /> : <path d="M6 10l6 6 6-6" />}
                      </svg>
                    </span>
                  </button>

                  <div
                    className={`dashboard-dropdown-menu dashboard-widget-data-key-menu ${isWidgetDataKeyDropdownOpen ? 'open' : ''}`}
                    role="listbox"
                    aria-labelledby="dashboard-widget-data-key-input"
                  >
                    {widgetDataKeyOptions.length === 0 ? (
                      <div className="dashboard-dropdown-empty-option">
                        No telemetry keys found.
                      </div>
                    ) : (
                      widgetDataKeyOptions.map((option) => (
                        <button
                          key={`widget-data-key-${option.value || 'none'}`}
                          type="button"
                          className={`dashboard-dropdown-option ${String(option.value) === String(widgetSetupForm.dataKey) ? 'active' : ''}`}
                          onClick={() => {
                            setWidgetSetupForm((prev) => ({ ...prev, dataKey: option.value }))
                            setWidgetSetupCheckStatus('idle')
                            setWidgetSetupCheckMessage('')
                            setWidgetSetupError('')
                            setIsWidgetDataKeyDropdownOpen(false)
                          }}
                        >
                          {option.label}
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </div>

              <div className="dashboard-modal-field-group">
                <div className="dashboard-account-field dashboard-floating-field dashboard-widget-file-field">
                  <span className="dashboard-account-field-icon" aria-hidden="true">
                    <DashboardSourceFileIcon />
                  </span>

                  <div className="dashboard-floating-control dashboard-widget-file-floating-control">
                    <input
                      id="dashboard-widget-ino-file-input"
                      type="file"
                      className="dashboard-widget-file-hidden"
                      accept=".ino"
                      onChange={(event) => void handleWidgetFileChange(event)}
                    />

                    <label className="dashboard-floating-label" htmlFor="dashboard-widget-ino-file-input">
                      Arduino Source File {selectedWidgetType && DASHBOARD_WIDGET_OPTIONAL_DATA_KEY.has(selectedWidgetType.id) ? '(Optional)' : <span className="dashboard-field-required">*</span>}
                    </label>

                    <div className="dashboard-widget-file-control">
                      <label htmlFor="dashboard-widget-ino-file-input" className="dashboard-widget-file-button">
                        Choose File
                      </label>

                      <span className={`dashboard-widget-file-name ${widgetSetupForm.inoFileName ? 'has-file' : ''}`}>
                        {widgetSetupForm.inoFileName || 'No File Chosen'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {widgetSetupError && (
                <div className="dashboard-modal-error-row">
                  <span className="dashboard-modal-error-icon" aria-hidden="true">
                    <ErrorIcon />
                  </span>
                  <span>{widgetSetupError}</span>
                </div>
              )}

              {widgetSetupCheckStatus !== 'idle' && (
                <div className={`dashboard-widget-check-result dashboard-widget-check-result-${widgetSetupCheckStatus}`}>
                  <span className="dashboard-widget-check-result-icon" aria-hidden="true">
                    {widgetSetupCheckStatus === 'success' ? <SaveIcon /> : <ErrorIcon />}
                  </span>
                  <span>{isWidgetChecking ? 'Checking compatibility...' : widgetSetupCheckMessage}</span>
                </div>
              )}
            </div>

            <div className="dashboard-modal-footer dashboard-widget-setup-footer">
              <button
                type="button"
                className="dashboard-modal-cancel-btn"
                onClick={() => void closeWidgetSetupModal()}
                disabled={isWidgetChecking || isWidgetSetupLoading}
              >
                Cancel
              </button>

              <button
                type="button"
                className="dashboard-widget-check-btn"
                onClick={() => void handleCheckWidgetCompatibility()}
                disabled={!canCheckWidgetCompatibility}
              >
                <span className="dashboard-modal-confirm-icon" aria-hidden="true">
                  <SearchIcon />
                </span>
                Check Compatibility
              </button>

              <button
                type="button"
                className="dashboard-modal-confirm-btn"
                onClick={() => void handleSubmitWidgetSetup()}
                disabled={!canSubmitWidgetSetup}
              >
                <span className="dashboard-modal-confirm-icon" aria-hidden="true">
                  <SaveIcon />
                </span>
                {editingDashboardWidget ? 'Update Widget' : 'Add Widget'}
              </button>
            </div>
          </div>
        </div>
      )}

      {isDashboardModalOpen && (
        <div
          className={`dashboard-modal-backdrop ${isDashboardModalClosing ? 'dashboard-modal-closing' : ''}`}
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              void closeDashboardModal()
            }
          }}
        >
          <div
            ref={dashboardModalRef}
            className={`dashboard-modal ${isDashboardModalClosing ? 'dashboard-modal-closing' : ''}`}
            role="dialog"
            onMouseDown={(event) => event.stopPropagation()}
            aria-modal="true"
            aria-labelledby="dashboard-modal-title"
          >
            <div className="dashboard-modal-header">
              <h2 className="dashboard-modal-title" id="dashboard-modal-title">
                {dashboardModalMode === 'edit' ? 'Edit Dashboard' : 'Add Dashboard'}
              </h2>

              <button
                type="button"
                className="dashboard-modal-close"
                onClick={() => void closeDashboardModal()}
                aria-label="Close"
                disabled={isDashboardModalClosing}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="dashboard-modal-body">
              <div className="dashboard-modal-field-group">
                <div className={`dashboard-account-field dashboard-floating-field ${dashboardNameError ? 'dashboard-field-error-state' : ''}`}>
                  <span className="dashboard-account-field-icon" aria-hidden="true">
                    <DashboardNameFieldIcon />
                  </span>

                  <div className="dashboard-floating-control">
                    <input
                      id="dashboard-name-input"
                      type="text"
                      className="dashboard-account-input dashboard-floating-input"
                      value={dashboardForm.dashboardName}
                      onChange={(event) => handleDashboardFormChange('dashboardName', event.target.value)}
                      maxLength={DASHBOARD_NAME_MAX_LENGTH}
                      placeholder=" "
                    />

                    <label htmlFor="dashboard-name-input" className="dashboard-floating-label">
                      Dashboard Name <span className="dashboard-field-required">*</span>
                    </label>
                  </div>
                </div>

                {dashboardNameError && (
                  <div className="dashboard-modal-error-row">
                    <span className="dashboard-modal-error-icon" aria-hidden="true">
                      <ErrorIcon />
                    </span>
                    <span>{dashboardNameError}</span>
                  </div>
                )}
              </div>
              {renderDashboardDropdown({
                field: 'lastName',
                label: 'Last Name',
                value: dashboardForm.lastName,
                options: dashboardLastNameOptions,
                error: lastNameError,
                icon: <LastNameFieldIcon />,
              })}

              {renderDashboardDropdown({
                field: 'firstName',
                label: 'First Name',
                value: dashboardForm.firstName,
                options: dashboardFirstNameOptions,
                error: firstNameError,
                disabled: !dashboardForm.lastName,
                icon: <FirstNameFieldIcon />,
              })}

              {renderDashboardDropdown({
                field: 'deviceId',
                label: 'Device',
                value: dashboardForm.deviceId,
                options: dashboardDeviceOptions,
                error: deviceError,
                icon: <DashboardDeviceFieldIcon />,
              })}
            </div>

            <div className="dashboard-modal-footer">
              <button
                type="button"
                className="dashboard-modal-cancel-btn"
                onClick={() => void closeDashboardModal()}
                disabled={isDashboardModalClosing}
              >
                Cancel
              </button>

              <button
                type="button"
                className="dashboard-modal-confirm-btn"
                onClick={() => void handleSubmitDashboard()}
                disabled={!canSubmitDashboard}
              >
                <span className="dashboard-modal-confirm-icon" aria-hidden="true">
                  <SaveIcon />
                </span>
                {dashboardModalMode === 'edit' ? 'Edit Dashboard' : 'Add Dashboard'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

export default Dashboard