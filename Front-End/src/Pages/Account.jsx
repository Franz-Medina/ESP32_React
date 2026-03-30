import { useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import Swal from 'sweetalert2'
import Cropper from 'react-easy-crop'
import 'sweetalert2/dist/sweetalert2.min.css'
import { countries } from 'country-list-json'
import * as FlagIcons from 'country-flag-icons/react/3x2'
import logo from '../Pictures/Avinya.png'
import '../Styles/Account.css'
import {
  CameraIcon,
  GlobeIcon,
  PhoneIcon,
  UserIcon,
  ErrorIcon
} from '../Components/LoginIcons.jsx'
import { getCurrentUserProfile } from '../Utils/getCurrentUserProfile'
import { getCroppedImageDataUrl } from '../Utils/cropImage'

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

const renderCountryFlag = (isoCode, className) => {
  const normalizedIso = String(isoCode || '').trim().toUpperCase()
  const FlagIcon = FlagIcons[normalizedIso]

  if (!FlagIcon) {
    return null
  }

  return <FlagIcon className={className} aria-hidden="true" />
}

const NAME_REGEX = /^[A-Za-zÀ-ÖØ-öø-ÿ]+(?:[ '-][A-Za-zÀ-ÖØ-ÿ]+)*$/
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const ALLOWED_PROFILE_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']

const getNameValidationError = (value, label) => {
  if (!value) {
    return `Please enter your ${label.toLowerCase()}.`
  }

  if (value.length < 2) {
    return `${label} must be at least 2 characters.`
  }

  if (value.length > 50) {
    return `${label} must not exceed 50 characters.`
  }

  if (!NAME_REGEX.test(value)) {
    return `${label} contains invalid characters.`
  }

  return ''
}

const getEmailValidationError = (value) => {
  if (!value) {
    return 'Please enter your email.'
  }

  if (/\s/.test(value)) {
    return 'Email address must not contain spaces.'
  }

  if (value.length > 254) {
    return 'Email address is too long.'
  }

  if (!EMAIL_REGEX.test(value)) {
    return 'Please enter a valid email address.'
  }

  return ''
}

const getPhoneNumberValidationError = (value) => {
  if (!value) {
    return ''
  }

  if (value !== value.trim()) {
    return 'Phone number must not start or end with spaces.'
  }

  if (value.includes('+')) {
    return 'Enter your phone number without the country code.'
  }

  if (!/^[0-9\s()-]+$/.test(value)) {
    return 'Phone number must contain numbers only.'
  }

  const digitsOnly = value.replace(/\D/g, '')

  if (digitsOnly.length < 7) {
    return 'Phone number must be at least 7 digits.'
  }

  if (digitsOnly.length > 15) {
    return 'Phone number must not exceed 15 digits.'
  }

  return ''
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

  const [firstNameError, setFirstNameError] = useState('')
  const [lastNameError, setLastNameError] = useState('')
  const [emailError, setEmailError] = useState('')
  const [phoneNumberError, setPhoneNumberError] = useState('')
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [photoProcessingMode, setPhotoProcessingMode] = useState('')
  const [isPhotoCropModalOpen, setIsPhotoCropModalOpen] = useState(false)
  const [photoCropSource, setPhotoCropSource] = useState('')
  const [photoCropValue, setPhotoCropValue] = useState({ x: 0, y: 0 })
  const [photoZoomValue, setPhotoZoomValue] = useState(0.75)
  const [photoCroppedAreaPixels, setPhotoCroppedAreaPixels] = useState(null)
  const [pendingProfileImageName, setPendingProfileImageName] = useState('')

  const profileImageInputRef = useRef(null)
  const countryCodeDropdownRef = useRef(null)

  const handleProfileInputChange = (field) => (event) => {
    const nextValue = event.target.value

    setProfileForm((prev) => ({
      ...prev,
      [field]: nextValue
    }))

    if (field === 'firstName' && firstNameError) {
      setFirstNameError('')
    }

    if (field === 'lastName' && lastNameError) {
      setLastNameError('')
    }

    if (field === 'email' && emailError) {
      setEmailError('')
    }

    if (field === 'phoneNumber' && phoneNumberError) {
      setPhoneNumberError('')
    }
  }

  const resetPhotoCropState = () => {
    setIsPhotoCropModalOpen(false)
    setPhotoCropSource('')
    setPhotoCropValue({ x: 0, y: 0 })
    setPhotoZoomValue(0.75)
    setPhotoCroppedAreaPixels(null)
    setPendingProfileImageName('')

    if (profileImageInputRef.current) {
      profileImageInputRef.current.value = ''
    }
  }

  const handleOpenPhotoPicker = () => {
    if (!profileImageInputRef.current) {
      return
    }

    setProfileImageError('')

    flushSync(() => {
      setPhotoProcessingMode('picker-opening')
    })

    window.addEventListener(
      'focus',
      () => {
        window.setTimeout(() => {
          setPhotoProcessingMode((prev) =>
            prev === 'picker-opening' ? '' : prev
          )
        }, 180)
      },
      { once: true }
    )

    profileImageInputRef.current.click()
  }

  const handlePhotoCropComplete = (_, croppedAreaPixels) => {
    setPhotoCroppedAreaPixels(croppedAreaPixels)
  }

  const handleClosePhotoCropModal = async () => {
    setPhotoProcessingMode('picker-closing')

    await new Promise((resolve) => setTimeout(resolve, 320))

    resetPhotoCropState()
    setPhotoProcessingMode('')
  }

  const handleProfileImageChange = (event) => {
    const file = event.target.files?.[0]

    if (!file) {
      setPhotoProcessingMode('')
      return
    }

    if (!ALLOWED_PROFILE_IMAGE_TYPES.includes(file.type)) {
      setPhotoProcessingMode('')
      setProfileImageError('Please select a JPG, JPEG, PNG, or WEBP image.')

      if (profileImageInputRef.current) {
        profileImageInputRef.current.value = ''
      }

      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setPhotoProcessingMode('')
      setProfileImageError('Profile image must be 5 MB or smaller.')

      if (profileImageInputRef.current) {
        profileImageInputRef.current.value = ''
      }

      return
    }

    const reader = new FileReader()

    reader.onload = async () => {
      try {
        setPhotoProcessingMode('photo-loading')
        setPendingProfileImageName(file.name)
        setProfileImageError('')

        await new Promise((resolve) => setTimeout(resolve, 450))

        setPhotoCropSource(String(reader.result || ''))
        setPhotoCropValue({ x: 0, y: 0 })
        setPhotoZoomValue(0.75)
        setPhotoCroppedAreaPixels(null)
        setIsPhotoCropModalOpen(true)
      } catch {
        setProfileImageError('Something went wrong while loading your profile image. Please try again.')
      } finally {
        setPhotoProcessingMode('')
      }
    }

    reader.onerror = () => {
      setPhotoProcessingMode('')
      setProfileImageError('Something went wrong while loading your profile image. Please try again.')
    }

    reader.readAsDataURL(file)
  }

  const handleApplyPhotoCrop = async () => {
    if (!photoCropSource || !photoCroppedAreaPixels) {
      return
    }

    try {
      setPhotoProcessingMode('photo-applying')

      await new Promise((resolve) => setTimeout(resolve, 650))

      const nextProfileImagePreview = await getCroppedImageDataUrl(
        photoCropSource,
        photoCroppedAreaPixels
      )

      setProfileImagePreview(nextProfileImagePreview)
      setProfileImageName(pendingProfileImageName)
      setProfileImageError('')
      resetPhotoCropState()
    } catch {
      setProfileImageError('Something went wrong while updating your profile image. Please try again.')
    } finally {
      setPhotoProcessingMode('')
    }
  }

  const handleRemoveProfileImage = async () => {
    setPhotoProcessingMode('photo-removing')

    await new Promise((resolve) => setTimeout(resolve, 420))

    setProfileImagePreview('')
    setProfileImageName('')
    setProfileImageError('')
    resetPhotoCropState()
    setPhotoProcessingMode('')

    if (profileImageInputRef.current) {
      profileImageInputRef.current.value = ''
    }
  }

  const selectedCountryCodeOption =
    COUNTRY_CODE_OPTIONS.find((option) => option.id === profileForm.phoneCountryOptionId) ||
    COUNTRY_CODE_OPTIONS.find((option) => option.value === profileForm.phoneCountryCode) ||
    COUNTRY_CODE_OPTIONS[0]

  const phoneNumberHelperText =
    'Exclude the selected country code. Example: 912 345 6789.'

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

  const clearAccountFormErrors = () => {
    setFirstNameError('')
    setLastNameError('')
    setEmailError('')
    setPhoneNumberError('')
  }

  const validateAccountForm = () => {
    const trimmedFirstName = profileForm.firstName.trim()
    const trimmedLastName = profileForm.lastName.trim()
    const trimmedEmail = profileForm.email.trim()
    const trimmedPhoneNumber = profileForm.phoneNumber.trim()

    const nextFirstNameError = getNameValidationError(trimmedFirstName, 'First name')
    const nextLastNameError = getNameValidationError(trimmedLastName, 'Last name')
    const nextEmailError = getEmailValidationError(trimmedEmail)
    const nextPhoneNumberError = getPhoneNumberValidationError(trimmedPhoneNumber)

    let hasError = false

    if (nextFirstNameError) {
      setFirstNameError(nextFirstNameError)
      hasError = true
    }

    if (nextLastNameError) {
      setLastNameError(nextLastNameError)
      hasError = true
    }

    if (nextEmailError) {
      setEmailError(nextEmailError)
      hasError = true
    }

    if (nextPhoneNumberError) {
      setPhoneNumberError(nextPhoneNumberError)
      hasError = true
    }

    return !hasError
  }

  const showAccountSaveResultAlert = async ({ type, title, message }) => {
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

  const handleSaveProfile = async () => {
    clearAccountFormErrors()

    if (!validateAccountForm()) {
      return
    }

    const result = await Swal.fire({
      title: 'Save Changes?',
      text: 'Are you sure you want to save your account details?',
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

    try {
      setProfileForm((prev) => ({
        ...prev,
        firstName: prev.firstName.trim(),
        lastName: prev.lastName.trim(),
        email: prev.email.trim(),
        phoneNumber: prev.phoneNumber.trim()
      }))

      setIsSavingProfile(true)

      await new Promise((resolve) => setTimeout(resolve, 1400))

      setIsSavingProfile(false)

      await showAccountSaveResultAlert({
        type: 'success',
        title: 'Profile Saved',
        message: 'Your account details have been saved successfully.'
      })
    } catch (error) {
      setIsSavingProfile(false)

      await showAccountSaveResultAlert({
        type: 'error',
        title: 'Save Failed',
        message: 'Something went wrong while saving your account details. Please try again.'
      })
    }
  }

  const accountInitials = [profileForm.firstName, profileForm.lastName]
    .filter(Boolean)
    .map((value) => String(value).trim().charAt(0).toUpperCase())
    .join('')
    .slice(0, 2) || 'A'

  const hasFirstNameFieldError = Boolean(firstNameError)
  const hasLastNameFieldError = Boolean(lastNameError)
  const hasEmailFieldError = Boolean(emailError)
  const hasPhoneNumberFieldError = Boolean(phoneNumberError)

  const showPhotoProcessingOverlay = Boolean(photoProcessingMode)
  const showPhotoProcessingTitle =
    photoProcessingMode === 'photo-loading' ||
    photoProcessingMode === 'photo-applying' ||
    photoProcessingMode === 'photo-removing'

  const photoProcessingLabel =
    photoProcessingMode === 'photo-removing'
      ? 'Removing Photo'
      : photoProcessingMode === 'photo-applying'
        ? 'Updating Photo'
        : 'Loading Photo'

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
        <div className="dashboard-content-body dashboard-content-body-frame">
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
                      accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                      className="account-profile-file-input"
                      onChange={handleProfileImageChange}
                    />

                    <button
                      type="button"
                      className="account-button account-button-secondary account-profile-remove"
                      onClick={handleRemoveProfileImage}
                      disabled={!profileImagePreview || Boolean(photoProcessingMode)}
                    >
                      Remove
                    </button>

                    <button
                      type="button"
                      className="account-button account-button-primary account-profile-upload"
                      onClick={handleOpenPhotoPicker}
                      disabled={Boolean(photoProcessingMode)}
                    >
                      <span className="account-button-icon" aria-hidden="true">
                        <CameraIcon />
                      </span>
                      <span>Change Photo</span>
                    </button>
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
                    <div className={`account-field account-floating-field ${hasFirstNameFieldError ? 'account-field-error' : ''}`}>
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
                          aria-invalid={hasFirstNameFieldError}
                        />
                        <label htmlFor="account-first-name" className="account-floating-label">
                          First Name
                        </label>
                      </div>
                    </div>

                    {firstNameError && (
                      <div className="account-error-row account-error-row-animated">
                        <span className="account-error-icon" aria-hidden="true">
                          <ErrorIcon />
                        </span>
                        <span>{firstNameError}</span>
                      </div>
                    )}
                  </div>

                  <div className="account-field-group">
                    <div className={`account-field account-floating-field ${hasLastNameFieldError ? 'account-field-error' : ''}`}>
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
                          aria-invalid={hasLastNameFieldError}
                        />
                        <label htmlFor="account-last-name" className="account-floating-label">
                          Last Name
                        </label>
                      </div>
                    </div>

                    {lastNameError && (
                      <div className="account-error-row account-error-row-animated">
                        <span className="account-error-icon" aria-hidden="true">
                          <ErrorIcon />
                        </span>
                        <span>{lastNameError}</span>
                      </div>
                    )}
                  </div>

                  <div className="account-field-group account-field-group-full">
                    <div className={`account-field account-floating-field ${hasEmailFieldError ? 'account-field-error' : ''}`}>
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
                          aria-invalid={hasEmailFieldError}
                        />
                        <label htmlFor="account-email" className="account-floating-label">
                          Email
                        </label>
                      </div>
                    </div>

                    {emailError && (
                      <div className="account-error-row account-error-row-animated">
                        <span className="account-error-icon" aria-hidden="true">
                          <ErrorIcon />
                        </span>
                        <span>{emailError}</span>
                      </div>
                    )}
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
                        <span className="account-field-icon" aria-hidden="true">
                          <GlobeIcon />
                        </span>

                        <div className="account-floating-control">
                          <span className="account-dropdown-value account-dropdown-value-desktop">
                            {renderCountryFlag(selectedCountryCodeOption.iso, 'account-dropdown-flag')}
                            <span className="account-dropdown-value-text">
                              {selectedCountryCodeOption.label}
                            </span>
                          </span>
                          <span className="account-dropdown-value account-dropdown-value-mobile">
                            {renderCountryFlag(selectedCountryCodeOption.iso, 'account-dropdown-flag')}
                            <span className="account-dropdown-value-text">
                              {selectedCountryCodeOption.shortLabel}
                            </span>
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
                            <span className="account-dropdown-option-content">
                              {renderCountryFlag(option.iso, 'account-dropdown-option-flag')}
                              <span className="account-dropdown-option-label-desktop">{option.label}</span>
                              <span className="account-dropdown-option-label-mobile">{option.shortLabel}</span>
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="account-phone-group">
                    <div className={`account-field account-floating-field ${hasPhoneNumberFieldError ? 'account-field-error' : ''}`}>
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
                          inputMode="numeric"
                          aria-describedby="account-phone-helper"
                          aria-invalid={hasPhoneNumberFieldError}
                        />
                        <label htmlFor="account-phone-number" className="account-floating-label">
                          Phone Number
                        </label>
                      </div>
                    </div>

                    <p id="account-phone-helper" className="account-phone-helper">
                      {phoneNumberHelperText}
                    </p>

                    {phoneNumberError && (
                      <div className="account-error-row account-error-row-animated">
                        <span className="account-error-icon" aria-hidden="true">
                          <ErrorIcon />
                        </span>
                        <span>{phoneNumberError}</span>
                      </div>
                    )}
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
                    onClick={handleSaveProfile}
                    disabled={isSavingProfile}
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>
      </section>
      {isPhotoCropModalOpen && (
        <div
          className="account-photo-modal-overlay"
          onClick={handleClosePhotoCropModal}
        >
          <div
            className="account-photo-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="account-photo-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="account-photo-modal-close"
              onClick={handleClosePhotoCropModal}
              aria-label="Close photo editor"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18" />
                <path d="M6 6l12 12" />
              </svg>
            </button>

            <div className="account-photo-modal-header">
              <h2 id="account-photo-modal-title" className="account-photo-modal-title">
                Change Profile Picture
              </h2>
              <p className="account-photo-modal-text">
                Drag and adjust your photo inside the circle, then confirm to apply it.
              </p>
            </div>

            <div className="account-photo-cropper-shell">
              <div className="account-photo-cropper-surface">
                <Cropper
                  image={photoCropSource}
                  crop={photoCropValue}
                  zoom={photoZoomValue}
                  minZoom={0.75}
                  maxZoom={3}
                  aspect={1}
                  cropShape="round"
                  showGrid={false}
                  objectFit="cover"
                  onCropChange={setPhotoCropValue}
                  onZoomChange={setPhotoZoomValue}
                  onCropComplete={handlePhotoCropComplete}
                />
              </div>
            </div>

            <div className="account-photo-slider-group">
              <div className="account-photo-slider-label-row">
                <label htmlFor="account-photo-zoom" className="account-photo-slider-label">
                  Zoom
                </label>
                <span className="account-photo-slider-value">
                  {photoZoomValue.toFixed(2)}x
                </span>
              </div>

              <input
                id="account-photo-zoom"
                type="range"
                min="0.75"
                max="3"
                step="0.01"
                value={photoZoomValue}
                onChange={(event) => setPhotoZoomValue(Number(event.target.value))}
                className="account-photo-slider"
              />
            </div>

            <div className="account-photo-modal-actions">
              <button
                type="button"
                className="account-button account-button-secondary"
                onClick={handleClosePhotoCropModal}
              >
                Cancel
              </button>

              <button
                type="button"
                className="account-button account-button-primary"
                onClick={handleApplyPhotoCrop}
              >
                Apply Photo
              </button>
            </div>
          </div>
        </div>
      )}
      {showPhotoProcessingOverlay && (
        <div className="account-save-overlay" role="status" aria-live="polite" aria-busy="true">
          <div className={`account-save-card ${showPhotoProcessingTitle ? '' : 'account-save-card-compact'}`}>
            <img src={logo} alt="Avinya Logo" className="account-save-logo" />
            {showPhotoProcessingTitle && (
              <p className="account-save-title">{photoProcessingLabel}</p>
            )}
            <div className="account-save-loader" aria-hidden="true">
              <span className="account-save-loader-bar"></span>
            </div>
          </div>
        </div>
      )}
      {isSavingProfile && (
    <div className="account-save-overlay" role="status" aria-live="polite" aria-busy="true">
      <div className="account-save-card">
        <img src={logo} alt="Avinya Logo" className="account-save-logo" />
        <p className="account-save-title">Saving Changes</p>
        <div className="account-save-loader" aria-hidden="true">
          <span className="account-save-loader-bar"></span>
        </div>
      </div>
    </div>
  )}

  </main>
  )
}

export default Account