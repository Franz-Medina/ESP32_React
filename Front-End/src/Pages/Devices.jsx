import { useCallback, useEffect, useMemo, useState } from 'react'
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
  SaveIcon
} from '../Components/Icons.jsx'
import {
  fetchDevices,
  createDevice,
  updateDevice,
  deleteDeviceById
} from '../Utils/devicesApi'
import { syncDevicesForDashboardWidgets } from '../Utils/deviceStorage'

const MAX_DEVICES = 5
const DEVICE_MODAL_TRANSITION_MS = 280

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
  const [formId, setFormId] = useState('')
  const [formDesc, setFormDesc] = useState('')
  const [formIdError, setFormIdError] = useState('')

  const [isDeviceActionLoading, setIsDeviceActionLoading] = useState(false)
  const [deviceActionLoadingTitle, setDeviceActionLoadingTitle] = useState('Loading Devices')

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
      syncDevicesForDashboardWidgets(nextDevices)
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
    if (!isModalOpen) return

    const handleKey = (e) => {
      if (e.key === 'Escape') void closeModal()
    }

    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [isModalOpen])

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
    setFormId('')
    setFormDesc('')
    setFormIdError('')
    setIsModalClosing(false)
    setIsModalOpen(true)
  }

  const openEditModal = (device) => {
    setModalMode('edit')
    setEditingDevice(device)
    setFormId(device.deviceUid || '')
    setFormDesc(device.description || '')
    setFormIdError('')
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
    setFormId('')
    setFormDesc('')
    setFormIdError('')
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

  const validateDeviceForm = ({ currentDeviceId = null } = {}) => {
    if (!normalizedFormId) {
      setFormIdError('Device ID cannot be empty.')
      return false
    }

    if (normalizedFormId.length > 64) {
      setFormIdError('Device ID must not exceed 64 characters.')
      return false
    }

    if (!/^[A-Za-z0-9._:-]+$/.test(normalizedFormId)) {
      setFormIdError('Device ID may only contain letters, numbers, dots, underscores, colons, and hyphens.')
      return false
    }

    const hasDuplicate = devices.some((device) => {
      if (currentDeviceId && device.id === currentDeviceId) return false
      return String(device.deviceUid || '').trim().toLowerCase() === normalizedFormId.toLowerCase()
    })

    if (hasDuplicate) {
      setFormIdError('This Device ID already exists.')
      return false
    }

    return true
  }

  const handleSubmitDevice = async () => {
    if (isModalClosing || isDeviceActionLoading) return

    const currentDeviceId = editingDevice?.id || null

    if (!validateDeviceForm({ currentDeviceId })) return

    if (modalMode === 'edit' && !hasDeviceFormChanges) return

    const payload = {
      deviceUid: normalizedFormId,
      description: normalizedFormDesc,
    }

    const targetDevice = editingDevice
    const isEditMode = modalMode === 'edit'

    await closeModal()

    const confirmation = await confirmDeviceAction({
      title: isEditMode ? 'Edit Device?' : 'Add Device?',
      text: isEditMode
        ? `Are you sure you want to save changes to "${targetDevice?.deviceUid}"?`
        : `Are you sure you want to add "${payload.deviceUid}"?`,
      confirmButtonText: 'Yes',
    })

    if (!confirmation.isConfirmed) return

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
      syncDevicesForDashboardWidgets(nextDevices)

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
      text: `Are you sure you want to delete "${device.deviceUid}"?`,
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
      syncDevicesForDashboardWidgets(nextDevices)

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

  const normalizedFormId = formId.trim()
  const normalizedFormDesc = formDesc.trim()

  const isEditingDevice = modalMode === 'edit' && editingDevice

  const hasDeviceFormChanges = useMemo(() => {
    if (!isEditingDevice) return true

    return (
      normalizedFormId !== String(editingDevice.deviceUid || '').trim() ||
      normalizedFormDesc !== String(editingDevice.description || '').trim()
    )
  }, [editingDevice, isEditingDevice, normalizedFormDesc, normalizedFormId])

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
                      <span className="devices-slot-id" title={device.deviceUid}>
                        {device.deviceUid}
                      </span>

                      {device.description && (
                        <span className="devices-slot-desc" title={device.description}>
                          {device.description}
                        </span>
                      )}
                    </div>

                    <div className="devices-slot-right">
                      <div className="devices-slot-actions">
                        <button
                          type="button"
                          className="devices-slot-action-btn devices-slot-edit"
                          onClick={() => openEditModal(device)}
                          disabled={isDeviceActionLoading}
                        >
                          <span className="devices-slot-action-icon" aria-hidden="true">
                            <EditIcon />
                          </span>
                          <span>Edit</span>
                        </button>

                        <button
                          type="button"
                          className="devices-slot-action-btn devices-slot-delete"
                          onClick={() => handleDeleteDevice(device)}
                          disabled={isDeviceActionLoading}
                        >
                          <span className="devices-slot-action-icon" aria-hidden="true">
                            <TrashIcon />
                          </span>
                          <span>Delete</span>
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
                <label className="devices-field-label" htmlFor="device-id-input">
                  Device ID <span className="devices-field-required">*</span>
                </label>
                <div className="devices-input-wrapper">
                  <svg className="devices-input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="7" width="7" height="10" rx="1.5" />
                    <rect x="14" y="7" width="7" height="10" rx="1.5" />
                    <path d="M6.5 10.5h.01" /><path d="M17.5 10.5h.01" />
                  </svg>
                  <input
                    id="device-id-input"
                    type="text"
                    className={`devices-input ${formIdError ? 'devices-input-has-error' : ''}`}
                    placeholder=""
                    value={formId}
                    onChange={(e) => { setFormId(e.target.value); setFormIdError('') }}
                    onKeyDown={(e) => { if (e.key === 'Enter') void handleSubmitDevice() }}
                    autoFocus
                    maxLength={64}
                  />
                </div>
                {formIdError && (
                  <p className="devices-field-error">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 8v4M12 16h.01" />
                    </svg>
                    {formIdError}
                  </p>
                )}
              </div>

              <div className="devices-field">
                <label className="devices-field-label" htmlFor="device-desc-input">
                  Description
                  <span className="devices-field-optional">Optional</span>
                </label>
                <textarea
                  id="device-desc-input"
                  className="devices-textarea"
                  placeholder="What is this device used for?"
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  maxLength={200}
                  rows={3}
                />
                <span className="devices-field-char-count">{formDesc.length} / 200</span>
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
                disabled={
                  isModalClosing ||
                  isDeviceActionLoading ||
                  (modalMode === 'edit' && !hasDeviceFormChanges)
                }
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
      {isDeviceActionLoading && (
        <div className="devices-action-overlay" role="status" aria-live="polite" aria-busy="true">
          <div className="devices-action-card">
            <img src={logo} alt="Avinya Logo" className="devices-action-logo" />
            <p className="devices-action-title">{deviceActionLoadingTitle}</p>
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