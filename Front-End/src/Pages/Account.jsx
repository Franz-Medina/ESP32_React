import { useEffect, useRef, useState } from 'react'
import Swal from 'sweetalert2'
import 'sweetalert2/dist/sweetalert2.min.css'
import { countries } from 'country-list-json'
import logo from '../Pictures/Avinya.png'
import '../Styles/Account.css'
import {
  CameraIcon,
  PhoneIcon,
  UserIcon
} from '../Components/LoginIcons.jsx'
import { getCurrentUserProfile } from '../Utils/getCurrentUserProfile'

const getInitialAccountForm = (user = {}) => {
  const safeFullName = String(user.fullName || '').trim()
  const fullNameParts = safeFullName.split(/\s+/).filter(Boolean)

  const firstName =
    String(user.firstName || '').trim() ||
    (fullNameParts.length > 1 ? fullNameParts.slice(0, -1).join(' ') : safeFullName)

  const lastName =
    String(user.lastName || '').trim() ||
    (fullNameParts.length > 1 ? fullNameParts.slice(-1).join(' ') : '')

  return {
    firstName,
    lastName,
    email: String(user.email || '').trim(),
    phoneCountryCode: String(user.phoneCountryCode || '+63').trim(),
    phoneCountryOptionId: String(user.phoneCountryOptionId || 'PH-+63').trim(),
    phoneNumber: String(user.phoneNumber || '').trim()
  }
}

const COUNTRY_CODE_OPTIONS = countries
  .filter((country) => country.code && country.name && country.dial_code)
  .map((country) => ({
    id: `${country.code}-${country.dial_code}`,
    value: country.dial_code,
    iso: country.code,
    label: `${country.code} ${country.name} (${country.dial_code})`,
    shortLabel: `${country.code} (${country.dial_code})`
  }))
  .sort((a, b) => a.label.localeCompare(b.label))

