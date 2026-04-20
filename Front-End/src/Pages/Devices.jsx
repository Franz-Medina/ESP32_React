import { useEffect, useState } from 'react'
import Swal from 'sweetalert2'
import 'sweetalert2/dist/sweetalert2.min.css'
import logo from '../Pictures/Avinya.png'
import '../Styles/Devices.css'
import { getCurrentUserProfile, isAdministratorRole } from '../Utils/getCurrentUserProfile'
import { performReliableLogout } from '../Utils/performReliableLogout'
import { buildApiAssetUrl } from '../Config/API'
import { ProfileMenuIcon } from '../Components/Icons.jsx'

import { logDeviceAdded, logDeviceRemoved } from './Logs'

const MAX_DEVICES = 5
const STORAGE_KEY = 'avinya_devices'

const loadDevicesState = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { devices: [], defaultId: null }
    const parsed = JSON.parse(raw)
    return {
      devices: Array.isArray(parsed.devices) ? parsed.devices : [],
      defaultId: parsed.defaultId ?? null,
    }
  } catch {
    return { devices: [], defaultId: null }
  }
}

const saveDevicesState = (devices, defaultId) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ devices, defaultId }))
  } catch {
  }
}

const Devices = ({ onLogout, onNavigate, isDarkMode, onThemeToggle }) => {
  const [isEntitiesOpen, setIsEntitiesOpen] = useState(true)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false)

  const [devices, setDevices] = useState(() => loadDevicesState().devices)
  const [defaultId, setDefaultId] = useState(() => loadDevicesState().defaultId)

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [formId, setFormId] = useState('')
  const [formDesc, setFormDesc] = useState('')
  const [formIdError, setFormIdError] = useState('')

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
    saveDevicesState(devices, defaultId)
  }, [devices, defaultId])

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
    if (!isModalOpen) return
    const handleKey = (e) => { if (e.key === 'Escape') closeModal() }
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

  const openModal = () => {
    setFormId('')
    setFormDesc('')
    setFormIdError('')
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setFormId('')
    setFormDesc('')
    setFormIdError('')
  }

  const handleAddDevice = () => {
    const trimmedId = formId.trim()
    const trimmedDesc = formDesc.trim()

    if (!trimmedId) {
      setFormIdError('Device ID cannot be empty.')
      return
    }
    if (devices.some((d) => d.id === trimmedId)) {
      setFormIdError('This Device ID already exists.')
      return
    }
    if (devices.length >= MAX_DEVICES) {
      setFormIdError(`You can only add up to ${MAX_DEVICES} Device IDs.`)
      return
    }

    const newDevice = { id: trimmedId, description: trimmedDesc }
    const updated = [...devices, newDevice]
    setDevices(updated)
    if (updated.length === 1) setDefaultId(trimmedId)
    closeModal()
  }

  const handleSetDefault = (id) => {
    setDefaultId(id)
  }

  const handleRemoveDevice = async (id) => {
    const result = await Swal.fire({
      title: 'Remove Device?',
      text: `Are you sure you want to remove "${id}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Remove',
      cancelButtonText: 'Cancel',
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

    const updated = devices.filter((d) => d.id !== id)
    setDevices(updated)
    if (defaultId === id) setDefaultId(updated.length > 0 ? updated[0].id : null)
  }

  const atLimit = devices.length >= MAX_DEVICES

  const slots = [
    ...devices,
    ...Array.from({ length: MAX_DEVICES - devices.length }, (_, i) => ({
      id: null,
      description: null,
      _emptyIndex: devices.length + i,
    })),
  ]

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
<<<<<<< HEAD
          <div className="dashboard-page-title-row">
            <h1 className="dashboard-content-title">Devices</h1>
          </div>
=======

          <div className="dashboard-header devices-page-topbar">
            <h1 id="devices-page-title" className="dashboard-content-title">Devices</h1>
            <span className="devices-topbar-count">
              {devices.length} of {MAX_DEVICES} Device IDs Used
            </span>
          </div>

          <section className="devices-panel" aria-labelledby="devices-page-title">

            <div className="devices-panel-toolbar">
              <div className="devices-toolbar-left">
              </div>

              {!atLimit ? (
                <button
                  type="button"
                  className="devices-add-btn"
                  onClick={openModal}
                >
                  <span className="devices-add-btn-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                  </span>
                  <span>Add Device ID</span>
                </button>
              ) : (
                <span className="devices-limit-badge">
                  Limit Reached ({MAX_DEVICES}/{MAX_DEVICES})
                </span>
              )}
            </div>

            <div className="devices-slots" role="list" aria-label="Device IDs">
              {slots.map((slot, index) => {
                const isFilled = slot.id !== null
                const isDefault = slot.id === defaultId

                return (
                  <div
                    key={isFilled ? slot.id : `empty-${slot._emptyIndex}`}
                    className={[
                      'devices-slot',
                      isFilled ? 'devices-slot-filled' : 'devices-slot-empty',
                      isDefault ? 'devices-slot-default' : '',
                    ].filter(Boolean).join(' ')}
                    role="listitem"
                  >
                    <span className="devices-slot-number" aria-hidden="true">
                      {index + 1}
                    </span>

                    {isFilled ? (
                      <>
                        <span className="devices-slot-icon" aria-hidden="true">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="3" y="7" width="7" height="10" rx="1.5" />
                            <rect x="14" y="7" width="7" height="10" rx="1.5" />
                            <path d="M6.5 10.5h.01" /><path d="M17.5 10.5h.01" />
                          </svg>
                        </span>

                        <div className="devices-slot-info">
                          <span className="devices-slot-id">{slot.id}</span>
                          {slot.description && (
                            <span className="devices-slot-desc">{slot.description}</span>
                          )}
                        </div>

                        <div className="devices-slot-right">
                          {isDefault && (
                            <span className="devices-slot-default-badge">
                              <svg viewBox="0 0 24 24" fill="currentColor" width="10" height="10" aria-hidden="true">
                                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 21 12 17.77 5.82 21 7 14.14l-5-4.87 6.91-1.01L12 2z" />
                              </svg>
                              Default
                            </span>
                          )}

                          <div className="devices-slot-actions">
                            {!isDefault && (
                              <button
                                type="button"
                                className="devices-slot-action-btn devices-slot-set-default"
                                onClick={() => handleSetDefault(slot.id)}
                                title="Set as default"
                              >
                                Set Default
                              </button>
                            )}
                            <button
                              type="button"
                              className="devices-slot-action-btn devices-slot-remove"
                              onClick={() => handleRemoveDevice(slot.id)}
                              aria-label={`Remove ${slot.id}`}
                              title="Remove"
                            >
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <span className="devices-slot-icon devices-slot-empty-icon" aria-hidden="true">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <rect x="3" y="7" width="7" height="10" rx="1.5" />
                            <rect x="14" y="7" width="7" height="10" rx="1.5" />
                            <path d="M6.5 10.5h.01" /><path d="M17.5 10.5h.01" />
                          </svg>
                        </span>

                        <span className="devices-slot-empty-label">Empty Slot</span>

                        <div className="devices-slot-right">
                          <button
                            type="button"
                            className="devices-slot-action-btn devices-slot-add-here"
                            onClick={openModal}
                            aria-label={`Add device to slot ${index + 1}`}
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="12" height="12">
                              <path d="M12 5v14M5 12h14" />
                            </svg>
                            Add
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
>>>>>>> ff2c2e8c377abb0676789e876a63bb18185ff269
        </div>
      </section>

      {isModalOpen && (
        <div
          className="devices-modal-backdrop"
          onClick={(e) => { if (e.target === e.currentTarget) closeModal() }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="devices-modal-title"
        >
          <div className="devices-modal">
            <div className="devices-modal-header">
              <h2 className="devices-modal-title" id="devices-modal-title">Add Device ID</h2>
              <button
                type="button"
                className="devices-modal-close"
                onClick={closeModal}
                aria-label="Close"
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
                    placeholder="e.g. DEV-001"
                    value={formId}
                    onChange={(e) => { setFormId(e.target.value); setFormIdError('') }}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleAddDevice() }}
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
                  <span className="devices-field-optional">optional</span>
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
              <button type="button" className="devices-modal-cancel-btn" onClick={closeModal}>
                Cancel
              </button>
              <button type="button" className="devices-modal-confirm-btn" onClick={handleAddDevice}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="14" height="14">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                Add Device
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

export default Devices