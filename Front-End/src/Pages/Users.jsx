import { useEffect, useState } from 'react'
import Swal from 'sweetalert2'
import 'sweetalert2/dist/sweetalert2.min.css'
import { countries } from 'country-list-json'
import * as FlagIcons from 'country-flag-icons/react/3x2'
import logo from '../Pictures/Avinya.png'
import '../Styles/Users.css'
import { EditIcon, TrashIcon } from '../Components/Icons.jsx'
import { getCurrentUserProfile, isTenantAdministratorRole } from '../Utils/getCurrentUserProfile'
import { performReliableLogout } from '../Utils/performReliableLogout'
import { API_URL, buildApiAssetUrl } from '../Config/API'

const getStoredAuthToken = () =>
  sessionStorage.getItem('tbToken') ||
  localStorage.getItem('tbToken') ||
  ''

const COUNTRY_CODE_OPTIONS = countries
  .filter((country) => country.code && country.name && country.dial_code)
  .map((country) => ({
    value: country.dial_code,
    iso: country.code,
    shortLabel: `${country.code} (${country.dial_code})`
  }))

const getCountryCodeOption = (dialCode = '') =>
  COUNTRY_CODE_OPTIONS.find(
    (option) => option.value === String(dialCode || '').trim()
  ) || {
    value: String(dialCode || '+63').trim() || '+63',
    iso: 'PH',
    shortLabel: `PH (${String(dialCode || '+63').trim() || '+63'})`
  }

const renderCountryFlag = (isoCode, className) => {
  const normalizedIso = String(isoCode || '').trim().toUpperCase()
  const FlagIcon = FlagIcons[normalizedIso]

  if (!FlagIcon) {
    return null
  }

  return <FlagIcon className={className} aria-hidden="true" />
}

const getUserInitials = (firstName = '', lastName = '', email = '') =>
  [firstName, lastName]
    .filter(Boolean)
    .map((value) => String(value).trim().charAt(0).toUpperCase())
    .join('')
    .slice(0, 2) || String(email || 'U').trim().charAt(0).toUpperCase()