const Account = ({ onLogout, onNavigate, isDarkMode, onThemeToggle }) => {
  const [isEntitiesOpen, setIsEntitiesOpen] = useState(false)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false)
  const [isCountryCodeOpen, setIsCountryCodeOpen] = useState(false)

  const user = getCurrentUserProfile()

  const [profileForm, setProfileForm] = useState(() => getInitialAccountForm(user))
  const [profileImagePreview, setProfileImagePreview] = useState('')
  const [profileImageName, setProfileImageName] = useState('')
  const [profileImageError, setProfileImageError] = useState('')

  const profileImageInputRef = useRef(null)
  const countryCodeDropdownRef = useRef(null)

  const handleProfileInputChange = (field) => (event) => {
    const nextValue = event.target.value

    setProfileForm((prev) => ({
      ...prev,
      [field]: nextValue
    }))
  }

  const handleProfileImageChange = (event) => {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    if (!file.type.startsWith('image/')) {
      setProfileImageError('Please select a valid image file.')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setProfileImageError('Profile image must be 5 MB or smaller.')
      return
    }

    const reader = new FileReader()

    reader.onload = () => {
      setProfileImagePreview(String(reader.result || ''))
      setProfileImageName(file.name)
      setProfileImageError('')
    }

    reader.readAsDataURL(file)
  }

  const handleRemoveProfileImage = () => {
    setProfileImagePreview('')
    setProfileImageName('')
    setProfileImageError('')

    if (profileImageInputRef.current) {
      profileImageInputRef.current.value = ''
    }
  }

  const selectedCountryCodeOption =
    COUNTRY_CODE_OPTIONS.find((option) => option.id === profileForm.phoneCountryOptionId) ||
    COUNTRY_CODE_OPTIONS.find((option) => option.value === profileForm.phoneCountryCode) ||
    COUNTRY_CODE_OPTIONS[0]

  const handleCountryCodeToggle = () => {
    setIsCountryCodeOpen((prev) => !prev)
  }

  const handleCountryCodeSelect = (option) => {
    setProfileForm((prev) => ({
      ...prev,
      phoneCountryCode: option.value,
      phoneCountryOptionId: option.id
    }))
    setIsCountryCodeOpen(false)
  }

  const closeDropdowns = () => {
    setIsEntitiesOpen(false)
    setIsProfileMenuOpen(false)
    setIsCountryCodeOpen(false)
  }

  useEffect(() => {
    setProfileForm(getInitialAccountForm(user))
  }, [
    user.firstName,
    user.lastName,
    user.fullName,
    user.email,
    user.phoneCountryCode,
    user.phoneCountryOptionId,
    user.phoneNumber
  ])

  useEffect(() => {
    document.title = 'Avinya | Account'

    const handleOutsideClick = (event) => {
      if (!(event.target instanceof Element)) return

      if (!event.target.closest('.dashboard-sidebar-user-group')) {
        setIsProfileMenuOpen(false)
      }

      if (!event.target.closest('.account-country-dropdown')) {
        setIsCountryCodeOpen(false)
      }
    }

    document.addEventListener('mousedown', handleOutsideClick)

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
    }
  }, [])

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
    onLogout()
  }

  const accountInitials = [profileForm.firstName, profileForm.lastName]
    .filter(Boolean)
    .map((value) => String(value).trim().charAt(0).toUpperCase())
    .join('')
    .slice(0, 2) || 'A'

  return (
    <main className="dashboard-page">
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
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 21a8 8 0 0 0-16 0" />
                    <circle cx="12" cy="8" r="4" />
                  </svg>
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
                    className="dashboard-sidebar-user-menu-item active"
                    aria-current="page"
                    onClick={closeDropdowns}
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
        <div className="dashboard-content-body">
          <h1 className="dashboard-content-title">Account</h1>

          <section className="account-panel" aria-labelledby="account-profile-heading">
            <div className="account-layout">
              <aside className="account-profile-card">
                <div className="account-card-header">
                  <h2 className="account-card-heading">Profile</h2>
                  <p className="account-card-text">
                    Update your display photo and quick profile details.
                  </p>
                </div>

                <div className="account-avatar-section">
                  <div className="account-avatar-frame">
                    {profileImagePreview ? (
                      <img
                        src={profileImagePreview}
                        alt="Profile preview"
                        className="account-avatar-image"
                      />
                    ) : (
                      <div className="account-avatar-fallback" aria-hidden="true">
                        <span className="account-avatar-fallback-text">{accountInitials}</span>
                      </div>
                    )}
                  </div>

                  <div className="account-avatar-actions">
                    <input
                      ref={profileImageInputRef}
                      id="account-profile-image-input"
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="account-profile-file-input"
                      onChange={handleProfileImageChange}
                    />

                    <button
                      type="button"
                      className="account-button account-button-secondary account-profile-remove"
                      onClick={handleRemoveProfileImage}
                    >
                      Remove
                    </button>

                    <label
                      htmlFor="account-profile-image-input"
                      className="account-button account-button-primary account-profile-upload"
                    >
                      <span className="account-button-icon" aria-hidden="true">
                        <CameraIcon />
                      </span>
                      <span>Change Photo</span>
                    </label>
                  </div>

                  <p className="account-avatar-helper">
                    {profileImageName || 'PNG, JPG, or WEBP up to 5 MB.'}
                  </p>

                  {profileImageError && (
                    <p className="account-inline-error">{profileImageError}</p>
                  )}
                </div>

                <div className="account-summary-card">
                  <span className="account-summary-name">{user.fullName}</span>
                  <span className="account-summary-role">{user.roleLabel}</span>
                </div>
              </aside>

              <div className="account-main-card">
                <div className="account-panel-header">
                  <div className="account-panel-copy">
                    <h2 id="account-profile-heading" className="account-panel-heading">
                      Profile Details
                    </h2>
                    <p className="account-panel-text">
                      Manage your account information in one place.
                    </p>
                  </div>

                  <span className="account-role-badge">{user.roleLabel}</span>
                </div>

                <div className="account-form-grid">
                  <div className="account-field-group">
                    <div className="account-field account-floating-field">
                      <span className="account-field-icon" aria-hidden="true">
                        <UserIcon />
                      </span>

                      <div className="account-floating-control">
                        <input
                          id="account-first-name"
                          type="text"
                          className="account-input account-floating-input"
                          placeholder=" "
                          value={profileForm.firstName}
                          onChange={handleProfileInputChange('firstName')}
                          autoComplete="given-name"
                        />
                        <label htmlFor="account-first-name" className="account-floating-label">
                          First Name
                        </label>
                      </div>
                    </div>
                  </div>

                  <div className="account-field-group">
                    <div className="account-field account-floating-field">
                      <span className="account-field-icon" aria-hidden="true">
                        <UserIcon />
                      </span>

                      <div className="account-floating-control">
                        <input
                          id="account-last-name"
                          type="text"
                          className="account-input account-floating-input"
                          placeholder=" "
                          value={profileForm.lastName}
                          onChange={handleProfileInputChange('lastName')}
                          autoComplete="family-name"
                        />
                        <label htmlFor="account-last-name" className="account-floating-label">
                          Last Name
                        </label>
                      </div>
                    </div>
                  </div>

                  <div className="account-field-group account-field-group-full">
                    <div className="account-field account-floating-field">
                      <span className="account-field-icon" aria-hidden="true">
                        <UserIcon />
                      </span>

                      <div className="account-floating-control">
                        <input
                          id="account-email"
                          type="email"
                          className="account-input account-floating-input"
                          placeholder=" "
                          value={profileForm.email}
                          onChange={handleProfileInputChange('email')}
                          autoComplete="email"
                        />
                        <label htmlFor="account-email" className="account-floating-label">
                          Email
                        </label>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="account-phone-row">
                  <div className="account-country-group">
                    <div
                      className={`account-country-dropdown ${isCountryCodeOpen ? 'open' : ''}`}
                      ref={countryCodeDropdownRef}
                    >
                      <button
                        type="button"
                        className={`account-field account-floating-field account-dropdown-trigger ${isCountryCodeOpen ? 'account-dropdown-trigger-open' : ''}`}
                        onClick={handleCountryCodeToggle}
                        aria-haspopup="listbox"
                        aria-expanded={isCountryCodeOpen}
                      >
                        <div className="account-floating-control">
                          <span className="account-dropdown-value account-dropdown-value-desktop">
                            {selectedCountryCodeOption.label}
                          </span>
                          <span className="account-dropdown-value account-dropdown-value-mobile">
                            {selectedCountryCodeOption.shortLabel}
                          </span>
                          <span className="account-floating-label account-floating-label-static">
                            Country Code
                          </span>
                        </div>

                        <span className="account-dropdown-arrow" aria-hidden="true">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d={isCountryCodeOpen ? 'M18 15l-6-6-6 6' : 'M6 9l6 6 6-6'} />
                          </svg>
                        </span>
                      </button>

                      <div className={`account-dropdown-menu ${isCountryCodeOpen ? 'open' : ''}`} role="listbox">
                        {COUNTRY_CODE_OPTIONS.map((option) => (
                          <button
                            key={option.id}
                            type="button"
                            className={`account-dropdown-option ${profileForm.phoneCountryOptionId === option.id ? 'active' : ''}`}
                            onClick={() => handleCountryCodeSelect(option)}
                          >
                            <span className="account-dropdown-option-label-desktop">{option.label}</span>
                            <span className="account-dropdown-option-label-mobile">{option.shortLabel}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="account-phone-group">
                    <div className="account-field account-floating-field">
                      <span className="account-field-icon" aria-hidden="true">
                        <PhoneIcon />
                      </span>

                      <div className="account-floating-control">
                        <input
                          id="account-phone-number"
                          type="tel"
                          className="account-input account-floating-input"
                          placeholder=" "
                          value={profileForm.phoneNumber}
                          onChange={handleProfileInputChange('phoneNumber')}
                          autoComplete="tel-national"
                        />
                        <label htmlFor="account-phone-number" className="account-floating-label">
                          Phone Number
                        </label>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="account-actions">
                  <button
                    type="button"
                    className="account-button account-button-secondary"
                  >
                    Delete User Account
                  </button>

                  <button
                    type="button"
                    className="account-button account-button-primary"
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>
      </section>
    </main>
  )
}

export default Account