import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Swal from 'sweetalert2'
import 'sweetalert2/dist/sweetalert2.min.css'
import logo from '../Pictures/Avinya.png'
import '../Styles/Devices.css'
import { getCurrentUserProfile, isAdministratorRole } from '../Utils/getCurrentUserProfile'
import { performReliableLogout } from '../Utils/performReliableLogout'
import { buildApiAssetUrl } from '../Config/API'
import {
  ProfileMenuIcon,
  EditIcon,
  TrashIcon,
  SaveIcon,
  CopyIcon,
  CheckIcon,
  AccessTokenIcon,
  LatestTelemetryIcon
} from '../Components/Icons.jsx'
import {
  fetchDevices,
  createDevice,
  updateDevice,
  deleteDeviceById,
  resolveThingsBoardDeviceByName,
  fetchDeviceAccessToken,
  fetchDeviceLatestTelemetry
} from '../Utils/devicesApi'

const MAX_DEVICES = 5
const DEVICE_MODAL_TRANSITION_MS = 280
const COPY_FEEDBACK_TIMEOUT_MS = 1600

const Devices = ({ onLogout, onNavigate, isDarkMode, onThemeToggle }) => {
  const [isEntitiesOpen, setIsEntitiesOpen] = useState(true)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false)

  const [devices, setDevices] = useState([])
  const [isDevicesLoading, setIsDevicesLoading] = useState(true)
  const [devicesRequestError, setDevicesRequestError] = useState('')

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isModalClosing, setIsModalClosing] = useState(false)
  const [modalMode, setModalMode] = useState('add')
  const [editingDevice, setEditingDevice] = useState(null)
  const [formDeviceName, setFormDeviceName] = useState('')
  const [formDeviceNameError, setFormDeviceNameError] = useState('')
  const [formResolvedDeviceId, setFormResolvedDeviceId] = useState('')
  const [formConnectionStatus, setFormConnectionStatus] = useState('idle')
  const [formConnectionMessage, setFormConnectionMessage] = useState('')
  const [isDeviceConnecting, setIsDeviceConnecting] = useState(false)

  const [isDeviceActionLoading, setIsDeviceActionLoading] = useState(false)
  const [deviceActionLoadingTitle, setDeviceActionLoadingTitle] = useState('Loading Devices')

  const [isAccessTokenModalOpen, setIsAccessTokenModalOpen] = useState(false)
  const [isAccessTokenModalClosing, setIsAccessTokenModalClosing] = useState(false)
  const [accessTokenDevice, setAccessTokenDevice] = useState(null)
  const [accessTokenValue, setAccessTokenValue] = useState('')
  const [accessTokenError, setAccessTokenError] = useState('')
  const [isAccessTokenLoading, setIsAccessTokenLoading] = useState(false)

  const [isTelemetryModalOpen, setIsTelemetryModalOpen] = useState(false)
  const [isTelemetryModalClosing, setIsTelemetryModalClosing] = useState(false)
  const [telemetryDevice, setTelemetryDevice] = useState(null)
  const [telemetryRows, setTelemetryRows] = useState([])
  const [hasCheckedTelemetry, setHasCheckedTelemetry] = useState(false)
  const [telemetryError, setTelemetryError] = useState('')
  const [isTelemetryLoading, setIsTelemetryLoading] = useState(false)
  const [isTelemetryRefreshing, setIsTelemetryRefreshing] = useState(false)

  const [copiedDeviceField, setCopiedDeviceField] = useState('')
  const [isAccessTokenCopied, setIsAccessTokenCopied] = useState(false)
  const deviceCopyFeedbackTimerRef = useRef(null)
  const accessTokenCopyFeedbackTimerRef = useRef(null)

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
    document.title = 'Avinya | Devices'

    const handleOutsideClick = (event) => {
      if (!(event.target instanceof Element)) return
      if (!event.target.closest('.dashboard-sidebar-user-group')) {
        setIsProfileMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [])

  useEffect(() => {
    return () => {
      window.clearTimeout(deviceCopyFeedbackTimerRef.current)
      window.clearTimeout(accessTokenCopyFeedbackTimerRef.current)
    }
  }, [])

  const loadDevicesFromServer = useCallback(async () => {
    try {
      setIsDevicesLoading(true)
      setDevicesRequestError('')

      const [data] = await Promise.all([
        fetchDevices(),
        new Promise((resolve) => window.setTimeout(resolve, 420)),
      ])

      const nextDevices = Array.isArray(data.devices) ? data.devices : []

      setDevices(nextDevices)
      
    } catch (error) {
      console.error('DEVICES LOAD ERROR:', error)

      setDevices([])
      setDevicesRequestError(
        error instanceof TypeError || error.message === 'Failed to fetch'
          ? 'Unable to connect to the server. Please check your connection and try again.'
          : error.message || 'Unable to load devices right now.'
      )
    } finally {
      setIsDevicesLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadDevicesFromServer()
  }, [loadDevicesFromServer])

  useEffect(() => {
    if (!isModalOpen && !isAccessTokenModalOpen && !isTelemetryModalOpen) return

    const handleKey = (e) => {
      if (e.key !== 'Escape') return

      if (isModalOpen) {
        void closeModal()
        return
      }

      if (isAccessTokenModalOpen) {
        void closeAccessTokenModal()
        return
      }

      if (isTelemetryModalOpen) {
        void closeLatestTelemetryModal()
      }
    }

    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [isModalOpen, isAccessTokenModalOpen, isTelemetryModalOpen])

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
    closeDropdowns()
    performReliableLogout(onLogout)
  }

  const openAddModal = () => {
    setModalMode('add')
    setEditingDevice(null)
    setFormDeviceName('')
    setFormDeviceNameError('')
    setFormResolvedDeviceId('')
    setFormConnectionStatus('idle')
    setFormConnectionMessage('')
    setCopiedDeviceField('')
    setIsModalClosing(false)
    setIsModalOpen(true)
  }

  const openEditModal = (device) => {
    setModalMode('edit')
    setEditingDevice(device)
    setFormDeviceName(device.deviceName || '')
    setFormDeviceNameError('')
    setFormResolvedDeviceId(device.thingsboardDeviceId || '')
    setFormConnectionStatus(device.thingsboardDeviceId ? 'connected' : 'idle')
    setFormConnectionMessage(device.thingsboardDeviceId ? 'Device is already connected.' : '')
    setCopiedDeviceField('')
    setIsModalClosing(false)
    setIsModalOpen(true)
  }

  const closeModal = async () => {
    if (isModalClosing) return

    setIsModalClosing(true)

    await new Promise((resolve) => setTimeout(resolve, DEVICE_MODAL_TRANSITION_MS))

    setIsModalOpen(false)
    setIsModalClosing(false)
    setModalMode('add')
    setEditingDevice(null)
    setFormDeviceName('')
    setFormDeviceNameError('')
    setFormResolvedDeviceId('')
    setFormConnectionStatus('idle')
    setFormConnectionMessage('')
    setCopiedDeviceField('')
  }

  const showDevicesStatusAlert = async ({ type, title, message }) => {
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
        htmlContainer: 'auth-swal-html'
      }
    })
  }

  const confirmDeviceAction = async ({ title, text, confirmButtonText }) =>
    Swal.fire({
      title,
      text,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText,
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

  const restoreDeviceModal = ({
    mode,
    device,
    deviceName,
    resolvedDeviceId,
    connectionStatus,
    connectionMessage,
  }) => {
    setModalMode(mode)
    setEditingDevice(device)
    setFormDeviceName(deviceName)
    setFormResolvedDeviceId(resolvedDeviceId)
    setFormConnectionStatus(connectionStatus)
    setFormConnectionMessage(connectionMessage)
    setFormDeviceNameError('')
    setIsModalClosing(false)
    setIsModalOpen(true)
  }

  const handleSubmitDevice = async () => {
    if (!canSubmitDevice) return

    const currentDeviceId = editingDevice?.id || null

    if (!validateDeviceNameForm({ currentDeviceId })) return

    if (modalMode === 'edit' && !hasDeviceFormChanges) return

    const payload = {
      deviceName: normalizedFormDeviceName,
    }

    const draftModalState = {
      mode: modalMode,
      device: editingDevice,
      deviceName: normalizedFormDeviceName,
      resolvedDeviceId: formResolvedDeviceId,
      connectionStatus: formConnectionStatus,
      connectionMessage: formConnectionMessage,
    }

    const targetDevice = editingDevice
    const isEditMode = modalMode === 'edit'

    await closeModal()

    const confirmation = await confirmDeviceAction({
      title: isEditMode ? 'Edit Device?' : 'Add Device?',
      text: isEditMode
        ? `Are you sure you want to save changes to "${targetDevice?.deviceName}"?`
        : `Are you sure you want to add "${payload.deviceName}"?`,
      confirmButtonText: 'Yes',
    })

    if (!confirmation.isConfirmed) {
      restoreDeviceModal(draftModalState)
      return
    }

    setDeviceActionLoadingTitle(isEditMode ? 'Updating Device' : 'Adding Device')
    setIsDeviceActionLoading(true)

    try {
      const [data] = await Promise.all([
        isEditMode
          ? updateDevice(targetDevice.id, payload)
          : createDevice(payload),
        new Promise((resolve) => window.setTimeout(resolve, 620)),
      ])

      const nextDevices = isEditMode
        ? devices.map((device) => device.id === targetDevice.id ? data.device : device)
        : [...devices, data.device]

      setDevices(nextDevices)

      await showDevicesStatusAlert({
        type: 'success',
        title: isEditMode ? 'Device Updated' : 'Device Added',
        message: isEditMode
          ? 'The device has been updated successfully.'
          : 'The device has been added successfully.',
      })
    } catch (error) {
      await showDevicesStatusAlert({
        type: 'error',
        title: isEditMode ? 'Update Failed' : 'Add Failed',
        message: error.message || 'Something went wrong. Please try again.',
      })
    } finally {
      setIsDeviceActionLoading(false)
    }
  }

  const handleDeleteDevice = async (device) => {
    if (isDeviceActionLoading) return

    const confirmation = await confirmDeviceAction({
      title: 'Delete Device?',
      text: `Are you sure you want to delete "${device.deviceName}"?`,
      confirmButtonText: 'Yes',
    })

    if (!confirmation.isConfirmed) return

    setDeviceActionLoadingTitle('Deleting Device')
    setIsDeviceActionLoading(true)

    try {
      await Promise.all([
        deleteDeviceById(device.id),
        new Promise((resolve) => window.setTimeout(resolve, 620)),
      ])

      const nextDevices = devices.filter((item) => item.id !== device.id)

      setDevices(nextDevices)

      await showDevicesStatusAlert({
        type: 'success',
        title: 'Device Deleted',
        message: 'The device has been deleted successfully.',
      })
    } catch (error) {
      await showDevicesStatusAlert({
        type: 'error',
        title: 'Delete Failed',
        message: error.message || 'Something went wrong while deleting the device.',
      })
    } finally {
      setIsDeviceActionLoading(false)
    }
  }

  const openAccessTokenModal = async (device) => {
    if (isDeviceActionLoading) return

    setAccessTokenDevice(device)
    setAccessTokenValue('')
    setAccessTokenError('')
    setIsAccessTokenCopied(false)
    setIsAccessTokenModalClosing(false)
    setIsAccessTokenModalOpen(true)
    setIsAccessTokenLoading(true)

    try {
      const [data] = await Promise.all([
        fetchDeviceAccessToken(device.id),
        new Promise((resolve) => window.setTimeout(resolve, 520)),
      ])

      setAccessTokenValue(data.accessToken || '')
    } catch (error) {
      setAccessTokenError(error.message || 'Unable to load access token right now.')
    } finally {
      setIsAccessTokenLoading(false)
    }
  }

  const closeAccessTokenModal = async () => {
    if (isAccessTokenModalClosing || isAccessTokenLoading) return

    setIsAccessTokenModalClosing(true)

    await new Promise((resolve) => setTimeout(resolve, DEVICE_MODAL_TRANSITION_MS))

    setIsAccessTokenModalOpen(false)
    setIsAccessTokenModalClosing(false)
    setAccessTokenDevice(null)
    setAccessTokenValue('')
    setAccessTokenError('')
    setIsAccessTokenCopied(false)
  }

  const formatTelemetryLastUpdateTime = (timestamp) => {
    const date = new Date(Number(timestamp))

    if (Number.isNaN(date.getTime())) {
      return 'N/A'
    }

    const dateText = new Intl.DateTimeFormat('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }).format(date)

    const timeText = new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(date)

    return `${dateText} | ${timeText}`
  }

  const loadLatestTelemetryForDevice = async (device) => {
    const data = await fetchDeviceLatestTelemetry(device.id)
    return Array.isArray(data.telemetry) ? data.telemetry : []
  }

  const openLatestTelemetryModal = (device) => {
    if (isDeviceActionLoading || isTelemetryRefreshing) return

    setTelemetryDevice(device)
    setTelemetryRows([])
    setHasCheckedTelemetry(false)
    setTelemetryError('')
    setIsTelemetryModalClosing(false)
    setIsTelemetryLoading(false)
    setIsTelemetryRefreshing(false)
    setIsTelemetryModalOpen(true)
  }

  const closeLatestTelemetryModal = async () => {
    if (isTelemetryModalClosing || isTelemetryLoading || isTelemetryRefreshing) return

    setIsTelemetryModalClosing(true)

    await new Promise((resolve) => setTimeout(resolve, DEVICE_MODAL_TRANSITION_MS))

    setIsTelemetryModalOpen(false)
    setIsTelemetryModalClosing(false)
    setTelemetryDevice(null)
    setTelemetryRows([])
    setHasCheckedTelemetry(false)
    setTelemetryError('')
    setIsTelemetryLoading(false)
    setIsTelemetryRefreshing(false)
  }

  const closeLatestTelemetryModalForRefresh = async () => {
    setIsTelemetryModalClosing(true)

    await new Promise((resolve) => setTimeout(resolve, DEVICE_MODAL_TRANSITION_MS))

    setIsTelemetryModalOpen(false)
    setIsTelemetryModalClosing(false)
  }

  const handleCheckLatestTelemetry = async () => {
    if (!telemetryDevice || isTelemetryLoading || isTelemetryRefreshing) return

    const currentDevice = telemetryDevice

    await closeLatestTelemetryModalForRefresh()

    setIsTelemetryRefreshing(true)

    try {
      const [rows] = await Promise.all([
        loadLatestTelemetryForDevice(currentDevice),
        new Promise((resolve) => window.setTimeout(resolve, 620)),
      ])

      setTelemetryDevice(currentDevice)
      setTelemetryRows(rows)
      setTelemetryError('')
      setHasCheckedTelemetry(true)
    } catch (error) {
      setTelemetryDevice(currentDevice)
      setTelemetryRows([])
      setTelemetryError(error.message || 'Unable to load latest telemetry right now.')
      setHasCheckedTelemetry(true)
    } finally {
      setIsTelemetryRefreshing(false)
      setIsTelemetryModalClosing(false)
      setIsTelemetryModalOpen(true)
    }
  }

  const normalizedFormDeviceName = formDeviceName.trim()
  const isDeviceConnected =
    formConnectionStatus === 'connected' && Boolean(formResolvedDeviceId)

  const isEditingDevice = modalMode === 'edit' && editingDevice

  const hasDeviceFormChanges = useMemo(() => {
    if (!isEditingDevice) return true

    return normalizedFormDeviceName !== String(editingDevice.deviceName || '').trim()
  }, [editingDevice, isEditingDevice, normalizedFormDeviceName])

  const canConnectDevice =
    !isModalClosing &&
    !isDeviceConnecting &&
    Boolean(normalizedFormDeviceName) &&
    (modalMode === 'add' || hasDeviceFormChanges)

  const canSubmitDevice =
    !isModalClosing &&
    !isDeviceActionLoading &&
    isDeviceConnected &&
    (modalMode === 'add' || hasDeviceFormChanges)

  const handleDeviceNameChange = (value) => {
    setFormDeviceName(value)
    setFormDeviceNameError('')
    setFormResolvedDeviceId('')
    setFormConnectionStatus('idle')
    setFormConnectionMessage('')
    setCopiedDeviceField('')
  }

  const validateDeviceNameForm = ({ currentDeviceId = null } = {}) => {
    if (!normalizedFormDeviceName) {
      setFormDeviceNameError('Device Name cannot be empty.')
      return false
    }

    if (normalizedFormDeviceName.length > 255) {
      setFormDeviceNameError('Device Name must not exceed 255 characters.')
      return false
    }

    const hasDuplicate = devices.some((device) => {
      if (currentDeviceId && device.id === currentDeviceId) return false
      return String(device.deviceName || '').trim() === normalizedFormDeviceName
    })

    if (hasDuplicate) {
      setFormDeviceNameError('This Device Name already exists.')
      return false
    }

    return true
  }

  const handleConnectDevice = async () => {
    if (!canConnectDevice) return

    const currentDeviceId = editingDevice?.id || null

    if (!validateDeviceNameForm({ currentDeviceId })) return

    const deviceNameToConnect = normalizedFormDeviceName

    const draftModalState = {
      mode: modalMode,
      device: editingDevice,
      deviceName: deviceNameToConnect,
      resolvedDeviceId: '',
      connectionStatus: 'checking',
      connectionMessage: 'Checking ThingsBoard Cloud...',
    }

    await closeModal()

    setIsDeviceConnecting(true)

    try {
      const [data] = await Promise.all([
        resolveThingsBoardDeviceByName(deviceNameToConnect),
        new Promise((resolve) => window.setTimeout(resolve, 620)),
      ])

      const resolvedDevice = data.device || {}

      restoreDeviceModal({
        ...draftModalState,
        deviceName: resolvedDevice.deviceName || deviceNameToConnect,
        resolvedDeviceId: resolvedDevice.thingsboardDeviceId || '',
        connectionStatus: 'connected',
        connectionMessage: 'Device connected successfully.',
      })
    } catch (error) {
      restoreDeviceModal({
        ...draftModalState,
        resolvedDeviceId: '',
        connectionStatus: 'not-connected',
        connectionMessage: error.message || 'Device was not found in ThingsBoard Cloud.',
      })
    } finally {
      setIsDeviceConnecting(false)
    }
  }

  const copyTextToClipboard = async (value) => {
    const text = String(value || '').trim()

    if (!text) return false

    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      try {
        const textarea = document.createElement('textarea')
        textarea.value = text
        textarea.setAttribute('readonly', '')
        textarea.style.position = 'fixed'
        textarea.style.opacity = '0'
        document.body.appendChild(textarea)
        textarea.select()
        document.execCommand('copy')
        textarea.remove()
        return true
      } catch {
        return false
      }
    }
  }

  const handleCopyDeviceId = async () => {
    if (!formResolvedDeviceId || copiedDeviceField === 'device-id') return

    const didCopy = await copyTextToClipboard(formResolvedDeviceId)

    if (!didCopy) return

    window.clearTimeout(deviceCopyFeedbackTimerRef.current)
    setCopiedDeviceField('device-id')

    deviceCopyFeedbackTimerRef.current = window.setTimeout(() => {
      setCopiedDeviceField('')
    }, COPY_FEEDBACK_TIMEOUT_MS)
  }

  const handleCopyAccessToken = async () => {
    if (!accessTokenValue || isAccessTokenCopied) return

    const didCopy = await copyTextToClipboard(accessTokenValue)

    if (!didCopy) return

    window.clearTimeout(accessTokenCopyFeedbackTimerRef.current)
    setIsAccessTokenCopied(true)

    accessTokenCopyFeedbackTimerRef.current = window.setTimeout(() => {
      setIsAccessTokenCopied(false)
    }, COPY_FEEDBACK_TIMEOUT_MS)
  }

  const atLimit = devices.length >= MAX_DEVICES

  return (
    <main className="dashboard-page devices-page">

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
            <button
              type="button"
              className="dashboard-sidebar-link"
              data-tooltip="Dashboard"
              onClick={() => onNavigate('dashboard')}
            >
              <span className="dashboard-sidebar-link-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="7" height="7" rx="1.5" />
                  <rect x="14" y="3" width="7" height="7" rx="1.5" />
                  <rect x="3" y="14" width="7" height="7" rx="1.5" />
                  <rect x="14" y="14" width="7" height="7" rx="1.5" />
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

              <div className={`dashboard-sidebar-submenu submenu-active ${isEntitiesOpen ? 'open' : ''}`}>
                <button type="button" className="dashboard-sidebar-sublink active" aria-current="page">
                  <span className="dashboard-sidebar-sublink-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="7" width="7" height="10" rx="1.5" />
                      <rect x="14" y="7" width="7" height="10" rx="1.5" />
                      <path d="M6.5 10.5h.01" /><path d="M17.5 10.5h.01" />
                    </svg>
                  </span>
                  <span className="dashboard-sidebar-sublink-label">Devices</span>
                </button>
              </div>
            </div>

            {isAdministrator && (
              <button
                type="button"
                className="dashboard-sidebar-link"
                data-tooltip="Users"
                onClick={() => onNavigate('users')}
              >
                <span className="dashboard-sidebar-link-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                </span>
                <span className="dashboard-sidebar-link-label">Users</span>
              </button>
            )}

            {isAdministrator && (
              <button
                type="button"
                className="dashboard-sidebar-link"
                data-tooltip="Logs"
                onClick={() => onNavigate('logs')}
              >
                <span className="dashboard-sidebar-link-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 11l3 3L22 4" />
                    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                  </svg>
                </span>
                <span className="dashboard-sidebar-link-label">Logs</span>
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
              <span className="dashboard-sidebar-theme-label">
                {isDarkMode ? 'Light Mode' : 'Dark Mode'}
              </span>
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
                <button
                  type="button"
                  className="dashboard-sidebar-user-menu-item"
                  onClick={() => { closeDropdowns(); onNavigate('account') }}
                >
                  <span className="dashboard-sidebar-user-menu-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M20 21a8 8 0 0 0-16 0" />
                      <circle cx="12" cy="8" r="4" />
                    </svg>
                  </span>
                  <span>Account</span>
                </button>

                <button
                  type="button"
                  className="dashboard-sidebar-user-menu-item dashboard-sidebar-user-menu-item-danger"
                  onClick={handleLogout}
                >
                  <span className="dashboard-sidebar-user-menu-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                      <path d="M16 17l5-5-5-5" />
                      <path d="M21 12H9" />
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
          <div className="dashboard-header dashboard-page-title-row devices-page-topbar">
            <h1 id="devices-page-title" className="dashboard-content-title">Devices</h1>
          </div>

          <section className="devices-panel" aria-labelledby="devices-page-title">

            <div className="devices-panel-toolbar">
              <span className="devices-topbar-count">
                {devices.length} of {MAX_DEVICES} Devices Used
              </span>

              {!atLimit ? (
                <button
                  type="button"
                  className="devices-add-btn"
                  onClick={openAddModal}
                  disabled={isDevicesLoading || isDeviceActionLoading}
                >
                  <span className="devices-add-btn-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                  </span>
                  <span>Add Device</span>
                </button>
              ) : (
                <span className="devices-limit-badge">
                  Limit Reached ({MAX_DEVICES}/{MAX_DEVICES})
                </span>
              )}
            </div>

            <div className="devices-slots" role="list" aria-label="Devices">
              {isDevicesLoading ? (
                <div className="devices-empty-state" role="status" aria-live="polite">
                  Loading devices...
                </div>
              ) : devicesRequestError ? (
                <div className="devices-empty-state devices-empty-state-error" role="alert">
                  {devicesRequestError}
                </div>
              ) : devices.length === 0 ? (
                <div className="devices-empty-state" aria-live="polite">
                  No devices found.
                </div>
              ) : (
                devices.map((device, index) => (
                  <div
                    key={device.id}
                    className="devices-slot devices-slot-filled"
                    style={{ '--devices-slot-delay': `${index * 48}ms` }}
                    role="listitem"
                  >
                    <span className="devices-slot-number" aria-hidden="true">
                      {index + 1}
                    </span>

                    <span className="devices-slot-icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="7" width="7" height="10" rx="1.5" />
                        <rect x="14" y="7" width="7" height="10" rx="1.5" />
                        <path d="M6.5 10.5h.01" />
                        <path d="M17.5 10.5h.01" />
                      </svg>
                    </span>

                    <div className="devices-slot-info">
                      <span className="devices-slot-id" title={device.deviceName}>
                        {device.deviceName}
                      </span>
                    </div>

                    <div className="devices-slot-right">
                      <div className="devices-slot-actions">
                        <button
                          type="button"
                          className="devices-slot-action-btn devices-icon-action devices-slot-edit"
                          onClick={() => openEditModal(device)}
                          disabled={isDeviceActionLoading}
                          data-devices-tooltip="Edit"
                          aria-label="Edit device"
                        >
                          <span className="devices-slot-action-icon" aria-hidden="true">
                            <EditIcon />
                          </span>
                        </button>

                        <button
                          type="button"
                          className="devices-slot-action-btn devices-icon-action devices-slot-token"
                          onClick={() => void openAccessTokenModal(device)}
                          disabled={isDeviceActionLoading}
                          data-devices-tooltip="Access Token"
                          aria-label="View access token"
                        >
                          <span className="devices-slot-action-icon" aria-hidden="true">
                            <AccessTokenIcon />
                          </span>
                        </button>

                        <button
                          type="button"
                          className="devices-slot-action-btn devices-icon-action devices-slot-telemetry"
                          onClick={() => void openLatestTelemetryModal(device)}
                          disabled={isDeviceActionLoading || isTelemetryRefreshing}
                          data-devices-tooltip="Latest Telemetry"
                          aria-label="View latest telemetry"
                        >
                          <span className="devices-slot-action-icon" aria-hidden="true">
                            <LatestTelemetryIcon />
                          </span>
                        </button>

                        <button
                          type="button"
                          className="devices-slot-action-btn devices-icon-action devices-slot-delete"
                          onClick={() => handleDeleteDevice(device)}
                          disabled={isDeviceActionLoading}
                          data-devices-tooltip="Delete"
                          aria-label="Delete device"
                        >
                          <span className="devices-slot-action-icon" aria-hidden="true">
                            <TrashIcon />
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </section>

      {isModalOpen && (
        <div
          className={`devices-modal-backdrop ${isModalClosing ? 'devices-modal-closing' : ''}`}
          onClick={(e) => {
            if (e.target === e.currentTarget) void closeModal()
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="devices-modal-title"
        >
          <div className={`devices-modal ${isModalClosing ? 'devices-modal-closing' : ''}`}>
            <div className="devices-modal-header">
              <h2 className="devices-modal-title" id="devices-modal-title">
                {modalMode === 'edit' ? 'Edit Device' : 'Add Device'}
              </h2>
              <button
                type="button"
                className="devices-modal-close"
                onClick={() => void closeModal()}
                aria-label="Close"
                disabled={isModalClosing}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="devices-modal-body">
              <div className="devices-field">
                <div className={`devices-account-field devices-floating-field ${formDeviceNameError ? 'devices-field-error-state' : ''}`}>
                  <span className="devices-account-field-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="7" width="7" height="10" rx="1.5" />
                      <rect x="14" y="7" width="7" height="10" rx="1.5" />
                      <path d="M6.5 10.5h.01" />
                      <path d="M17.5 10.5h.01" />
                    </svg>
                  </span>

                  <div className="devices-floating-control">
                    <input
                      id="device-name-input"
                      type="text"
                      className="devices-input devices-floating-input"
                      placeholder=" "
                      value={formDeviceName}
                      onChange={(e) => handleDeviceNameChange(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && canConnectDevice) void handleConnectDevice()
                      }}
                      autoFocus
                      maxLength={255}
                    />

                    <label htmlFor="device-name-input" className="devices-floating-label">
                      Device Name <span className="devices-field-required">*</span>
                    </label>
                  </div>
                </div>

                {formDeviceNameError && (
                  <div className="devices-modal-error-row">
                    <span className="devices-modal-error-icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm1 15h-2v-2h2Zm0-4h-2V7h2Z" />
                      </svg>
                    </span>
                    <span>{formDeviceNameError}</span>
                  </div>
                )}
              </div>

              <div className="devices-connect-row">
                <button
                  type="button"
                  className="devices-connect-btn"
                  onClick={() => void handleConnectDevice()}
                  disabled={!canConnectDevice}
                >
                  {isDeviceConnecting ? 'Connecting' : 'Connect'}
                </button>

                <span className={`devices-connection-status devices-connection-status-${formConnectionStatus}`}>
                  {formConnectionStatus === 'connected'
                    ? 'Connected'
                    : formConnectionStatus === 'not-connected'
                      ? 'Not Connected'
                      : formConnectionStatus === 'checking'
                        ? 'Checking'
                        : 'Not Connected'}
                </span>
              </div>

              {formConnectionMessage && (
                <p className={`devices-connection-message devices-connection-message-${formConnectionStatus}`}>
                  {formConnectionMessage}
                </p>
              )}

              <div className="devices-field">
                <div className="devices-readonly-copy-row devices-readonly-copy-row-floating">
                  <div className="devices-account-field devices-floating-field devices-readonly-field">
                    <span className="devices-account-field-icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="7.5" cy="15.5" r="5.5" />
                        <path d="M12 11l8-8" />
                        <path d="M17 3h4v4" />
                      </svg>
                    </span>

                    <div className="devices-floating-control">
                      <input
                        id="device-id-output"
                        type="text"
                        className="devices-input devices-floating-input devices-readonly-input"
                        value={formResolvedDeviceId}
                        placeholder=" "
                        readOnly
                      />

                      <label htmlFor="device-id-output" className="devices-floating-label devices-floating-label-static">
                        Device ID
                      </label>
                    </div>
                  </div>

                  <button
                    type="button"
                    className={`devices-copy-btn ${copiedDeviceField === 'device-id' ? 'devices-copy-btn-copied' : ''}`}
                    onClick={() => void handleCopyDeviceId()}
                    disabled={!formResolvedDeviceId || copiedDeviceField === 'device-id'}
                    aria-label={copiedDeviceField === 'device-id' ? 'Device ID copied' : 'Copy Device ID'}
                    data-devices-tooltip={copiedDeviceField === 'device-id' ? 'Copied' : 'Copy'}
                  >
                    {copiedDeviceField === 'device-id' ? <CheckIcon /> : <CopyIcon />}
                  </button>
                </div>

                {copiedDeviceField === 'device-id' && (
                  <span className="devices-copy-inline-feedback" role="status" aria-live="polite">
                    Device ID copied
                  </span>
                )}
              </div>
            </div>

            <div className="devices-modal-footer">
              <button
                type="button"
                className="devices-modal-cancel-btn"
                onClick={() => void closeModal()}
                disabled={isModalClosing}
              >
                Cancel
              </button>

              <button
                type="button"
                className="devices-modal-confirm-btn"
                onClick={() => void handleSubmitDevice()}
                disabled={!canSubmitDevice}
              >
                {modalMode === 'edit' ? (
                  <span className="devices-modal-confirm-icon" aria-hidden="true">
                    <SaveIcon />
                  </span>
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="14" height="14">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                )}
                {modalMode === 'edit' ? 'Edit Device' : 'Add Device'}
              </button>
            </div>
          </div>
        </div>
      )}
      {isAccessTokenModalOpen && (
        <div
          className={`devices-modal-backdrop ${isAccessTokenModalClosing ? 'devices-modal-closing' : ''}`}
          onClick={(e) => {
            if (e.target === e.currentTarget) void closeAccessTokenModal()
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="devices-token-modal-title"
        >
          <div className={`devices-modal devices-token-modal ${isAccessTokenModalClosing ? 'devices-modal-closing' : ''}`}>
            <div className="devices-modal-header">
              <h2 className="devices-modal-title" id="devices-token-modal-title">
                Access Token
              </h2>

              <button
                type="button"
                className="devices-modal-close"
                onClick={() => void closeAccessTokenModal()}
                aria-label="Close"
                disabled={isAccessTokenLoading}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="devices-modal-body">
              <div className="devices-token-device-name">
                {accessTokenDevice?.deviceName || 'Device'}
              </div>

              <div className="devices-field">
                <div className="devices-readonly-copy-row devices-readonly-copy-row-floating">
                  <div className="devices-account-field devices-floating-field devices-readonly-field">
                    <span className="devices-account-field-icon" aria-hidden="true">
                      <AccessTokenIcon />
                    </span>

                    <div className="devices-floating-control">
                      <input
                        id="device-access-token-output"
                        type="text"
                        className="devices-input devices-floating-input devices-readonly-input"
                        value={isAccessTokenLoading ? 'Loading access token...' : accessTokenValue}
                        placeholder=" "
                        readOnly
                      />

                      <label htmlFor="device-access-token-output" className="devices-floating-label devices-floating-label-static">
                        Access Token
                      </label>
                    </div>
                  </div>

                  <button
                    type="button"
                    className={`devices-copy-btn ${isAccessTokenCopied ? 'devices-copy-btn-copied' : ''}`}
                    onClick={() => void handleCopyAccessToken()}
                    disabled={!accessTokenValue || isAccessTokenLoading || isAccessTokenCopied}
                    aria-label={isAccessTokenCopied ? 'Access Token copied' : 'Copy access token'}
                    data-devices-tooltip={isAccessTokenCopied ? 'Copied' : 'Copy'}
                  >
                    {isAccessTokenCopied ? <CheckIcon /> : <CopyIcon />}
                  </button>
                </div>

                {isAccessTokenCopied && (
                  <span className="devices-copy-inline-feedback" role="status" aria-live="polite">
                    Access Token copied
                  </span>
                )}

                {accessTokenError && (
                  <p className="devices-field-error">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 8v4M12 16h.01" />
                    </svg>
                    {accessTokenError}
                  </p>
                )}
              </div>
            </div>

            <div className="devices-modal-footer">
              <button
                type="button"
                className="devices-modal-cancel-btn"
                onClick={() => void closeAccessTokenModal()}
                disabled={isAccessTokenLoading}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      {isTelemetryModalOpen && (
        <div
          className={`devices-modal-backdrop ${isTelemetryModalClosing ? 'devices-modal-closing' : ''}`}
          onClick={(e) => {
            if (e.target === e.currentTarget) void closeLatestTelemetryModal()
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="devices-telemetry-modal-title"
        >
          <div className={`devices-modal devices-telemetry-modal ${isTelemetryModalClosing ? 'devices-modal-closing' : ''}`}>
            <div className="devices-modal-header">
              <h2 className="devices-modal-title" id="devices-telemetry-modal-title">
                Latest Telemetry
              </h2>

              <button
                type="button"
                className="devices-modal-close"
                onClick={() => void closeLatestTelemetryModal()}
                aria-label="Close"
                disabled={isTelemetryLoading}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="devices-modal-body devices-telemetry-modal-body">
              <div className="devices-telemetry-device-name">
                {telemetryDevice?.deviceName || 'Device'}
              </div>

              {isTelemetryLoading || isTelemetryRefreshing ? (
                <div className="devices-telemetry-state" role="status" aria-live="polite">
                  Checking latest telemetry...
                </div>
              ) : telemetryError ? (
                <div className="devices-telemetry-state devices-telemetry-state-error" role="alert">
                  {telemetryError}
                </div>
              ) : !hasCheckedTelemetry ? (
                <div className="devices-telemetry-state">
                  Click Check Latest Telemetry after uploading your Arduino code with the Access Token to view the latest data from ThingsBoard.
                </div>
              ) : telemetryRows.length === 0 ? (
                <div className="devices-telemetry-state">
                  No latest telemetry found yet. Check the Access Token, upload the Arduino code, then try again.
                </div>
              ) : (
                <div className="devices-telemetry-table-scroll">
                  <table className="devices-telemetry-table">
                    <thead>
                      <tr>
                        <th>Key</th>
                        <th>Value</th>
                        <th>Last Update Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {telemetryRows.map((row, index) => (
                        <tr
                          key={`${row.key}-${row.lastUpdateTimestamp}`}
                          className="devices-telemetry-table-row"
                          style={{ '--devices-telemetry-row-delay': `${Math.min(index, 9) * 28}ms` }}
                        >
                          <td>{row.key}</td>
                          <td>{row.value || 'N/A'}</td>
                          <td>{formatTelemetryLastUpdateTime(row.lastUpdateTimestamp)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="devices-modal-footer devices-telemetry-modal-footer">
              <button
                type="button"
                className="devices-modal-cancel-btn"
                onClick={() => void closeLatestTelemetryModal()}
                disabled={isTelemetryLoading || isTelemetryRefreshing}
              >
                Close
              </button>

              <button
                type="button"
                className="devices-modal-confirm-btn devices-check-telemetry-btn"
                onClick={() => void handleCheckLatestTelemetry()}
                disabled={isTelemetryLoading || isTelemetryRefreshing}
              >
                <span className="devices-modal-confirm-icon" aria-hidden="true">
                  <LatestTelemetryIcon />
                </span>
                <span className="devices-check-telemetry-label">
                  Check Latest Telemetry
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
      {(isDeviceActionLoading || isDeviceConnecting || isTelemetryRefreshing) && (
        <div className="devices-action-overlay" role="status" aria-live="polite" aria-busy="true">
          <div className={`devices-action-card ${isTelemetryRefreshing ? 'devices-action-card-telemetry' : ''}`}>
            <img src={logo} alt="Avinya Logo" className="devices-action-logo" />
            <p className="devices-action-title">
              {isDeviceConnecting
                ? 'Connecting Device'
                : isTelemetryRefreshing
                  ? 'Checking Latest Telemetry'
                  : deviceActionLoadingTitle}
            </p>
            <div className="devices-action-loader" aria-hidden="true">
              <span className="devices-action-loader-bar"></span>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

export default Devices