const Users = ({ onLogout, onNavigate, isDarkMode, onThemeToggle }) => {
  const [isEntitiesOpen, setIsEntitiesOpen] = useState(false)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false)
  const [users, setUsers] = useState([])
  const [isUsersLoading, setIsUsersLoading] = useState(true)
  const [usersLoadError, setUsersLoadError] = useState('')

  const user = getCurrentUserProfile()
  const isTenantAdministrator = isTenantAdministratorRole(user.roleLabel)

  const sidebarProfileImagePreview = buildApiAssetUrl(user.profilePictureUrl)

  const sidebarUserInitials = [user.firstName, user.lastName]
    .filter(Boolean)
    .map((value) => String(value).trim().charAt(0).toUpperCase())
    .join('')
    .slice(0, 2) || 'A'

  const closeDropdowns = () => {
    setIsEntitiesOpen(false)
    setIsProfileMenuOpen(false)
  }

  useEffect(() => {
    document.title = 'Avinya | Users'

    const handleOutsideClick = (event) => {
      if (!(event.target instanceof Element)) return

      if (!event.target.closest('.dashboard-sidebar-user-group')) {
        setIsProfileMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleOutsideClick)

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
    }
  }, [])

  useEffect(() => {
    if (!isTenantAdministrator) {
      onNavigate('dashboard')
    }
  }, [isTenantAdministrator, onNavigate])

  useEffect(() => {
    if (!isTenantAdministrator) {
      return
    }

    let isMounted = true
    const controller = new AbortController()

    const loadCustomerAdministrators = async () => {
      try {
        setIsUsersLoading(true)
        setUsersLoadError('')

        const authToken = getStoredAuthToken()

        if (!authToken) {
          throw new Error('Your session has expired. Please log in again.')
        }

        const response = await fetch(`${API_URL}/users/customer-administrators`, {
          method: 'GET',
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${authToken}`
          },
          signal: controller.signal
        })

        const data = await response.json().catch(() => ({}))

        if (!response.ok) {
          throw new Error(data.message || 'Unable to load customer administrators right now.')
        }

        if (!isMounted) return

        setUsers(Array.isArray(data.users) ? data.users : [])
      } catch (error) {
        if (error.name === 'AbortError') {
          return
        }

        if (!isMounted) return

        setUsers([])
        setUsersLoadError(
          error.message || 'Unable to load customer administrators right now.'
        )
      } finally {
        if (isMounted) {
          setIsUsersLoading(false)
        }
      }
    }

    loadCustomerAdministrators()

    return () => {
      isMounted = false
      controller.abort()
    }
  }, [isTenantAdministrator])

  const handleSidebarToggle = () => {
    if (!isSidebarCollapsed) {
      closeDropdowns()
    }

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
        cancelButton: 'avinya-swal-cancel'
      }
    })

    if (!result.isConfirmed) return

    closeDropdowns()
    performReliableLogout(onLogout)
  }

  if (!isTenantAdministrator) {
    return null
  }

  return (
    <main className="dashboard-page users-page">
      <aside className={`dashboard-sidebar ${isSidebarCollapsed ? 'collapsed' : ''}`}>
        <div className="dashboard-sidebar-panel">
          <div className="dashboard-sidebar-header">
            <div className="dashboard-sidebar-top">
              <img
                src={logo}
                alt="Avinya Logo"
                className="dashboard-sidebar-logo"
              />
              <span className="dashboard-sidebar-brand">AVINYA</span>
            </div>

            <button
              type="button"
              className="dashboard-sidebar-collapse"
              onClick={handleSidebarToggle}
              aria-label={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                {isSidebarCollapsed ? (
                  <path d="M9 6l6 6-6 6" />
                ) : (
                  <path d="M15 6l-6 6 6 6" />
                )}
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
                    <path d="M4 7h7" />
                    <path d="M4 12h10" />
                    <path d="M4 17h7" />
                    <circle cx="17" cy="7" r="2" />
                    <circle cx="20" cy="12" r="2" />
                    <circle cx="17" cy="17" r="2" />
                  </svg>
                </span>

                <span className="dashboard-sidebar-link-label">Entities</span>

                <span className="dashboard-sidebar-link-end" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    {isEntitiesOpen ? (
                      <path d="M18 15l-6-6-6 6" />
                    ) : (
                      <path d="M6 9l6 6 6-6" />
                    )}
                  </svg>
                </span>
              </button>

              <div className={`dashboard-sidebar-submenu ${isEntitiesOpen ? 'open' : ''}`}>
                <button
                  type="button"
                  className="dashboard-sidebar-sublink"
                  onClick={() => onNavigate('devices')}
                >
                  <span className="dashboard-sidebar-sublink-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="7" width="7" height="10" rx="1.5" />
                      <rect x="14" y="7" width="7" height="10" rx="1.5" />
                      <path d="M6.5 10.5h.01" />
                      <path d="M17.5 10.5h.01" />
                    </svg>
                  </span>
                  <span className="dashboard-sidebar-sublink-label">Devices</span>
                </button>
              </div>
            </div>

            <button
                type="button"
                className="dashboard-sidebar-link active"
                data-tooltip="Users"
                aria-current="page"
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
                    <path d="M12 2v2" />
                    <path d="M12 20v2" />
                    <path d="m4.93 4.93 1.41 1.41" />
                    <path d="m17.66 17.66 1.41 1.41" />
                    <path d="M2 12h2" />
                    <path d="M20 12h2" />
                    <path d="m6.34 17.66-1.41 1.41" />
                    <path d="m19.07 4.93-1.41 1.41" />
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
                    <img
                      src={sidebarProfileImagePreview}
                      alt=""
                      className="dashboard-sidebar-user-avatar-image"
                    />
                  ) : (
                    <div className="dashboard-sidebar-user-avatar-fallback">
                      <span className="dashboard-sidebar-user-avatar-fallback-text">
                        {sidebarUserInitials}
                      </span>
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
                    <circle cx="12" cy="5" r="1.8" />
                    <circle cx="12" cy="12" r="1.8" />
                    <circle cx="12" cy="19" r="1.8" />
                  </svg>
                </button>
              </div>

              <div className={`dashboard-sidebar-user-menu ${isProfileMenuOpen ? 'open' : ''}`}>
                <button
                  type="button"
                  className="dashboard-sidebar-user-menu-item"
                  onClick={() => {
                    closeDropdowns()
                    onNavigate('account')
                  }}
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
          <h1 id="users-page-title" className="dashboard-content-title">Users</h1>

          <section className="users-panel" aria-labelledby="users-page-title">

            <div className="users-table-shell">
              <div
                className={`users-table-scroll ${
                  !isUsersLoading && !usersLoadError && users.length === 0
                    ? 'users-table-scroll-empty'
                    : ''
                }`}
                role="region"
                aria-label="Users table"
                tabIndex="0"
              >
                <table className="users-table">
                  <thead>
                    <tr className="users-table-head-row">
                      <th scope="col">No.</th>
                      <th scope="col">Profile Picture</th>
                      <th scope="col">Last Name</th>
                      <th scope="col">First Name</th>
                      <th scope="col">Email</th>
                      <th scope="col">Country Code</th>
                      <th scope="col">Phone Number</th>
                      <th scope="col">Status</th>
                      <th scope="col">Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {isUsersLoading ? (
                      <tr className="users-table-state-row">
                        <td colSpan="9" className="users-table-state-cell">
                          Loading customer administrators...
                        </td>
                      </tr>
                    ) : usersLoadError ? (
                      <tr className="users-table-state-row">
                        <td colSpan="9" className="users-table-state-cell users-table-state-cell-error">
                          {usersLoadError}
                        </td>
                      </tr>
                    ) : users.length === 0 ? (
                      <tr className="users-table-state-row users-table-state-row-empty" aria-hidden="true">
                        <td colSpan="9" className="users-table-state-cell">
                          &nbsp;
                        </td>
                      </tr>
                    ) : (
                      users.map((listedUser, index) => {
                        const profileImagePreview = buildApiAssetUrl(listedUser.profilePictureUrl)
                        const userInitials = getUserInitials(
                          listedUser.firstName,
                          listedUser.lastName,
                          listedUser.email
                        )
                        const countryOption = getCountryCodeOption(listedUser.phoneCountryCode)

                        return (
                          <tr key={listedUser.id} className="users-table-body-row">
                            <td>{index + 1}</td>

                            <td className="users-picture-cell">
                              <div className="users-profile-cell">
                                <div className="users-profile-avatar" aria-hidden="true">
                                  {profileImagePreview ? (
                                    <img
                                      src={profileImagePreview}
                                      alt=""
                                      className="users-profile-avatar-image"
                                    />
                                  ) : (
                                    <div className="users-profile-avatar-fallback">
                                      <span className="users-profile-avatar-fallback-text">
                                        {userInitials}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>

                            <td>
                              <span className="users-cell-text" title={listedUser.lastName || ''}>
                                {listedUser.lastName || '—'}
                              </span>
                            </td>

                            <td>
                              <span className="users-cell-text" title={listedUser.firstName || ''}>
                                {listedUser.firstName || '—'}
                              </span>
                            </td>

                            <td>
                              <span className="users-cell-text" title={listedUser.email || ''}>
                                {listedUser.email || '—'}
                              </span>
                            </td>

                            <td>
                              <div className="users-country-value">
                                {renderCountryFlag(countryOption.iso, 'users-country-flag')}
                                <span>{countryOption.shortLabel}</span>
                              </div>
                            </td>

                            <td>
                              <span
                                className="users-cell-text"
                                title={String(listedUser.phoneNumber || '').trim() || 'N/A'}
                              >
                                {String(listedUser.phoneNumber || '').trim() || 'N/A'}
                              </span>
                            </td>

                            <td>
                              <span
                                className={`users-status-badge ${
                                  listedUser.isVerified ? 'verified' : 'unverified'
                                }`}
                              >
                                <span className="users-status-badge-icon" aria-hidden="true">
                                  {listedUser.isVerified ? '✓' : '✕'}
                                </span>
                                <span>{listedUser.isVerified ? 'Verified' : 'Not Verified'}</span>
                              </span>
                            </td>

                            <td>
                              <div className="users-actions">
                                <button
                                  type="button"
                                  className="users-action-button users-action-button-edit"
                                >
                                  <span className="users-action-button-icon" aria-hidden="true">
                                    <EditIcon />
                                  </span>
                                  <span>Edit</span>
                                </button>

                                <button
                                  type="button"
                                  className="users-action-button users-action-button-delete"
                                >
                                  <span className="users-action-button-icon" aria-hidden="true">
                                    <TrashIcon />
                                  </span>
                                  <span>Delete</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>

                {!isUsersLoading && !usersLoadError && users.length === 0 && (
                  <div className="users-table-empty-state" aria-live="polite">
                    No customer administrators found.
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      </section>
    </main>
  )
}

export default Users