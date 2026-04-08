import { useEffect, useState } from 'react'
import { flushSync } from 'react-dom'
import Swal from 'sweetalert2'
import 'sweetalert2/dist/sweetalert2.min.css'
import { countries } from 'country-list-json'
import * as FlagIcons from 'country-flag-icons/react/3x2'
import logo from '../Pictures/Avinya.png'
import '../Styles/Users.css'
import {
  EditIcon,
  TrashIcon,
  LockIcon,
  EyeOpenIcon,
  EyeClosedIcon,
  ErrorIcon,
  UserIcon,
  GlobeIcon,
  PhoneIcon,
  SaveIcon,
  SearchIcon,
  FilterIcon,
  SortIcon,
  DownloadIcon,
  FirstPageIcon,
  PreviousPageIcon,
  NextPageIcon,
  LastPageIcon
} from '../Components/Icons.jsx'
import { getCurrentUserProfile, isAdministratorRole } from '../Utils/getCurrentUserProfile'
import { performReliableLogout } from '../Utils/performReliableLogout'
import { API_URL, buildApiAssetUrl } from '../Config/API'
import { getStoredAuthToken } from '../Utils/authStorage'

const NAME_REGEX = /^[A-Za-zÀ-ÖØ-öø-ÿ]+(?:[ '-][A-Za-zÀ-ÖØ-öø-ÿ]+)*$/
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_COUNTRY_CODE_REGEX = /^\+[1-9]\d{0,3}$/

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

const getPhoneCountryCodeValidationError = (value) => {
  const normalizedValue = String(value || '').trim()

  if (!normalizedValue) {
    return ''
  }

  if (!PHONE_COUNTRY_CODE_REGEX.test(normalizedValue)) {
    return 'Please select a valid country code.'
  }

  return ''
}

const getPhoneNumberValidationError = (value) => {
  const normalizedValue = String(value || '')

  if (!normalizedValue) {
    return ''
  }

  if (normalizedValue !== normalizedValue.trim()) {
    return 'Phone number must not start or end with spaces.'
  }

  if (/\s/.test(normalizedValue)) {
    return 'Phone number must not contain spaces.'
  }

  if (normalizedValue.includes('+')) {
    return 'Enter your phone number without the country code.'
  }

  if (!/^\d+$/.test(normalizedValue)) {
    return 'Phone number must contain numbers only.'
  }

  if (normalizedValue.startsWith('0')) {
    return 'Phone number must not start with 0.'
  }

  if (normalizedValue.length < 7) {
    return 'Phone number must be at least 7 digits.'
  }

  if (normalizedValue.length > 15) {
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

const getCountryOptionIdFromDialCode = (dialCode = '') =>
  COUNTRY_CODE_OPTIONS.find(
    (option) => option.value === String(dialCode || '').trim()
  )?.id || 'PH-+63'

const getCountryCodeOption = (dialCode = '') =>
  COUNTRY_CODE_OPTIONS.find(
    (option) => option.value === String(dialCode || '').trim()
  ) || {
    id: 'PH-+63',
    value: String(dialCode || '+63').trim() || '+63',
    iso: 'PH',
    label: `PH Philippines (${String(dialCode || '+63').trim() || '+63'})`,
    shortLabel: `PH (${String(dialCode || '+63').trim() || '+63'})`
  }

const getInitialEditUserForm = (listedUser = {}) => {
  const resolvedPhoneCountryCode = String(listedUser.phoneCountryCode || '+63').trim()

  return {
    firstName: String(listedUser.firstName || '').trim(),
    lastName: String(listedUser.lastName || '').trim(),
    email: String(listedUser.email || '').trim(),
    phoneCountryCode: resolvedPhoneCountryCode,
    phoneCountryOptionId: getCountryOptionIdFromDialCode(resolvedPhoneCountryCode),
    phoneNumber: String(listedUser.phoneNumber || '').trim()
  }
}

const normalizeEditUserFormValues = (form = {}) => ({
  firstName: String(form.firstName || '').trim(),
  lastName: String(form.lastName || '').trim(),
  email: String(form.email || '').trim(),
  phoneCountryCode: String(form.phoneCountryCode || '+63').trim(),
  phoneCountryOptionId: String(form.phoneCountryOptionId || 'PH-+63').trim(),
  phoneNumber: String(form.phoneNumber || '').trim()
})

const appendImageCacheKey = (assetUrl = '', cacheKey = '') => {
  const resolvedAssetUrl = String(assetUrl || '').trim()
  const resolvedCacheKey = String(cacheKey || '').trim()

  if (!resolvedAssetUrl || !resolvedCacheKey) {
    return resolvedAssetUrl
  }

  return `${resolvedAssetUrl}${resolvedAssetUrl.includes('?') ? '&' : '?'}v=${encodeURIComponent(resolvedCacheKey)}`
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

const ACCOUNT_MODAL_TRANSITION_MS = 280
const USERS_PER_PAGE = 15
const USERS_VISIBLE_PAGE_BUTTONS = 5

const USERS_STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'verified', label: 'Verified' },
  { value: 'not_verified', label: 'Not Verified' }
]

const USERS_PHOTO_FILTER_OPTIONS = [
  { value: 'all', label: 'All Photos' },
  { value: 'with_photo', label: 'With Photo' },
  { value: 'without_photo', label: 'Without Photo' }
]

const USERS_SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'last_name_asc', label: 'Last Name A–Z' },
  { value: 'last_name_desc', label: 'Last Name Z–A' },
  { value: 'first_name_asc', label: 'First Name A–Z' },
  { value: 'first_name_desc', label: 'First Name Z–A' },
  { value: 'email_asc', label: 'Email A–Z' },
  { value: 'email_desc', label: 'Email Z–A' }
]

const USERS_COUNTRY_FILTER_OPTIONS = [
  {
    value: 'all',
    label: 'All Country Codes',
    shortLabel: 'All Country Codes',
    iso: ''
  },
  ...Array.from(
    COUNTRY_CODE_OPTIONS.reduce((map, option) => {
      if (!map.has(option.value)) {
        map.set(option.value, {
          value: option.value,
          label: option.shortLabel,
          shortLabel: option.shortLabel,
          iso: option.iso
        })
      }

      return map
    }, new Map()).values()
  )
]

const getUsersFilterOptionLabel = (options, value, fallback) =>
  options.find((option) => option.value === value)?.label || fallback

const getUsersListQueryParams = ({
  page,
  limit,
  search,
  status,
  countryCode,
  photo,
  sortBy
}) => {
  const params = new URLSearchParams()

  if (page) params.set('page', String(page))
  if (limit) params.set('limit', String(limit))
  if (search) params.set('search', String(search).trim())
  if (status && status !== 'all') params.set('status', status)
  if (countryCode && countryCode !== 'all') params.set('countryCode', countryCode)
  if (photo && photo !== 'all') params.set('photo', photo)
  if (sortBy) params.set('sortBy', sortBy)

  return params
}

const getReadableUsersPdfDate = (date = new Date()) =>
  new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  }).format(date)

const getDefaultUsersPdfFileName = (date = new Date()) =>
  `Avinya Users - ${getReadableUsersPdfDate(date)}.pdf`

const getUsersPdfFileNameFromResponse = (response) => {
  const contentDisposition = response.headers.get('content-disposition') || ''
  const match = contentDisposition.match(/filename="?([^"]+)"?/i)

  return match?.[1] || getDefaultUsersPdfFileName()
}

const getUsersPaginationItems = (currentPage, totalPages) => {
  if (totalPages <= 1) {
    return [1]
  }

  const pages = new Set([1, totalPages])

  if (totalPages <= USERS_VISIBLE_PAGE_BUTTONS + 2) {
    for (let page = 1; page <= totalPages; page += 1) {
      pages.add(page)
    }
  } else if (currentPage <= 3) {
    for (
      let page = 1;
      page <= Math.min(totalPages, USERS_VISIBLE_PAGE_BUTTONS);
      page += 1
    ) {
      pages.add(page)
    }
  } else if (currentPage >= totalPages - 2) {
    for (
      let page = Math.max(1, totalPages - USERS_VISIBLE_PAGE_BUTTONS + 1);
      page <= totalPages;
      page += 1
    ) {
      pages.add(page)
    }
  } else {
    for (let page = currentPage - 1; page <= currentPage + 1; page += 1) {
      pages.add(page)
    }
  }

  const sortedPages = [...pages].sort((a, b) => a - b)
  const items = []

  sortedPages.forEach((page, index) => {
    const previousPage = sortedPages[index - 1]

    if (index > 0 && page - previousPage > 1) {
      items.push(`ellipsis-${previousPage}-${page}`)
    }

    items.push(page)
  })

  return items
}

