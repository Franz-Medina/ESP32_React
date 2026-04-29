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
  ErrorIcon,
  LockIcon,
  EyeOpenIcon,
  EyeClosedIcon,
  PhotoRemoveIcon,
  TrashIcon,
  SaveIcon,
  ProfileMenuIcon
} from '../Components/Icons.jsx'
import { getCurrentUserProfile, isAdministratorRole } from '../Utils/getCurrentUserProfile'
import { performReliableLogout } from '../Utils/performReliableLogout'
import { getCroppedImageDataUrl } from '../Utils/cropImage'
import { API_URL, buildApiAssetUrl } from '../Config/API'
import { getStoredAuthToken } from '../Utils/authStorage'

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
const ACCOUNT_MODAL_TRANSITION_MS = 280

const normalizeAccountFormValues = (form = {}) => ({
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

const updateStoredUserProfile = (nextProfile = {}) => {
  const storages = [sessionStorage, localStorage]

  storages.forEach((storage) => {
    const rawUser =
      storage.getItem('authUser') ||
      storage.getItem('tbUser')

    if (!rawUser) {
      return
    }

    try {
      const parsedUser = JSON.parse(rawUser)

      storage.setItem(
        'authUser',
        JSON.stringify({
          ...parsedUser,
          firstName: String(nextProfile.firstName || parsedUser.firstName || '').trim(),
          lastName: String(nextProfile.lastName || parsedUser.lastName || '').trim(),
          email: String(nextProfile.email || parsedUser.email || '').trim(),
          phoneCountryCode: String(
            nextProfile.phoneCountryCode || parsedUser.phoneCountryCode || '+63'
          ).trim(),
          phoneNumber: String(nextProfile.phoneNumber || parsedUser.phoneNumber || '').trim(),
          roleLabel: String(nextProfile.roleLabel || parsedUser.roleLabel || '').trim(),
          profilePictureUrl: String(nextProfile.profilePictureUrl || '').trim()
        })
      )

      storage.removeItem('tbUser')
      storage.removeItem('tbRefreshToken')
    } catch {
      storage.removeItem('authUser')
      storage.removeItem('tbUser')
      storage.removeItem('tbRefreshToken')
    }
  })
}

const Account = ({ onLogout, onNavigate, isDarkMode, onThemeToggle }) => {
  const [isEntitiesOpen, setIsEntitiesOpen] = useState(false)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false)
  const [isCountryCodeOpen, setIsCountryCodeOpen] = useState(false)

  const user = getCurrentUserProfile()
  const isAdministrator = isAdministratorRole(user.roleLabel)

  const [profileForm, setProfileForm] = useState(() => getInitialAccountForm(user))
  const [savedProfileFormSnapshot, setSavedProfileFormSnapshot] = useState(() =>
    normalizeAccountFormValues(getInitialAccountForm(user))
  )
  const [savedProfileImagePreview, setSavedProfileImagePreview] = useState(
    () => buildApiAssetUrl(user.profilePictureUrl)
  )
  const [profileImagePreview, setProfileImagePreview] = useState(
    () => buildApiAssetUrl(user.profilePictureUrl)
  )
  const [profileImageError, setProfileImageError] = useState('')

  const [firstNameError, setFirstNameError] = useState('')
  const [lastNameError, setLastNameError] = useState('')
  const [emailError, setEmailError] = useState('')
  const [phoneNumberError, setPhoneNumberError] = useState('')
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [photoProcessingMode, setPhotoProcessingMode] = useState('')
  const [isPhotoCropModalOpen, setIsPhotoCropModalOpen] = useState(false)
  const [isPhotoCropModalClosing, setIsPhotoCropModalClosing] = useState(false)
  const [photoCropSource, setPhotoCropSource] = useState('')
  const [photoCropValue, setPhotoCropValue] = useState({ x: 0, y: 0 })
  const [photoZoomValue, setPhotoZoomValue] = useState(0.75)
  const [photoCroppedAreaPixels, setPhotoCroppedAreaPixels] = useState(null)

  const [isDeleteAccountModalOpen, setIsDeleteAccountModalOpen] = useState(false)
  const [isDeleteAccountModalClosing, setIsDeleteAccountModalClosing] = useState(false)
  const [isPreparingDeleteAccountModal, setIsPreparingDeleteAccountModal] = useState(false)
  const [deleteAccountForm, setDeleteAccountForm] = useState({
    password: '',
    confirmPassword: ''
  })
  const [deletePasswordError, setDeletePasswordError] = useState('')
  const [deleteConfirmPasswordError, setDeleteConfirmPasswordError] = useState('')
  const [deleteAuthError, setDeleteAuthError] = useState('')
  const [isDeletePasswordVisible, setIsDeletePasswordVisible] = useState(false)
  const [isDeleteConfirmPasswordVisible, setIsDeleteConfirmPasswordVisible] = useState(false)
  const [isDeletingAccount, setIsDeletingAccount] = useState(false)
  const [isDeleteAccountRedirecting, setIsDeleteAccountRedirecting] = useState(false)

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

  const handleDeleteAccountInputChange = (field) => (event) => {
    const nextValue = event.target.value

    setDeleteAccountForm((prev) => ({
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

  const resetPhotoCropState = () => {
    setIsPhotoCropModalOpen(false)
    setIsPhotoCropModalClosing(false)
    setPhotoCropSource('')
    setPhotoCropValue({ x: 0, y: 0 })
    setPhotoZoomValue(0.75)
    setPhotoCroppedAreaPixels(null)

    if (profileImageInputRef.current) {
      profileImageInputRef.current.value = ''
    }
  }

  const resetDeleteAccountState = () => {
    setIsDeleteAccountModalOpen(false)
    setIsDeleteAccountModalClosing(false)
    setIsPreparingDeleteAccountModal(false)
    setDeleteAccountForm({
      password: '',
      confirmPassword: ''
    })
    setDeletePasswordError('')
    setDeleteConfirmPasswordError('')
    setDeleteAuthError('')
    setIsDeletePasswordVisible(false)
    setIsDeleteConfirmPasswordVisible(false)
    setIsDeletingAccount(false)
    setIsDeleteAccountRedirecting(false)
  }

  const handleOpenPhotoPicker = () => {
    if (!profileImageInputRef.current || Boolean(photoProcessingMode)) {
      return
    }

    setProfileImageError('')

    flushSync(() => {
      setPhotoProcessingMode('photo-picker-opening')
    })

    if (typeof profileImageInputRef.current.showPicker === 'function') {
      profileImageInputRef.current.showPicker()
    } else {
      profileImageInputRef.current.click()
    }

    window.setTimeout(() => {
      setPhotoProcessingMode((currentMode) =>
        currentMode === 'photo-picker-opening' ? '' : currentMode
      )
    }, 180)
  }

  const handlePhotoCropComplete = (_, croppedAreaPixels) => {
    setPhotoCroppedAreaPixels(croppedAreaPixels)
  }

  const handleClosePhotoCropModal = async () => {
    if (isPhotoCropModalClosing) {
      return
    }

    setPhotoProcessingMode('')
    setIsPhotoCropModalClosing(true)

    await new Promise((resolve) => setTimeout(resolve, ACCOUNT_MODAL_TRANSITION_MS))

    resetPhotoCropState()
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
        setProfileImageError('')

        await new Promise((resolve) => setTimeout(resolve, 450))

        setPhotoCropSource(String(reader.result || ''))
        setPhotoCropValue({ x: 0, y: 0 })
        setPhotoZoomValue(0.75)
        setPhotoCroppedAreaPixels(null)
        setIsPhotoCropModalClosing(false)
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
    if (!photoCropSource || !photoCroppedAreaPixels || isPhotoCropModalClosing) {
      return
    }

    const nextPhotoCropSource = photoCropSource
    const nextPhotoCroppedAreaPixels = photoCroppedAreaPixels

    try {
      setIsPhotoCropModalClosing(true)

      await new Promise((resolve) => setTimeout(resolve, ACCOUNT_MODAL_TRANSITION_MS))

      resetPhotoCropState()
      setPhotoProcessingMode('photo-applying')

      await new Promise((resolve) => setTimeout(resolve, 650))

      const nextProfileImagePreview = await getCroppedImageDataUrl(
        nextPhotoCropSource,
        nextPhotoCroppedAreaPixels
      )

      setProfileImagePreview(nextProfileImagePreview)
      setProfileImageError('')
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
    setProfileImageError('')
    resetPhotoCropState()
    setPhotoProcessingMode('')

    if (profileImageInputRef.current) {
      profileImageInputRef.current.value = ''
    }
  }

  const validateDeleteAccountForm = () => {
    const nextDeletePasswordError = getDeletePasswordValidationError(deleteAccountForm.password)
    const nextDeleteConfirmPasswordError = getDeleteConfirmPasswordValidationError(
      deleteAccountForm.password,
      deleteAccountForm.confirmPassword
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

  const handleOpenDeleteAccountModal = async () => {
    if (isAdministrator) {
      return
    }

    const result = await Swal.fire({
      title: 'Delete User Account?',
      text: 'Are you sure you want to delete your user account?',
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

    resetDeleteAccountState()
    setIsPreparingDeleteAccountModal(true)

    await new Promise((resolve) => setTimeout(resolve, 780))

    setIsPreparingDeleteAccountModal(false)
    setIsDeleteAccountModalClosing(false)
    setIsDeleteAccountModalOpen(true)
  }

  const handleCloseDeleteAccountModal = async () => {
    if (isDeletingAccount || isDeleteAccountModalClosing) {
      return
    }

    setIsDeleteAccountModalClosing(true)

    await new Promise((resolve) => setTimeout(resolve, ACCOUNT_MODAL_TRANSITION_MS))

    resetDeleteAccountState()
  }

  const closeDeleteAccountModalForSubmit = async () => {
    setIsDeleteAccountModalClosing(true)

    await new Promise((resolve) => setTimeout(resolve, ACCOUNT_MODAL_TRANSITION_MS))

    setIsDeleteAccountModalOpen(false)
    setIsDeleteAccountModalClosing(false)
  }

  const handleConfirmDeleteAccount = async (event) => {
    event.preventDefault()

    setDeletePasswordError('')
    setDeleteConfirmPasswordError('')
    setDeleteAuthError('')

    if (!validateDeleteAccountForm()) {
      return
    }

    const authToken = getStoredAuthToken()

    if (!authToken) {
      resetDeleteAccountState()
      closeDropdowns()
      onLogout()
      return
    }

    const submittedDeleteAccountForm = {
      password: deleteAccountForm.password,
      confirmPassword: deleteAccountForm.confirmPassword
    }

    try {
      await closeDeleteAccountModalForSubmit()

      flushSync(() => {
        setIsDeletingAccount(true)
      })

      const response = await fetch(`${API_URL}/account`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify(submittedDeleteAccountForm)
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(
          data.message || 'Something went wrong while deleting your account. Please try again.'
        )
      }

      setIsDeleteAccountRedirecting(true)

      await new Promise((resolve) => setTimeout(resolve, 620))

      closeDropdowns()
      onLogout()
    } catch (error) {
      setIsDeletingAccount(false)
      setIsDeleteAccountRedirecting(false)
      resetDeleteAccountState()

      await showAccountSaveResultAlert({
        type: 'error',
        title: 'Delete Failed',
        message:
          error.message ||
          'Something went wrong while deleting your account. Please try again.'
      })
    }
  }

  const selectedCountryCodeOption =
    COUNTRY_CODE_OPTIONS.find((option) => option.id === profileForm.phoneCountryOptionId) ||
    COUNTRY_CODE_OPTIONS.find((option) => option.value === profileForm.phoneCountryCode) ||
    COUNTRY_CODE_OPTIONS[0]

  const phoneNumberHelperText =
    'Enter digits only, without the country code. Example: 9123456789. No leading 0 or spaces.'

  const currentProfileFormValues = normalizeAccountFormValues(profileForm)

  const hasProfileFormChanges =
    currentProfileFormValues.firstName !== savedProfileFormSnapshot.firstName ||
    currentProfileFormValues.lastName !== savedProfileFormSnapshot.lastName ||
    currentProfileFormValues.email !== savedProfileFormSnapshot.email ||
    currentProfileFormValues.phoneCountryCode !== savedProfileFormSnapshot.phoneCountryCode ||
    currentProfileFormValues.phoneCountryOptionId !== savedProfileFormSnapshot.phoneCountryOptionId ||
    currentProfileFormValues.phoneNumber !== savedProfileFormSnapshot.phoneNumber

  const hasProfileImageChanges = profileImagePreview !== savedProfileImagePreview

  const isSaveDisabled =
    (!hasProfileFormChanges && !hasProfileImageChanges) ||
    isSavingProfile ||
    Boolean(photoProcessingMode) ||
    isDeletingAccount ||
    isPreparingDeleteAccountModal

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
    const nextInitialProfileForm = getInitialAccountForm(user)
    const normalizedPhoneCountryCode = String(
      nextInitialProfileForm.phoneCountryCode || '+63'
    ).trim()
    const nextProfileImagePreview = buildApiAssetUrl(user.profilePictureUrl)

    const nextResolvedProfileForm = {
      ...nextInitialProfileForm,
      phoneCountryCode: normalizedPhoneCountryCode,
      phoneCountryOptionId: getCountryOptionIdFromDialCode(normalizedPhoneCountryCode)
    }

    setProfileForm(nextResolvedProfileForm)
    setSavedProfileFormSnapshot(normalizeAccountFormValues(nextResolvedProfileForm))
    setProfileImagePreview(nextProfileImagePreview)
    setSavedProfileImagePreview(nextProfileImagePreview)
  }, [
    user.firstName,
    user.lastName,
    user.fullName,
    user.email,
    user.phoneCountryCode,
    user.phoneNumber,
    user.roleLabel,
    user.profilePictureUrl
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

  useEffect(() => {
    let isMounted = true

    const loadAccountProfile = async () => {
      const authToken = getStoredAuthToken()

      if (!authToken) {
        return
      }

      try {
        const response = await fetch(`${API_URL}/account/me`, {
          method: 'GET',
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${authToken}`
          }
        })

        const data = await response.json().catch(() => ({}))

        if (!response.ok) {
          throw new Error(data.message || 'Unable to load your account details.')
        }

        if (!isMounted || !data.user) {
          return
        }

        const nextResolvedProfileImagePreview = buildApiAssetUrl(data.user.profilePictureUrl)
        const nextResolvedPhoneCountryCode = String(data.user.phoneCountryCode || '+63').trim()

        const nextResolvedProfileForm = {
          firstName: String(data.user.firstName || '').trim(),
          lastName: String(data.user.lastName || '').trim(),
          email: String(data.user.email || '').trim(),
          phoneCountryCode: nextResolvedPhoneCountryCode,
          phoneCountryOptionId: getCountryOptionIdFromDialCode(nextResolvedPhoneCountryCode),
          phoneNumber: String(data.user.phoneNumber || '').trim()
        }

        updateStoredUserProfile({
          ...data.user
        })

        setProfileForm(nextResolvedProfileForm)
        setSavedProfileFormSnapshot(normalizeAccountFormValues(nextResolvedProfileForm))
        setProfileImagePreview(nextResolvedProfileImagePreview)
        setSavedProfileImagePreview(nextResolvedProfileImagePreview)
      } catch (error) {
        console.error('ACCOUNT PROFILE LOAD ERROR:', error)
      }
    }

    loadAccountProfile()

    return () => {
      isMounted = false
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
    performReliableLogout(onLogout)
  }

    const clearAccountFormErrors = () => {
    setFirstNameError('')
    setLastNameError('')
    setEmailError('')
    setPhoneNumberError('')
    setProfileImageError('')
  }

  const applyAccountSaveFieldError = (message = '') => {
    const normalizedMessage = String(message || '').trim().toLowerCase()

    if (!normalizedMessage) {
      return false
    }

    if (normalizedMessage.includes('first name')) {
      setFirstNameError(message)
      return true
    }

    if (normalizedMessage.includes('last name')) {
      setLastNameError(message)
      return true
    }

    if (normalizedMessage.includes('email')) {
      setEmailError(message)
      return true
    }

    if (normalizedMessage.includes('phone') || normalizedMessage.includes('country code')) {
      setPhoneNumberError(message)
      return true
    }

    if (
      normalizedMessage.includes('profile image') ||
      normalizedMessage.includes('profile picture')
    ) {
      setProfileImageError(message)
      return true
    }

    return false
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

        const authToken = getStoredAuthToken()

    if (!authToken) {
      await showAccountSaveResultAlert({
        type: 'error',
        title: 'Save Failed',
        message: 'Your session has expired. Please log in again.'
      })
      return
    }

    const nextSavedProfileFormSnapshot = normalizeAccountFormValues({
      ...profileForm,
      firstName: profileForm.firstName.trim(),
      lastName: profileForm.lastName.trim(),
      email: profileForm.email.trim(),
      phoneCountryOptionId: getCountryOptionIdFromDialCode(profileForm.phoneCountryCode),
      phoneNumber: profileForm.phoneNumber.trim()
    })

    try {
      setProfileForm((prev) => ({
        ...prev,
        firstName: nextSavedProfileFormSnapshot.firstName,
        lastName: nextSavedProfileFormSnapshot.lastName,
        email: nextSavedProfileFormSnapshot.email,
        phoneCountryCode: nextSavedProfileFormSnapshot.phoneCountryCode,
        phoneCountryOptionId: nextSavedProfileFormSnapshot.phoneCountryOptionId,
        phoneNumber: nextSavedProfileFormSnapshot.phoneNumber
      }))

      setIsSavingProfile(true)

      const shouldRemoveProfileImage =
        !profileImagePreview && Boolean(savedProfileImagePreview)

      const nextProfileImageDataUrl = profileImagePreview.startsWith('data:image/')
        ? profileImagePreview
        : ''

      const response = await fetch(`${API_URL}/account/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({
          firstName: nextSavedProfileFormSnapshot.firstName,
          lastName: nextSavedProfileFormSnapshot.lastName,
          email: nextSavedProfileFormSnapshot.email,
          phoneCountryCode: nextSavedProfileFormSnapshot.phoneCountryCode,
          phoneNumber: nextSavedProfileFormSnapshot.phoneNumber,
          profileImageDataUrl: nextProfileImageDataUrl,
          removeProfileImage: shouldRemoveProfileImage
        })
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        const errorMessage =
          data.message || 'Something went wrong while saving your account details. Please try again.'

        if (applyAccountSaveFieldError(errorMessage)) {
          setIsSavingProfile(false)
          return
        }

        throw new Error(errorMessage)
      }

      const nextProfileImageCacheKey = String(Date.now())

      const nextResolvedProfileImagePreview = data.user?.profilePictureUrl
        ? appendImageCacheKey(
            buildApiAssetUrl(data.user?.profilePictureUrl),
            nextProfileImageCacheKey
          )
        : ''

      const nextResolvedProfileForm = {
        firstName: String(data.user?.firstName || '').trim(),
        lastName: String(data.user?.lastName || '').trim(),
        email: String(data.user?.email || '').trim(),
        phoneCountryCode: String(data.user?.phoneCountryCode || '+63').trim(),
        phoneCountryOptionId: getCountryOptionIdFromDialCode(
          String(data.user?.phoneCountryCode || '+63').trim()
        ),
        phoneNumber: String(data.user?.phoneNumber || '').trim()
      }

      setProfileForm(nextResolvedProfileForm)
      setSavedProfileFormSnapshot(normalizeAccountFormValues(nextResolvedProfileForm))
      setProfileImagePreview(nextResolvedProfileImagePreview)
      setSavedProfileImagePreview(nextResolvedProfileImagePreview)

      updateStoredUserProfile({
        ...data.user
      })

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
        message:
          error.message ||
          'Something went wrong while saving your account details. Please try again.'
      })
    }
  }

  const accountInitials = [profileForm.firstName, profileForm.lastName]
    .filter(Boolean)
    .map((value) => String(value).trim().charAt(0).toUpperCase())
    .join('')
    .slice(0, 2) || 'A'

  const sidebarProfileImagePreview =
    savedProfileImagePreview || buildApiAssetUrl(user.profilePictureUrl)

  const sidebarUserInitials = [user.firstName, user.lastName]
    .filter(Boolean)
    .map((value) => String(value).trim().charAt(0).toUpperCase())
    .join('')
    .slice(0, 2) || 'A'

  const hasFirstNameFieldError = Boolean(firstNameError)
  const hasLastNameFieldError = Boolean(lastNameError)
  const hasEmailFieldError = Boolean(emailError)
  const hasPhoneNumberFieldError = Boolean(phoneNumberError)
  const deletePasswordFieldMessage = deletePasswordError || deleteAuthError

  const hasDeletePasswordFieldError = Boolean(deletePasswordFieldMessage)
  const hasDeleteConfirmPasswordFieldError = Boolean(deleteConfirmPasswordError || deleteAuthError)

  const showPhotoProcessingOverlay = [
    'photo-picker-opening',
    'photo-loading',
    'photo-applying',
    'photo-removing'
  ].includes(photoProcessingMode)

  const showPhotoProcessingTitle = [
    'photo-loading',
    'photo-applying',
    'photo-removing'
  ].includes(photoProcessingMode)

  const photoProcessingLabel =
    photoProcessingMode === 'photo-removing'
      ? 'Removing Photo'
      : photoProcessingMode === 'photo-applying'
        ? 'Uploading Photo'
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
              <button
                type="button"
                className="dashboard-sidebar-link"
                data-tooltip="Reports"
                onClick={() => onNavigate('reports')}
              >
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
          <div className="dashboard-page-title-row">
            <h1 className="dashboard-content-title">Account</h1>
          </div>

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
                      <span className="account-button-icon" aria-hidden="true">
                        <PhotoRemoveIcon />
                      </span>
                      <span>Remove</span>
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
                  {!isAdministrator && (
                    <button
                      type="button"
                      className="account-button account-button-secondary"
                      onClick={handleOpenDeleteAccountModal}
                      disabled={isSavingProfile || Boolean(photoProcessingMode) || isDeletingAccount}
                    >
                      <span className="account-button-icon" aria-hidden="true">
                        <TrashIcon />
                      </span>
                      <span>Delete User Account</span>
                    </button>
                  )}

                  <button
                    type="button"
                    className="account-button account-button-primary"
                    onClick={handleSaveProfile}
                    disabled={isSaveDisabled}
                  >
                    <span className="account-button-icon" aria-hidden="true">
                      <SaveIcon />
                    </span>
                    <span>Save</span>
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>
      </section>
      {isPhotoCropModalOpen && (
        <div
          className={`account-photo-modal-overlay ${isPhotoCropModalClosing ? 'account-modal-closing' : ''}`}
          onClick={handleClosePhotoCropModal}
        >
          <div
            className={`account-photo-modal ${isPhotoCropModalClosing ? 'account-modal-closing' : ''}`}
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
      {isDeleteAccountModalOpen && (
        <div
          className={`account-photo-modal-overlay ${isDeleteAccountModalClosing ? 'account-modal-closing' : ''}`}
          onClick={handleCloseDeleteAccountModal}
        >
          <div
            className={`account-photo-modal account-delete-modal ${isDeleteAccountModalClosing ? 'account-modal-closing' : ''}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="account-delete-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="account-photo-modal-close"
              onClick={handleCloseDeleteAccountModal}
              aria-label="Close delete account dialog"
              disabled={isDeletingAccount}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18" />
                <path d="M6 6l12 12" />
              </svg>
            </button>

            <div className="account-photo-modal-header account-delete-modal-header">
              <h2 id="account-delete-modal-title" className="account-photo-modal-title">
                Delete User Account
              </h2>
              <p className="account-photo-modal-text">
                Enter your password and confirm it to continue deleting your account.
              </p>
            </div>

            <form
              className="account-delete-modal-form"
              onSubmit={handleConfirmDeleteAccount}
            >
              <div className="account-field-group">
                <div className={`account-field account-floating-field ${hasDeletePasswordFieldError ? 'account-field-error' : ''}`}>
                  <span className="account-field-icon" aria-hidden="true">
                    <LockIcon />
                  </span>

                  <div className="account-floating-control">
                    <input
                      id="account-delete-password"
                      type={isDeletePasswordVisible ? 'text' : 'password'}
                      className="account-input account-floating-input"
                      placeholder=" "
                      value={deleteAccountForm.password}
                      onChange={handleDeleteAccountInputChange('password')}
                      autoComplete="current-password"
                      autoCapitalize="none"
                      spellCheck={false}
                      aria-invalid={hasDeletePasswordFieldError}
                      disabled={isDeletingAccount}
                    />
                    <label htmlFor="account-delete-password" className="account-floating-label">
                      Password
                    </label>
                  </div>

                  <button
                    type="button"
                    className="account-password-toggle"
                    onClick={() => setIsDeletePasswordVisible((prev) => !prev)}
                    aria-label={isDeletePasswordVisible ? 'Hide password' : 'Show password'}
                    disabled={isDeletingAccount}
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
                      id="account-delete-confirm-password"
                      type={isDeleteConfirmPasswordVisible ? 'text' : 'password'}
                      className="account-input account-floating-input"
                      placeholder=" "
                      value={deleteAccountForm.confirmPassword}
                      onChange={handleDeleteAccountInputChange('confirmPassword')}
                      autoComplete="current-password"
                      autoCapitalize="none"
                      spellCheck={false}
                      aria-invalid={hasDeleteConfirmPasswordFieldError}
                      disabled={isDeletingAccount}
                    />
                    <label htmlFor="account-delete-confirm-password" className="account-floating-label">
                      Confirm Password
                    </label>
                  </div>

                  <button
                    type="button"
                    className="account-password-toggle"
                    onClick={() => setIsDeleteConfirmPasswordVisible((prev) => !prev)}
                    aria-label={isDeleteConfirmPasswordVisible ? 'Hide confirm password' : 'Show confirm password'}
                    disabled={isDeletingAccount}
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
                  onClick={handleCloseDeleteAccountModal}
                  disabled={isDeletingAccount}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="account-button account-button-primary"
                  disabled={isDeletingAccount}
                >
                  {isDeletingAccount ? 'Deleting Account' : 'Delete Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {isPreparingDeleteAccountModal && (
        <div className="account-save-overlay" role="status" aria-live="polite" aria-busy="true">
          <div className="account-save-card account-save-card-compact">
            <img src={logo} alt="Avinya Logo" className="account-save-logo" />
            <div className="account-save-loader" aria-hidden="true">
              <span className="account-save-loader-bar"></span>
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

      {!isDeleteAccountModalOpen && (isDeletingAccount || isDeleteAccountRedirecting) && (
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