const getDeletePasswordValidationError = (value) => {
  if (!value) {
    return 'Please enter your password.'
  }

  if (value !== value.trim()) {
    return 'Password must not start or end with spaces.'
  }

  return ''
}

const getDeleteConfirmPasswordValidationError = (password, confirmPassword) => {
  if (!confirmPassword) {
    return 'Please confirm your password.'
  }

  if (password !== confirmPassword) {
    return 'Passwords do not match.'
  }

  return ''
}

const UsersFilterDropdown = ({
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
    options.find((option) => option.value === value) || options[0]

  const selectedOptionText = selectedOption.shortLabel || selectedOption.label

  return (
    <div className={`users-filter-dropdown ${className} ${isOpen ? 'open' : ''}`}>
      <button
        type="button"
        id={id}
        className={`users-filter-field users-filter-dropdown-trigger ${isOpen ? 'users-filter-dropdown-trigger-open' : ''}`}
        onClick={onToggle}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        disabled={disabled}
      >
        <span className="users-filter-field-icon" aria-hidden="true">
          {icon}
        </span>

        <div className="users-filter-floating-control">
          <span className={`users-filter-dropdown-value ${selectedOption.iso ? 'users-filter-dropdown-value-with-flag' : ''}`}>
            {selectedOption.iso ? renderCountryFlag(selectedOption.iso, 'users-filter-dropdown-flag') : null}
            <span className="users-filter-dropdown-value-text">
              {selectedOptionText}
            </span>
          </span>

          <span className="users-filter-label users-filter-label-static">
            {label}
          </span>
        </div>

        <span className="users-filter-field-arrow" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d={isOpen ? 'M18 15l-6-6-6 6' : 'M6 9l6 6 6-6'} />
          </svg>
        </span>
      </button>

      <div
        className={`users-filter-dropdown-menu ${isOpen ? 'open' : ''}`}
        role="listbox"
        aria-labelledby={id}
      >
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className={`users-filter-dropdown-option ${value === option.value ? 'active' : ''}`}
            onClick={() => onSelect(option.value)}
          >
            <span className={`users-filter-dropdown-option-label ${option.iso ? 'users-filter-dropdown-option-label-with-flag' : ''}`}>
              {option.iso ? renderCountryFlag(option.iso, 'users-filter-dropdown-option-flag') : null}
              <span className="users-filter-dropdown-option-text">
                {option.shortLabel || option.label}
              </span>
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

const Users = ({ onLogout, onNavigate, isDarkMode, onThemeToggle }) => {
  const [isEntitiesOpen, setIsEntitiesOpen] = useState(false)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false)
  const [users, setUsers] = useState([])
  const [isUsersLoading, setIsUsersLoading] = useState(true)
  const [usersLoadError, setUsersLoadError] = useState('')
  const [usersSearchInput, setUsersSearchInput] = useState('')
  const [appliedUsersSearchQuery, setAppliedUsersSearchQuery] = useState('')
  const [usersStatusFilter, setUsersStatusFilter] = useState('all')
  const [usersCountryCodeFilter, setUsersCountryCodeFilter] = useState('all')
  const [usersPhotoFilter, setUsersPhotoFilter] = useState('all')
  const [usersSortBy, setUsersSortBy] = useState('newest')
  const [openUsersFilterDropdown, setOpenUsersFilterDropdown] = useState('')
  const [currentUsersPage, setCurrentUsersPage] = useState(1)
  const [usersTotalCount, setUsersTotalCount] = useState(0)
  const [usersTotalPages, setUsersTotalPages] = useState(1)
  const [usersRefreshKey, setUsersRefreshKey] = useState(0)
  const [usersTableLoadingTitle, setUsersTableLoadingTitle] = useState('Loading Users')
  const [isUsersTableTransitioning, setIsUsersTableTransitioning] = useState(true)
  const [usersTableAnimationKey, setUsersTableAnimationKey] = useState(0)
  const [usersLoadReason, setUsersLoadReason] = useState('initial')
  const [hasUsersLoadedOnce, setHasUsersLoadedOnce] = useState(false)
  const [isPreparingUsersPdfPreview, setIsPreparingUsersPdfPreview] = useState(false)
  const [isUsersPdfPreviewModalOpen, setIsUsersPdfPreviewModalOpen] = useState(false)
  const [isUsersPdfPreviewModalClosing, setIsUsersPdfPreviewModalClosing] = useState(false)
  const [usersPdfPreviewUrl, setUsersPdfPreviewUrl] = useState('')
  const [usersPdfFileName, setUsersPdfFileName] = useState('')
  const [isDownloadingUsersPdf, setIsDownloadingUsersPdf] = useState(false)

  const [pendingEditUser, setPendingEditUser] = useState(null)
  const [isEditUserModalOpen, setIsEditUserModalOpen] = useState(false)
  const [isEditUserModalClosing, setIsEditUserModalClosing] = useState(false)
  const [isPreparingEditUserModal, setIsPreparingEditUserModal] = useState(false)
  const [editUserForm, setEditUserForm] = useState(() => getInitialEditUserForm())
  const [savedEditUserFormSnapshot, setSavedEditUserFormSnapshot] = useState(() =>
    normalizeEditUserFormValues(getInitialEditUserForm())
  )
  const [editFirstNameError, setEditFirstNameError] = useState('')
  const [editLastNameError, setEditLastNameError] = useState('')
  const [editEmailError, setEditEmailError] = useState('')
  const [editPhoneCountryCodeError, setEditPhoneCountryCodeError] = useState('')
  const [editPhoneNumberError, setEditPhoneNumberError] = useState('')
  const [isEditCountryCodeOpen, setIsEditCountryCodeOpen] = useState(false)
  const [isSavingEditedUser, setIsSavingEditedUser] = useState(false)

  const [pendingDeleteUser, setPendingDeleteUser] = useState(null)
  const [isDeleteUserModalOpen, setIsDeleteUserModalOpen] = useState(false)
  const [isDeleteUserModalClosing, setIsDeleteUserModalClosing] = useState(false)
  const [isPreparingDeleteUserModal, setIsPreparingDeleteUserModal] = useState(false)
  const [deleteUserForm, setDeleteUserForm] = useState({
    password: '',
    confirmPassword: ''
  })
  const [deletePasswordError, setDeletePasswordError] = useState('')
  const [deleteConfirmPasswordError, setDeleteConfirmPasswordError] = useState('')
  const [deleteAuthError, setDeleteAuthError] = useState('')
  const [isDeletePasswordVisible, setIsDeletePasswordVisible] = useState(false)
  const [isDeleteConfirmPasswordVisible, setIsDeleteConfirmPasswordVisible] = useState(false)
  const [isDeletingUser, setIsDeletingUser] = useState(false)
  const [isDeleteUserRedirecting, setIsDeleteUserRedirecting] = useState(false)
  const [removingUserId, setRemovingUserId] = useState(null)

  const user = getCurrentUserProfile()
  const isAdministrator = isAdministratorRole(user.roleLabel)

  const sidebarProfileImagePreview = buildApiAssetUrl(user.profilePictureUrl)

  const sidebarUserInitials = [user.firstName, user.lastName]
    .filter(Boolean)
    .map((value) => String(value).trim().charAt(0).toUpperCase())
    .join('')
    .slice(0, 2) || 'A'

  const closeDropdowns = () => {
    setIsEntitiesOpen(false)
    setIsProfileMenuOpen(false)
    setIsEditCountryCodeOpen(false)
    setOpenUsersFilterDropdown('')
  }

  useEffect(() => {
    document.title = 'Avinya | Users'

    const handleOutsideClick = (event) => {
      if (!(event.target instanceof Element)) return

      if (!event.target.closest('.dashboard-sidebar-user-group')) {
        setIsProfileMenuOpen(false)
      }

      if (!event.target.closest('.account-country-dropdown')) {
        setIsEditCountryCodeOpen(false)
      }

      if (!event.target.closest('.users-filter-dropdown')) {
        setOpenUsersFilterDropdown('')
      }
    }

    document.addEventListener('mousedown', handleOutsideClick)

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
    }
  }, [])

  useEffect(() => {
    return () => {
      if (usersPdfPreviewUrl) {
        URL.revokeObjectURL(usersPdfPreviewUrl)
      }
    }
  }, [usersPdfPreviewUrl])

  useEffect(() => {
    if (!isAdministrator) {
      onNavigate('dashboard')
    }
  }, [isAdministrator, onNavigate])

  useEffect(() => {
    if (!isAdministrator) {
      return
    }

    let isMounted = true
    let usersTableTransitionTimeoutId
    const controller = new AbortController()

    const loadUsers = async () => {
      try {
        setIsUsersLoading(true)
        setUsersLoadError('')
        setIsUsersTableTransitioning(true)

        const authToken = getStoredAuthToken()

        if (!authToken) {
          throw new Error('Your session has expired. Please log in again.')
        }

        const usersQueryParams = getUsersListQueryParams({
          page: currentUsersPage,
          limit: USERS_PER_PAGE,
          search: appliedUsersSearchQuery,
          status: usersStatusFilter,
          countryCode: usersCountryCodeFilter,
          photo: usersPhotoFilter,
          sortBy: usersSortBy
        })

        const response = await fetch(`${API_URL}/users?${usersQueryParams.toString()}`, {
          method: 'GET',
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${authToken}`
          },
          signal: controller.signal
        })

        const data = await response.json().catch(() => ({}))

        if (!response.ok) {
          throw new Error(data.message || 'Unable to load users right now.')
        }

        if (!isMounted) return

        const pagination = data.pagination || {}
        const nextPage = Number(pagination.page || 1)
        const nextTotalCount = Number(pagination.totalCount || 0)
        const nextTotalPages = Number(pagination.totalPages || 1)

        setUsers(Array.isArray(data.users) ? data.users : [])
        setUsersTotalCount(nextTotalCount)
        setUsersTotalPages(nextTotalPages > 0 ? nextTotalPages : 1)

        if (nextPage !== currentUsersPage) {
          setCurrentUsersPage(nextPage)
        }
      } catch (error) {
        if (error.name === 'AbortError') {
          return
        }

        if (!isMounted) return

        setUsers([])
        setUsersTotalCount(0)
        setUsersTotalPages(1)
        setUsersLoadError(
          error.message || 'Unable to load users right now.'
        )
      } finally {
        if (isMounted && !controller.signal.aborted) {
          usersTableTransitionTimeoutId = window.setTimeout(() => {
            if (!isMounted) return

            setIsUsersLoading(false)
            setIsUsersTableTransitioning(false)
            setUsersTableAnimationKey((prev) => prev + 1)
            setUsersLoadReason('idle')
            setHasUsersLoadedOnce(true)
          }, 420)
        }
      }
    }

    loadUsers()

    return () => {
      isMounted = false
      controller.abort()
      window.clearTimeout(usersTableTransitionTimeoutId)
    }
  }, [
    isAdministrator,
    currentUsersPage,
    appliedUsersSearchQuery,
    usersStatusFilter,
    usersCountryCodeFilter,
    usersPhotoFilter,
    usersSortBy,
    usersRefreshKey
  ])

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

  const showUsersDeleteResultAlert = async ({ type, title, message }) => {
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

  const phoneNumberHelperText =
    'Enter digits only, without the country code. Example: 9123456789. No leading 0 or spaces.'

  const handleUsersFilterDropdownToggle = (dropdownName) => {
    setIsProfileMenuOpen(false)
    setIsEditCountryCodeOpen(false)

    setOpenUsersFilterDropdown((prev) =>
      prev === dropdownName ? '' : dropdownName
    )
  }

  const handleUsersSearchInputChange = (event) => {
    setUsersSearchInput(event.target.value)
  }

  const handleUsersSearchSubmit = (event) => {
    event.preventDefault()

    const nextUsersSearchQuery = usersSearchInput.trim()

    setUsersTableLoadingTitle('Searching Users')
    setUsersLoadReason('search')

    if (nextUsersSearchQuery === appliedUsersSearchQuery) {
      if (currentUsersPage !== 1) {
        setCurrentUsersPage(1)
        return
      }

      setUsersRefreshKey((prev) => prev + 1)
      return
    }

    setCurrentUsersPage(1)
    setAppliedUsersSearchQuery(nextUsersSearchQuery)
  }

  const handleUsersPageChange = (nextPage) => {
    if (isUsersLoading) {
      return
    }

    if (
      nextPage < 1 ||
      nextPage > usersTotalPages ||
      nextPage === currentUsersPage
    ) {
      return
    }

    setUsersTableLoadingTitle('Loading Users')
    setUsersLoadReason('pagination')
    setCurrentUsersPage(nextPage)
  }

  const handleUsersStatusFilterChange = (valueOrEvent) => {
    const nextValue =
      typeof valueOrEvent === 'string'
        ? valueOrEvent
        : valueOrEvent.target.value

    setOpenUsersFilterDropdown('')

    if (nextValue === usersStatusFilter) return

    setUsersTableLoadingTitle('Filtering Users')
    setUsersLoadReason('filter')
    setCurrentUsersPage(1)
    setUsersStatusFilter(nextValue)
  }

  const handleUsersCountryCodeFilterChange = (valueOrEvent) => {
    const nextValue =
      typeof valueOrEvent === 'string'
        ? valueOrEvent
        : valueOrEvent.target.value

    setOpenUsersFilterDropdown('')

    if (nextValue === usersCountryCodeFilter) return

    setUsersTableLoadingTitle('Filtering Users')
    setUsersLoadReason('filter')
    setCurrentUsersPage(1)
    setUsersCountryCodeFilter(nextValue)
  }

  const handleUsersPhotoFilterChange = (valueOrEvent) => {
    const nextValue =
      typeof valueOrEvent === 'string'
        ? valueOrEvent
        : valueOrEvent.target.value

    setOpenUsersFilterDropdown('')

    if (nextValue === usersPhotoFilter) return

    setUsersTableLoadingTitle('Filtering Users')
    setUsersLoadReason('filter')
    setCurrentUsersPage(1)
    setUsersPhotoFilter(nextValue)
  }

  const handleUsersSortByChange = (valueOrEvent) => {
    const nextValue =
      typeof valueOrEvent === 'string'
        ? valueOrEvent
        : valueOrEvent.target.value

    setOpenUsersFilterDropdown('')

    if (nextValue === usersSortBy) return

    setUsersTableLoadingTitle('Sorting Users')
    setUsersLoadReason('filter')
    setCurrentUsersPage(1)
    setUsersSortBy(nextValue)
  }

  const handleUsersResetFilters = () => {
    const areFiltersAlreadyDefault =
      usersStatusFilter === 'all' &&
      usersCountryCodeFilter === 'all' &&
      usersPhotoFilter === 'all' &&
      usersSortBy === 'newest'

    setOpenUsersFilterDropdown('')

    if (areFiltersAlreadyDefault) return

    setUsersTableLoadingTitle('Filtering Users')
    setUsersLoadReason('filter')
    setCurrentUsersPage(1)
    setUsersStatusFilter('all')
    setUsersCountryCodeFilter('all')
    setUsersPhotoFilter('all')
    setUsersSortBy('newest')
  }

  const resetUsersPdfPreviewState = () => {
    if (usersPdfPreviewUrl) {
      URL.revokeObjectURL(usersPdfPreviewUrl)
    }

    setIsUsersPdfPreviewModalOpen(false)
    setIsUsersPdfPreviewModalClosing(false)
    setUsersPdfPreviewUrl('')
    setUsersPdfFileName('')
    setIsPreparingUsersPdfPreview(false)
    setIsDownloadingUsersPdf(false)
  }

  const handleOpenUsersPdfPreview = async () => {
    const authToken = getStoredAuthToken()

    if (!authToken) {
      closeDropdowns()
      onLogout()
      return
    }

    try {
      setIsPreparingUsersPdfPreview(true)

      const usersExportQueryParams = getUsersListQueryParams({
        search: appliedUsersSearchQuery,
        status: usersStatusFilter,
        countryCode: usersCountryCodeFilter,
        photo: usersPhotoFilter,
        sortBy: usersSortBy
      })

      const response = await fetch(`${API_URL}/users/export/pdf?${usersExportQueryParams.toString()}`, {
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

      if (usersPdfPreviewUrl) {
        URL.revokeObjectURL(usersPdfPreviewUrl)
      }

      setUsersPdfPreviewUrl(nextPreviewUrl)
      setUsersPdfFileName(getUsersPdfFileNameFromResponse(response))
      setIsUsersPdfPreviewModalOpen(true)
    } catch (error) {
      await showUsersDeleteResultAlert({
        type: 'error',
        title: 'PDF Preview Unavailable',
        message: error.message || 'Unable to generate the PDF file right now.'
      })
    } finally {
      setIsPreparingUsersPdfPreview(false)
    }
  }

  const handleCloseUsersPdfPreviewModal = async () => {
    if (isUsersPdfPreviewModalClosing || isDownloadingUsersPdf) {
      return
    }

    setIsUsersPdfPreviewModalClosing(true)

    await new Promise((resolve) => setTimeout(resolve, ACCOUNT_MODAL_TRANSITION_MS))

    resetUsersPdfPreviewState()
  }

  const handleDownloadUsersPdf = async () => {
    if (!usersPdfPreviewUrl) return

    try {
      setIsDownloadingUsersPdf(true)

      await new Promise((resolve) => setTimeout(resolve, 620))

      const downloadLink = document.createElement('a')
      downloadLink.href = usersPdfPreviewUrl
      downloadLink.download = usersPdfFileName || getDefaultUsersPdfFileName()
      downloadLink.rel = 'noopener'

      document.body.appendChild(downloadLink)
      downloadLink.click()
      downloadLink.remove()

      setIsDownloadingUsersPdf(false)
      await handleCloseUsersPdfPreviewModal()
    } catch (error) {
      setIsDownloadingUsersPdf(false)

      await showUsersDeleteResultAlert({
        type: 'error',
        title: 'Download Failed',
        message: error.message || 'Unable to download the PDF file right now.'
      })
    }
  }

  const resetEditUserState = () => {
    setPendingEditUser(null)
    setIsEditUserModalOpen(false)
    setIsEditUserModalClosing(false)
    setIsPreparingEditUserModal(false)
    setEditUserForm(getInitialEditUserForm())
    setSavedEditUserFormSnapshot(normalizeEditUserFormValues(getInitialEditUserForm()))
    setEditFirstNameError('')
    setEditLastNameError('')
    setEditEmailError('')
    setEditPhoneCountryCodeError('')
    setEditPhoneNumberError('')
    setIsEditCountryCodeOpen(false)
    setIsSavingEditedUser(false)
  }

  const clearEditUserFormErrors = () => {
    setEditFirstNameError('')
    setEditLastNameError('')
    setEditEmailError('')
    setEditPhoneCountryCodeError('')
    setEditPhoneNumberError('')
  }

  const handleEditUserInputChange = (field) => (event) => {
    const nextValue = event.target.value

    setEditUserForm((prev) => ({
      ...prev,
      [field]: nextValue
    }))

    if (field === 'firstName' && editFirstNameError) {
      setEditFirstNameError('')
    }

    if (field === 'lastName' && editLastNameError) {
      setEditLastNameError('')
    }

    if (field === 'email' && editEmailError) {
      setEditEmailError('')
    }

    if (field === 'phoneNumber' && editPhoneNumberError) {
      setEditPhoneNumberError('')
    }
  }

  const handleEditCountryCodeToggle = () => {
    setIsEditCountryCodeOpen((prev) => !prev)
  }

  const handleEditCountryCodeSelect = (option) => {
    setEditUserForm((prev) => ({
      ...prev,
      phoneCountryCode: option.value,
      phoneCountryOptionId: option.id
    }))
    setEditPhoneCountryCodeError('')
    setIsEditCountryCodeOpen(false)
  }

  const validateEditUserForm = () => {
    const trimmedFirstName = editUserForm.firstName.trim()
    const trimmedLastName = editUserForm.lastName.trim()
    const trimmedEmail = editUserForm.email.trim()
    const trimmedPhoneCountryCode = editUserForm.phoneCountryCode.trim()
    const trimmedPhoneNumber = editUserForm.phoneNumber.trim()

    const nextFirstNameError = getNameValidationError(trimmedFirstName, 'First name')
    const nextLastNameError = getNameValidationError(trimmedLastName, 'Last name')
    const nextEmailError = getEmailValidationError(trimmedEmail)
    const nextPhoneCountryCodeError = getPhoneCountryCodeValidationError(trimmedPhoneCountryCode)
    const nextPhoneNumberError = getPhoneNumberValidationError(trimmedPhoneNumber)

    let hasError = false

    if (nextFirstNameError) {
      setEditFirstNameError(nextFirstNameError)
      hasError = true
    }

    if (nextLastNameError) {
      setEditLastNameError(nextLastNameError)
      hasError = true
    }

    if (nextEmailError) {
      setEditEmailError(nextEmailError)
      hasError = true
    }

    if (nextPhoneCountryCodeError) {
      setEditPhoneCountryCodeError(nextPhoneCountryCodeError)
      hasError = true
    }

    if (nextPhoneNumberError) {
      setEditPhoneNumberError(nextPhoneNumberError)
      hasError = true
    }

    return !hasError
  }

  const handleOpenEditUserModal = async (listedUser) => {
    closeDropdowns()
    resetEditUserState()

    const initialEditUserForm = getInitialEditUserForm(listedUser)

    setPendingEditUser(listedUser)
    setEditUserForm(initialEditUserForm)
    setSavedEditUserFormSnapshot(normalizeEditUserFormValues(initialEditUserForm))
    setIsPreparingEditUserModal(true)

    await new Promise((resolve) => setTimeout(resolve, 780))

    setIsPreparingEditUserModal(false)
    setIsEditUserModalClosing(false)
    setIsEditUserModalOpen(true)
  }

  const handleCloseEditUserModal = async () => {
    if (isEditUserModalClosing || isSavingEditedUser) {
      return
    }

    setIsEditUserModalClosing(true)

    await new Promise((resolve) => setTimeout(resolve, ACCOUNT_MODAL_TRANSITION_MS))

    resetEditUserState()
  }

  const closeEditUserModalForConfirm = async () => {
    setIsEditUserModalClosing(true)

    await new Promise((resolve) => setTimeout(resolve, ACCOUNT_MODAL_TRANSITION_MS))

    setIsEditUserModalOpen(false)
    setIsEditUserModalClosing(false)
    setIsEditCountryCodeOpen(false)
  }

  const handleConfirmEditUserSave = async (event) => {
    event.preventDefault()

    clearEditUserFormErrors()

    if (!validateEditUserForm() || !pendingEditUser?.id) {
      return
    }

    const submittedEditUserForm = normalizeEditUserFormValues(editUserForm)
    const editedUserId = pendingEditUser.id

    await closeEditUserModalForConfirm()

    const result = await Swal.fire({
      title: 'Save Changes?',
      text: 'Are you sure you want to save this user account details?',
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

    if (!result.isConfirmed) {
      resetEditUserState()
      return
    }

    const authToken = getStoredAuthToken()

    if (!authToken) {
      resetEditUserState()
      closeDropdowns()
      onLogout()
      return
    }

    try {
      flushSync(() => {
        setIsSavingEditedUser(true)
      })

      const response = await fetch(`${API_URL}/users/${editedUserId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({
          firstName: submittedEditUserForm.firstName,
          lastName: submittedEditUserForm.lastName,
          email: submittedEditUserForm.email,
          phoneCountryCode: submittedEditUserForm.phoneCountryCode,
          phoneNumber: submittedEditUserForm.phoneNumber
        })
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(
          data.message || 'Something went wrong while saving this account. Please try again.'
        )
      }

      const cacheKey = String(Date.now())

      setUsers((prev) =>
        prev.map((listedUser) =>
          listedUser.id === editedUserId
            ? {
                ...data.user,
                profilePictureUrl: appendImageCacheKey(data.user.profilePictureUrl, cacheKey)
              }
            : listedUser
        )
      )

      setIsSavingEditedUser(false)
      resetEditUserState()

      await showUsersDeleteResultAlert({
        type: 'success',
        title: 'User Account Updated',
        message: 'The user account has been updated successfully.'
      })
    } catch (error) {
      setIsSavingEditedUser(false)
      resetEditUserState()

      await showUsersDeleteResultAlert({
        type: 'error',
        title: 'Save Failed',
        message:
          error.message ||
          'Something went wrong while saving this account. Please try again.'
      })
    }
  }

  const resetDeleteUserState = () => {
    setPendingDeleteUser(null)
    setIsDeleteUserModalOpen(false)
    setIsDeleteUserModalClosing(false)
    setIsPreparingDeleteUserModal(false)
    setDeleteUserForm({
      password: '',
      confirmPassword: ''
    })
    setDeletePasswordError('')
    setDeleteConfirmPasswordError('')
    setDeleteAuthError('')
    setIsDeletePasswordVisible(false)
    setIsDeleteConfirmPasswordVisible(false)
    setIsDeletingUser(false)
    setIsDeleteUserRedirecting(false)
  }

  const handleDeleteUserInputChange = (field) => (event) => {
    const nextValue = event.target.value

    setDeleteUserForm((prev) => ({
      ...prev,
      [field]: nextValue
    }))

    if (field === 'password' && deletePasswordError) {
      setDeletePasswordError('')
    }

    if (field === 'confirmPassword' && deleteConfirmPasswordError) {
      setDeleteConfirmPasswordError('')
    }

    if (deleteAuthError) {
      setDeleteAuthError('')
    }
  }

  const validateDeleteUserForm = () => {
    const nextDeletePasswordError = getDeletePasswordValidationError(deleteUserForm.password)
    const nextDeleteConfirmPasswordError = getDeleteConfirmPasswordValidationError(
      deleteUserForm.password,
      deleteUserForm.confirmPassword
    )

    let hasError = false

    if (nextDeletePasswordError) {
      setDeletePasswordError(nextDeletePasswordError)
      hasError = true
    }

    if (nextDeleteConfirmPasswordError) {
      setDeleteConfirmPasswordError(nextDeleteConfirmPasswordError)
      hasError = true
    }

    return !hasError
  }

  const handleOpenDeleteUserModal = async (listedUser) => {
    const result = await Swal.fire({
      title: 'Delete User Account?',
      text: 'Are you sure you want to delete this user account?',
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

    resetDeleteUserState()
    setPendingDeleteUser(listedUser)
    setIsPreparingDeleteUserModal(true)

    await new Promise((resolve) => setTimeout(resolve, 780))

    setIsPreparingDeleteUserModal(false)
    setIsDeleteUserModalClosing(false)
    setIsDeleteUserModalOpen(true)
  }

  const handleCloseDeleteUserModal = async () => {
    if (isDeletingUser || isDeleteUserModalClosing) {
      return
    }

    setIsDeleteUserModalClosing(true)

    await new Promise((resolve) => setTimeout(resolve, ACCOUNT_MODAL_TRANSITION_MS))

    resetDeleteUserState()
  }

  const closeDeleteUserModalForSubmit = async () => {
    setIsDeleteUserModalClosing(true)

    await new Promise((resolve) => setTimeout(resolve, ACCOUNT_MODAL_TRANSITION_MS))

    setIsDeleteUserModalOpen(false)
    setIsDeleteUserModalClosing(false)
  }

  const handleConfirmDeleteUser = async (event) => {
    event.preventDefault()

    setDeletePasswordError('')
    setDeleteConfirmPasswordError('')
    setDeleteAuthError('')

    if (!validateDeleteUserForm() || !pendingDeleteUser?.id) {
      return
    }

    const authToken = getStoredAuthToken()

    if (!authToken) {
      resetDeleteUserState()
      closeDropdowns()
      onLogout()
      return
    }

    const submittedDeleteUserForm = {
      password: deleteUserForm.password,
      confirmPassword: deleteUserForm.confirmPassword
    }
    const deletedUserId = pendingDeleteUser.id

    try {
      await closeDeleteUserModalForSubmit()

      flushSync(() => {
        setIsDeletingUser(true)
      })

      const response = await fetch(
        `${API_URL}/users/${deletedUserId}`,
        {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: `Bearer ${authToken}`
          },
          body: JSON.stringify(submittedDeleteUserForm)
        }
      )

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(
          data.message || 'Something went wrong while deleting this account. Please try again.'
        )
      }

      const nextRemainingUsersCount = Math.max(usersTotalCount - 1, 0)
      const nextTotalUsersPages = Math.max(
        1,
        Math.ceil(nextRemainingUsersCount / USERS_PER_PAGE)
      )
      const nextUsersPage = Math.min(currentUsersPage, nextTotalUsersPages)

      setRemovingUserId(deletedUserId)

      await new Promise((resolve) => setTimeout(resolve, 280))

      setRemovingUserId(null)
      setIsDeletingUser(false)
      resetDeleteUserState()

      setUsersTableLoadingTitle('Loading Users')

      if (nextUsersPage !== currentUsersPage) {
        setCurrentUsersPage(nextUsersPage)
      } else {
        setUsersRefreshKey((prev) => prev + 1)
      }

      await showUsersDeleteResultAlert({
        type: 'success',
        title: 'User Account Deleted',
        message: 'The user account has been deleted successfully.'
      })
    } catch (error) {
      setIsDeletingUser(false)
      setRemovingUserId(null)
      resetDeleteUserState()

      await showUsersDeleteResultAlert({
        type: 'error',
        title: 'Delete Failed',
        message:
          error.message ||
          'Something went wrong while deleting this account. Please try again.'
      })
    }
  }

  const selectedEditCountryCodeOption =
    COUNTRY_CODE_OPTIONS.find((option) => option.id === editUserForm.phoneCountryOptionId) ||
    COUNTRY_CODE_OPTIONS.find((option) => option.value === editUserForm.phoneCountryCode) ||
    COUNTRY_CODE_OPTIONS[0]

  const normalizedCurrentEditUserForm = normalizeEditUserFormValues(editUserForm)

  const hasEditUserFormChanges =
    normalizedCurrentEditUserForm.firstName !== savedEditUserFormSnapshot.firstName ||
    normalizedCurrentEditUserForm.lastName !== savedEditUserFormSnapshot.lastName ||
    normalizedCurrentEditUserForm.email !== savedEditUserFormSnapshot.email ||
    normalizedCurrentEditUserForm.phoneCountryCode !== savedEditUserFormSnapshot.phoneCountryCode ||
    normalizedCurrentEditUserForm.phoneCountryOptionId !== savedEditUserFormSnapshot.phoneCountryOptionId ||
    normalizedCurrentEditUserForm.phoneNumber !== savedEditUserFormSnapshot.phoneNumber

  const hasEditFirstNameFieldError = Boolean(editFirstNameError)
  const hasEditLastNameFieldError = Boolean(editLastNameError)
  const hasEditEmailFieldError = Boolean(editEmailError)
  const hasEditPhoneCountryCodeFieldError = Boolean(editPhoneCountryCodeError)
  const hasEditPhoneNumberFieldError = Boolean(editPhoneNumberError)

  const isEditUserSaveDisabled =
    !hasEditUserFormChanges ||
    isSavingEditedUser ||
    isPreparingEditUserModal

  const hasUsersResults =
    !isUsersLoading &&
    !usersLoadError &&
    usersTotalCount > 0

  const usersEmptyStateMessage = appliedUsersSearchQuery
    ? 'No matching users found.'
    : 'No users found.'

  const isUsersSearchDisabled =
    isUsersLoading ||
    isPreparingUsersPdfPreview ||
    isDownloadingUsersPdf ||
    (usersSearchInput.trim().length === 0 && appliedUsersSearchQuery.length === 0)

  const usersPaginationItems = getUsersPaginationItems(
    currentUsersPage,
    usersTotalPages
  )

  const areUsersFiltersAtDefault =
    usersStatusFilter === 'all' &&
    usersCountryCodeFilter === 'all' &&
    usersPhotoFilter === 'all' &&
    usersSortBy === 'newest'

  const isUsersToolbarDisabled =
    isUsersLoading || isPreparingUsersPdfPreview || isDownloadingUsersPdf

  const usersPdfPreviewTags = [
    `Search: ${appliedUsersSearchQuery || 'All users'}`,
    `Status: ${getUsersFilterOptionLabel(USERS_STATUS_FILTER_OPTIONS, usersStatusFilter, 'All Statuses')}`,
    `Country Code: ${getUsersFilterOptionLabel(USERS_COUNTRY_FILTER_OPTIONS, usersCountryCodeFilter, 'All Country Codes')}`,
    `Photo: ${getUsersFilterOptionLabel(USERS_PHOTO_FILTER_OPTIONS, usersPhotoFilter, 'All Photos')}`,
    `Sort: ${getUsersFilterOptionLabel(USERS_SORT_OPTIONS, usersSortBy, 'Newest')}`,
    `Rows: ${usersTotalCount}`
  ]

  if (!isAdministrator) {
    return null
  }

  const deletePasswordFieldMessage = deletePasswordError || deleteAuthError
  const hasDeletePasswordFieldError = Boolean(deletePasswordFieldMessage)
  const hasDeleteConfirmPasswordFieldError = Boolean(deleteConfirmPasswordError || deleteAuthError)

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
          <div className="dashboard-header users-page-topbar">
            <h1 id="users-page-title" className="dashboard-content-title">Users</h1>
          </div>

          <section className="users-panel" aria-labelledby="users-page-title">
            <div className="users-panel-toolbar">
              <div className="users-filters-group" aria-label="Users filters">
                <UsersFilterDropdown
                  id="users-status-filter"
                  label="Status"
                  icon={<FilterIcon />}
                  className="users-filter-field-status"
                  value={usersStatusFilter}
                  options={USERS_STATUS_FILTER_OPTIONS}
                  isOpen={openUsersFilterDropdown === 'status'}
                  onToggle={() => handleUsersFilterDropdownToggle('status')}
                  onSelect={handleUsersStatusFilterChange}
                  disabled={isUsersToolbarDisabled}
                />

                <UsersFilterDropdown
                  id="users-country-code-filter"
                  label="Country Code"
                  icon={<GlobeIcon />}
                  className="users-filter-field-country"
                  value={usersCountryCodeFilter}
                  options={USERS_COUNTRY_FILTER_OPTIONS}
                  isOpen={openUsersFilterDropdown === 'country'}
                  onToggle={() => handleUsersFilterDropdownToggle('country')}
                  onSelect={handleUsersCountryCodeFilterChange}
                  disabled={isUsersToolbarDisabled}
                />

                <UsersFilterDropdown
                  id="users-photo-filter"
                  label="Profile Picture"
                  icon={<FilterIcon />}
                  className="users-filter-field-photo"
                  value={usersPhotoFilter}
                  options={USERS_PHOTO_FILTER_OPTIONS}
                  isOpen={openUsersFilterDropdown === 'photo'}
                  onToggle={() => handleUsersFilterDropdownToggle('photo')}
                  onSelect={handleUsersPhotoFilterChange}
                  disabled={isUsersToolbarDisabled}
                />

                <UsersFilterDropdown
                  id="users-sort-filter"
                  label="Sort By"
                  icon={<SortIcon />}
                  className="users-filter-field-sort"
                  value={usersSortBy}
                  options={USERS_SORT_OPTIONS}
                  isOpen={openUsersFilterDropdown === 'sort'}
                  onToggle={() => handleUsersFilterDropdownToggle('sort')}
                  onSelect={handleUsersSortByChange}
                  disabled={isUsersToolbarDisabled}
                />

                <button
                  type="button"
                  className="users-filter-reset-button"
                  onClick={handleUsersResetFilters}
                  disabled={isUsersToolbarDisabled || areUsersFiltersAtDefault}
                >
                  Reset Filters
                </button>
              </div>

              <button
                type="button"
                className="users-export-button users-export-button-toolbar"
                onClick={handleOpenUsersPdfPreview}
                disabled={isUsersToolbarDisabled}
              >
                <span className="users-export-button-icon" aria-hidden="true">
                  <DownloadIcon />
                </span>
                <span>Export PDF</span>
              </button>

              <form
                className="users-search-form"
                onSubmit={handleUsersSearchSubmit}
                role="search"
                aria-label="Search users"
              >
                <div className="users-search-field">
                  <span className="users-search-input-icon" aria-hidden="true">
                    <SearchIcon />
                  </span>

                  <div className="users-search-floating-control">
                    <input
                      id="users-search-input"
                      type="search"
                      className="users-search-input users-search-floating-input"
                      placeholder=" "
                      value={usersSearchInput}
                      onChange={handleUsersSearchInputChange}
                      aria-label="Search users"
                      disabled={isUsersToolbarDisabled}
                    />
                    <label htmlFor="users-search-input" className="users-search-floating-label">
                      Search
                    </label>
                  </div>
                </div>

                <button
                  type="submit"
                  className="users-search-button"
                  disabled={isUsersSearchDisabled}
                >
                  <span className="users-search-button-icon" aria-hidden="true">
                    <SearchIcon />
                  </span>
                  <span>Search</span>
                </button>
              </form>
            </div>

            <div className="users-table-shell">
              {isUsersTableTransitioning && (hasUsersLoadedOnce || usersLoadReason !== 'initial') && (
                <div
                  className="users-table-loading-overlay"
                  role="status"
                  aria-live="polite"
                  aria-busy="true"
                >
                  <div className="users-table-loading-card">
                    <img src={logo} alt="Avinya Logo" className="users-table-loading-logo" />
                    <p className="users-table-loading-title">{usersTableLoadingTitle}</p>
                    <div className="users-table-loading-loader" aria-hidden="true">
                      <span className="users-table-loading-loader-bar"></span>
                    </div>
                  </div>
                </div>
              )}

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
                  <colgroup>
                    <col className="users-table-col-no" />
                    <col className="users-table-col-picture" />
                    <col className="users-table-col-last-name" />
                    <col className="users-table-col-first-name" />
                    <col className="users-table-col-email" />
                    <col className="users-table-col-country-code" />
                    <col className="users-table-col-phone-number" />
                    <col className="users-table-col-status" />
                    <col className="users-table-col-actions" />
                  </colgroup>

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

                  <tbody key={usersTableAnimationKey}>
                    {isUsersLoading && hasUsersLoadedOnce && usersLoadReason === 'pagination' ? (
                      <tr className="users-table-state-row">
                        <td colSpan="9" className="users-table-state-cell">
                          Loading users...
                        </td>
                      </tr>
                    ) : usersLoadError ? (
                      <tr className="users-table-state-row">
                        <td colSpan="9" className="users-table-state-cell users-table-state-cell-error">
                          {usersLoadError}
                        </td>
                      </tr>
                    ) : !isUsersLoading && users.length === 0 ? (
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
                          <tr
                            key={listedUser.id}
                            className={`users-table-body-row ${
                              removingUserId === listedUser.id ? 'users-table-body-row-removing' : ''
                            } ${
                              !isUsersTableTransitioning && removingUserId !== listedUser.id
                                ? 'users-table-body-row-reveal'
                                : ''
                            }`}
                            style={
                              !isUsersTableTransitioning && removingUserId !== listedUser.id
                                ? { '--users-row-delay': `${Math.min(index, 9) * 28}ms` }
                                : undefined
                            }
                          >
                            <td>{(currentUsersPage - 1) * USERS_PER_PAGE + index + 1}</td>

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

                            <td className="users-actions-cell">
                              <div className="users-actions">
                                <button
                                  type="button"
                                  className="users-action-button users-action-button-edit"
                                  onClick={() => handleOpenEditUserModal(listedUser)}
                                  disabled={
                                    isPreparingEditUserModal ||
                                    isSavingEditedUser ||
                                    isPreparingDeleteUserModal ||
                                    isDeletingUser ||
                                    removingUserId === listedUser.id
                                  }
                                >
                                  <span className="users-action-button-icon" aria-hidden="true">
                                    <EditIcon />
                                  </span>
                                  <span>Edit</span>
                                </button>

                                <button
                                  type="button"
                                  className="users-action-button users-action-button-delete"
                                  onClick={() => handleOpenDeleteUserModal(listedUser)}
                                  disabled={
                                    isPreparingDeleteUserModal ||
                                    isDeletingUser ||
                                    isDeleteUserRedirecting ||
                                    removingUserId === listedUser.id
                                  }
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
                    {usersEmptyStateMessage}
                  </div>
                )}
              </div>

              {hasUsersResults && (
                <div className="users-pagination-shell">
                  <nav className="users-pagination" aria-label="Users pagination">
                    <div className="users-pagination-group users-pagination-group-start">
                      <button
                        type="button"
                        className="users-pagination-button users-pagination-button-with-icon users-pagination-button-start"
                        onClick={() => handleUsersPageChange(1)}
                        disabled={currentUsersPage === 1 || isUsersLoading}
                      >
                        <span className="users-pagination-button-icon" aria-hidden="true">
                          <FirstPageIcon />
                        </span>
                        <span>First</span>
                      </button>

                      <button
                        type="button"
                        className="users-pagination-button users-pagination-button-with-icon users-pagination-button-start"
                        onClick={() => handleUsersPageChange(currentUsersPage - 1)}
                        disabled={currentUsersPage === 1 || isUsersLoading}
                      >
                        <span className="users-pagination-button-icon" aria-hidden="true">
                          <PreviousPageIcon />
                        </span>
                        <span>Back</span>
                      </button>
                    </div>

                    <div className="users-pagination-group users-pagination-group-center">
                      {usersPaginationItems.map((item, index) => {
                        if (typeof item === 'string' && item.startsWith('ellipsis-')) {
                          return (
                            <span
                              key={`${item}-${index}`}
                              className="users-pagination-ellipsis"
                              aria-hidden="true"
                            >
                              ...
                            </span>
                          )
                        }

                        return (
                          <button
                            key={item}
                            type="button"
                            className={`users-pagination-button users-pagination-number ${
                              currentUsersPage === item ? 'active' : ''
                            }`}
                            onClick={() => handleUsersPageChange(item)}
                            disabled={currentUsersPage === item || isUsersLoading}
                            aria-current={currentUsersPage === item ? 'page' : undefined}
                          >
                            {item}
                          </button>
                        )
                      })}
                    </div>

                    <div className="users-pagination-group users-pagination-group-end">
                      <button
                        type="button"
                        className="users-pagination-button users-pagination-button-with-icon users-pagination-button-end"
                        onClick={() => handleUsersPageChange(currentUsersPage + 1)}
                        disabled={currentUsersPage === usersTotalPages || isUsersLoading}
                      >
                        <span>Next</span>
                        <span className="users-pagination-button-icon" aria-hidden="true">
                          <NextPageIcon />
                        </span>
                      </button>

                      <button
                        type="button"
                        className="users-pagination-button users-pagination-button-with-icon users-pagination-button-end"
                        onClick={() => handleUsersPageChange(usersTotalPages)}
                        disabled={currentUsersPage === usersTotalPages || isUsersLoading}
                      >
                        <span>Last</span>
                        <span className="users-pagination-button-icon" aria-hidden="true">
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
      {isEditUserModalOpen && (
        <div
          className={`account-photo-modal-overlay ${isEditUserModalClosing ? 'account-modal-closing' : ''}`}
          onClick={handleCloseEditUserModal}
        >
          <div
            className={`account-photo-modal users-edit-modal ${isEditUserModalClosing ? 'account-modal-closing' : ''}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="users-edit-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="account-photo-modal-close"
              onClick={handleCloseEditUserModal}
              aria-label="Close edit user dialog"
              disabled={isSavingEditedUser}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18" />
                <path d="M6 6l12 12" />
              </svg>
            </button>

            <div className="account-photo-modal-header">
              <h2 id="users-edit-modal-title" className="account-photo-modal-title">
                Edit User Account
              </h2>
              <p className="account-photo-modal-text">
                Update the user account information below.
              </p>
            </div>

            <form className="users-edit-modal-form" onSubmit={handleConfirmEditUserSave}>
              <div className="account-form-grid">
                <div className="account-field-group">
                  <div className={`account-field account-floating-field ${hasEditFirstNameFieldError ? 'account-field-error' : ''}`}>
                    <span className="account-field-icon" aria-hidden="true">
                      <UserIcon />
                    </span>

                    <div className="account-floating-control">
                      <input
                        id="users-edit-first-name"
                        type="text"
                        className="account-input account-floating-input"
                        placeholder=" "
                        value={editUserForm.firstName}
                        onChange={handleEditUserInputChange('firstName')}
                        autoComplete="given-name"
                        aria-invalid={hasEditFirstNameFieldError}
                        disabled={isSavingEditedUser}
                      />
                      <label htmlFor="users-edit-first-name" className="account-floating-label">
                        First Name
                      </label>
                    </div>
                  </div>

                  {editFirstNameError && (
                    <div className="account-error-row account-error-row-animated">
                      <span className="account-error-icon" aria-hidden="true">
                        <ErrorIcon />
                      </span>
                      <span>{editFirstNameError}</span>
                    </div>
                  )}
                </div>

                <div className="account-field-group">
                  <div className={`account-field account-floating-field ${hasEditLastNameFieldError ? 'account-field-error' : ''}`}>
                    <span className="account-field-icon" aria-hidden="true">
                      <UserIcon />
                    </span>

                    <div className="account-floating-control">
                      <input
                        id="users-edit-last-name"
                        type="text"
                        className="account-input account-floating-input"
                        placeholder=" "
                        value={editUserForm.lastName}
                        onChange={handleEditUserInputChange('lastName')}
                        autoComplete="family-name"
                        aria-invalid={hasEditLastNameFieldError}
                        disabled={isSavingEditedUser}
                      />
                      <label htmlFor="users-edit-last-name" className="account-floating-label">
                        Last Name
                      </label>
                    </div>
                  </div>

                  {editLastNameError && (
                    <div className="account-error-row account-error-row-animated">
                      <span className="account-error-icon" aria-hidden="true">
                        <ErrorIcon />
                      </span>
                      <span>{editLastNameError}</span>
                    </div>
                  )}
                </div>

                <div className="account-field-group account-field-group-full">
                  <div className={`account-field account-floating-field ${hasEditEmailFieldError ? 'account-field-error' : ''}`}>
                    <span className="account-field-icon" aria-hidden="true">
                      <UserIcon />
                    </span>

                    <div className="account-floating-control">
                      <input
                        id="users-edit-email"
                        type="email"
                        className="account-input account-floating-input"
                        placeholder=" "
                        value={editUserForm.email}
                        onChange={handleEditUserInputChange('email')}
                        autoComplete="email"
                        aria-invalid={hasEditEmailFieldError}
                        disabled={isSavingEditedUser}
                      />
                      <label htmlFor="users-edit-email" className="account-floating-label">
                        Email
                      </label>
                    </div>
                  </div>

                  {editEmailError && (
                    <div className="account-error-row account-error-row-animated">
                      <span className="account-error-icon" aria-hidden="true">
                        <ErrorIcon />
                      </span>
                      <span>{editEmailError}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="account-phone-row">
                <div className="account-country-group">
                  <div className={`account-country-dropdown ${isEditCountryCodeOpen ? 'open' : ''}`}>
                    <button
                      type="button"
                      className={`account-field account-floating-field account-dropdown-trigger ${hasEditPhoneCountryCodeFieldError ? 'account-field-error' : ''} ${isEditCountryCodeOpen ? 'account-dropdown-trigger-open' : ''}`}
                      onClick={handleEditCountryCodeToggle}
                      aria-haspopup="listbox"
                      aria-expanded={isEditCountryCodeOpen}
                      disabled={isSavingEditedUser}
                    >
                      <span className="account-field-icon" aria-hidden="true">
                        <GlobeIcon />
                      </span>

                      <div className="account-floating-control">
                        <span className="account-dropdown-value account-dropdown-value-desktop">
                          {renderCountryFlag(selectedEditCountryCodeOption.iso, 'account-dropdown-flag')}
                          <span className="account-dropdown-value-text">
                            {selectedEditCountryCodeOption.label}
                          </span>
                        </span>

                        <span className="account-dropdown-value account-dropdown-value-mobile">
                          {renderCountryFlag(selectedEditCountryCodeOption.iso, 'account-dropdown-flag')}
                          <span className="account-dropdown-value-text">
                            {selectedEditCountryCodeOption.shortLabel}
                          </span>
                        </span>

                        <span className="account-floating-label account-floating-label-static">
                          Country Code
                        </span>
                      </div>

                      <span className="account-dropdown-arrow" aria-hidden="true">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d={isEditCountryCodeOpen ? 'M18 15l-6-6-6 6' : 'M6 9l6 6 6-6'} />
                        </svg>
                      </span>
                    </button>

                    <div className={`account-dropdown-menu ${isEditCountryCodeOpen ? 'open' : ''}`} role="listbox">
                      {COUNTRY_CODE_OPTIONS.map((option) => (
                        <button
                          key={option.id}
                          type="button"
                          className={`account-dropdown-option ${editUserForm.phoneCountryOptionId === option.id ? 'active' : ''}`}
                          onClick={() => handleEditCountryCodeSelect(option)}
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

                  {editPhoneCountryCodeError && (
                    <div className="account-error-row account-error-row-animated">
                      <span className="account-error-icon" aria-hidden="true">
                        <ErrorIcon />
                      </span>
                      <span>{editPhoneCountryCodeError}</span>
                    </div>
                  )}
                </div>

                <div className="account-phone-group">
                  <div className={`account-field account-floating-field ${hasEditPhoneNumberFieldError ? 'account-field-error' : ''}`}>
                    <span className="account-field-icon" aria-hidden="true">
                      <PhoneIcon />
                    </span>

                    <div className="account-floating-control">
                      <input
                        id="users-edit-phone-number"
                        type="tel"
                        className="account-input account-floating-input"
                        placeholder=" "
                        value={editUserForm.phoneNumber}
                        onChange={handleEditUserInputChange('phoneNumber')}
                        autoComplete="tel-national"
                        inputMode="numeric"
                        aria-invalid={hasEditPhoneNumberFieldError}
                        disabled={isSavingEditedUser}
                      />
                      <label htmlFor="users-edit-phone-number" className="account-floating-label">
                        Phone Number
                      </label>
                    </div>
                  </div>

                  <p className="account-phone-helper">
                    {phoneNumberHelperText}
                  </p>

                  {editPhoneNumberError && (
                    <div className="account-error-row account-error-row-animated">
                      <span className="account-error-icon" aria-hidden="true">
                        <ErrorIcon />
                      </span>
                      <span>{editPhoneNumberError}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="account-actions users-edit-modal-actions">
                <button
                  type="button"
                  className="account-button account-button-secondary"
                  onClick={handleCloseEditUserModal}
                  disabled={isSavingEditedUser}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="account-button account-button-primary"
                  disabled={isEditUserSaveDisabled}
                >
                  <span className="account-button-icon" aria-hidden="true">
                    <SaveIcon />
                  </span>
                  <span>Save</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isDeleteUserModalOpen && (
        <div
          className={`account-photo-modal-overlay ${isDeleteUserModalClosing ? 'account-modal-closing' : ''}`}
          onClick={handleCloseDeleteUserModal}
        >
          <div
            className={`account-photo-modal account-delete-modal ${isDeleteUserModalClosing ? 'account-modal-closing' : ''}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="users-delete-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="account-photo-modal-close"
              onClick={handleCloseDeleteUserModal}
              aria-label="Close delete user dialog"
              disabled={isDeletingUser}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18" />
                <path d="M6 6l12 12" />
              </svg>
            </button>

            <div className="account-photo-modal-header account-delete-modal-header">
              <h2 id="users-delete-modal-title" className="account-photo-modal-title">
                Delete User Account
              </h2>
              <p className="account-photo-modal-text">
                Enter your password and confirm it to continue deleting this user account.
              </p>
            </div>

            <form
              className="account-delete-modal-form"
              onSubmit={handleConfirmDeleteUser}
            >
              <div className="account-field-group">
                <div className={`account-field account-floating-field ${hasDeletePasswordFieldError ? 'account-field-error' : ''}`}>
                  <span className="account-field-icon" aria-hidden="true">
                    <LockIcon />
                  </span>

                  <div className="account-floating-control">
                    <input
                      id="users-delete-password"
                      type={isDeletePasswordVisible ? 'text' : 'password'}
                      className="account-input account-floating-input"
                      placeholder=" "
                      value={deleteUserForm.password}
                      onChange={handleDeleteUserInputChange('password')}
                      autoComplete="current-password"
                      autoCapitalize="none"
                      spellCheck={false}
                      aria-invalid={hasDeletePasswordFieldError}
                      disabled={isDeletingUser}
                    />
                    <label htmlFor="users-delete-password" className="account-floating-label">
                      Password
                    </label>
                  </div>

                  <button
                    type="button"
                    className="account-password-toggle"
                    onClick={() => setIsDeletePasswordVisible((prev) => !prev)}
                    aria-label={isDeletePasswordVisible ? 'Hide password' : 'Show password'}
                    disabled={isDeletingUser}
                  >
                    {isDeletePasswordVisible ? <EyeClosedIcon /> : <EyeOpenIcon />}
                  </button>
                </div>

                {deletePasswordFieldMessage && (
                  <div className="account-error-row account-error-row-animated">
                    <span className="account-error-icon" aria-hidden="true">
                      <ErrorIcon />
                    </span>
                    <span>{deletePasswordFieldMessage}</span>
                  </div>
                )}
              </div>

              <div className="account-field-group">
                <div className={`account-field account-floating-field ${hasDeleteConfirmPasswordFieldError ? 'account-field-error' : ''}`}>
                  <span className="account-field-icon" aria-hidden="true">
                    <LockIcon />
                  </span>

                  <div className="account-floating-control">
                    <input
                      id="users-delete-confirm-password"
                      type={isDeleteConfirmPasswordVisible ? 'text' : 'password'}
                      className="account-input account-floating-input"
                      placeholder=" "
                      value={deleteUserForm.confirmPassword}
                      onChange={handleDeleteUserInputChange('confirmPassword')}
                      autoComplete="current-password"
                      autoCapitalize="none"
                      spellCheck={false}
                      aria-invalid={hasDeleteConfirmPasswordFieldError}
                      disabled={isDeletingUser}
                    />
                    <label htmlFor="users-delete-confirm-password" className="account-floating-label">
                      Confirm Password
                    </label>
                  </div>

                  <button
                    type="button"
                    className="account-password-toggle"
                    onClick={() => setIsDeleteConfirmPasswordVisible((prev) => !prev)}
                    aria-label={isDeleteConfirmPasswordVisible ? 'Hide confirm password' : 'Show confirm password'}
                    disabled={isDeletingUser}
                  >
                    {isDeleteConfirmPasswordVisible ? <EyeClosedIcon /> : <EyeOpenIcon />}
                  </button>
                </div>

                {deleteConfirmPasswordError && (
                  <div className="account-error-row account-error-row-animated">
                    <span className="account-error-icon" aria-hidden="true">
                      <ErrorIcon />
                    </span>
                    <span>{deleteConfirmPasswordError}</span>
                  </div>
                )}
              </div>

              <div className="account-delete-modal-actions">
                <button
                  type="button"
                  className="account-button account-button-secondary"
                  onClick={handleCloseDeleteUserModal}
                  disabled={isDeletingUser}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="account-button account-button-primary"
                  disabled={isDeletingUser}
                >
                  {isDeletingUser ? 'Deleting Account' : 'Delete Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isUsersPdfPreviewModalOpen && (
        <div
          className={`account-photo-modal-overlay ${isUsersPdfPreviewModalClosing ? 'account-modal-closing' : ''}`}
          onClick={handleCloseUsersPdfPreviewModal}
        >
          <div
            className={`account-photo-modal users-pdf-preview-modal ${isUsersPdfPreviewModalClosing ? 'account-modal-closing' : ''}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="users-pdf-preview-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="account-photo-modal-close"
              onClick={handleCloseUsersPdfPreviewModal}
              aria-label="Close PDF preview dialog"
              disabled={isDownloadingUsersPdf}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18" />
                <path d="M6 6l12 12" />
              </svg>
            </button>

            <div className="account-photo-modal-header users-pdf-preview-modal-header">
              <h2 id="users-pdf-preview-title" className="account-photo-modal-title">
                Users PDF Preview
              </h2>
              <p className="account-photo-modal-text">
                Review the file below before downloading.
              </p>
            </div>

            <div className="users-pdf-preview-meta">
              <div className="users-pdf-preview-meta-card">
                <span className="users-pdf-preview-meta-label">File Name</span>
                <span className="users-pdf-preview-meta-value" title={usersPdfFileName}>
                  {usersPdfFileName}
                </span>
              </div>

              <div className="users-pdf-preview-tags">
                {usersPdfPreviewTags.map((tag) => (
                  <span key={tag} className="users-pdf-preview-tag">
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            <div className="users-pdf-preview-frame-shell">
              {usersPdfPreviewUrl ? (
                <iframe
                  title="Users PDF Preview"
                  src={usersPdfPreviewUrl}
                  className="users-pdf-preview-frame"
                />
              ) : (
                <div className="users-pdf-preview-empty">
                  Preview unavailable.
                </div>
              )}
            </div>

            <div className="account-actions users-pdf-preview-actions">
              <button
                type="button"
                className="account-button account-button-secondary"
                onClick={handleCloseUsersPdfPreviewModal}
                disabled={isDownloadingUsersPdf}
              >
                Cancel
              </button>

              <button
                type="button"
                className="account-button account-button-primary"
                onClick={handleDownloadUsersPdf}
                disabled={isDownloadingUsersPdf || !usersPdfPreviewUrl}
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

      {isPreparingEditUserModal && (
        <div className="account-save-overlay" role="status" aria-live="polite" aria-busy="true">
          <div className="account-save-card account-save-card-compact">
            <img src={logo} alt="Avinya Logo" className="account-save-logo" />
            <div className="account-save-loader" aria-hidden="true">
              <span className="account-save-loader-bar"></span>
            </div>
          </div>
        </div>
      )}

      {!isEditUserModalOpen && isSavingEditedUser && (
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

      {isPreparingDeleteUserModal && (
        <div className="account-save-overlay" role="status" aria-live="polite" aria-busy="true">
          <div className="account-save-card account-save-card-compact">
            <img src={logo} alt="Avinya Logo" className="account-save-logo" />
            <div className="account-save-loader" aria-hidden="true">
              <span className="account-save-loader-bar"></span>
            </div>
          </div>
        </div>
      )}

      {!isDeleteUserModalOpen && (isDeletingUser || isDeleteUserRedirecting) && (
        <div className="account-save-overlay" role="status" aria-live="polite" aria-busy="true">
          <div className="account-save-card">
            <img src={logo} alt="Avinya Logo" className="account-save-logo" />
            <p className="account-save-title">Deleting Account</p>
            <div className="account-save-loader" aria-hidden="true">
              <span className="account-save-loader-bar"></span>
            </div>
          </div>
        </div>
      )}

      {isPreparingUsersPdfPreview && (
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

      {isUsersPdfPreviewModalOpen && isDownloadingUsersPdf && (
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

export default Users