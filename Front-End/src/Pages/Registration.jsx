import { useEffect, useState } from 'react'
import Swal from 'sweetalert2'
import 'sweetalert2/dist/sweetalert2.min.css'
import logo from '../Pictures/Avinya.png'
import '../Styles/Registration.css'
import {
  UserIcon,
  LockIcon,
  EyeOpenIcon,
  EyeClosedIcon,
  ErrorIcon
} from '../Components/Icons.jsx'

import { API_URL } from '../Config/API'

const NAME_REGEX = /^[A-Za-zÀ-ÖØ-öø-ÿ]+(?:[ '-][A-Za-zÀ-ÖØ-öø-ÿ]+)*$/
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PASSWORD_UPPERCASE_REGEX = /[A-Z]/
const PASSWORD_LOWERCASE_REGEX = /[a-z]/
const PASSWORD_NUMBER_REGEX = /[0-9]/
const PASSWORD_SPECIAL_REGEX = /[^A-Za-z0-9\s]/

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

const getPasswordValidationError = (value, email) => {
  if (!value) {
    return 'Please enter your password.'
  }

  if (value !== value.trim()) {
    return 'Password must not start or end with spaces.'
  }

  if (value.length < 8) {
    return 'Password must be at least 8 characters.'
  }

  if (value.length > 72) {
    return 'Password must not exceed 72 characters.'
  }

  if (!PASSWORD_UPPERCASE_REGEX.test(value)) {
    return 'Password must include at least one uppercase letter.'
  }

  if (!PASSWORD_LOWERCASE_REGEX.test(value)) {
    return 'Password must include at least one lowercase letter.'
  }

  if (!PASSWORD_NUMBER_REGEX.test(value)) {
    return 'Password must include at least one number.'
  }

  if (!PASSWORD_SPECIAL_REGEX.test(value)) {
    return 'Password must include at least one special character.'
  }

  if (email && value.toLowerCase() === email.toLowerCase()) {
    return 'Password must not be the same as your email address.'
  }

  return ''
}

function Registration({ onGoToLogin, onRegistrationSuccess }) {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [registrationError, setRegistrationError] = useState('')

  const [firstNameError, setFirstNameError] = useState('')
  const [lastNameError, setLastNameError] = useState('')
  const [emailError, setEmailError] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [confirmPasswordError, setConfirmPasswordError] = useState('')
  const [privacyError, setPrivacyError] = useState('')

  useEffect(() => {
    document.title = 'Avinya | Registration'
  }, [])

  const handlePrivacyNoticeOpen = async () => {
    await Swal.fire({
      title: 'Data Privacy Act Notice',
      html: `
        <p>
          In accordance with the Data Privacy Act of 2012, the information you provide
          during registration will be collected and used only for account creation,
          account access, and device management within the Avinya system.
        </p>

        <p>
          Your personal data such as your name, email address, and account credentials
          will be handled with appropriate care and will only be accessed by authorized
          processes or personnel when necessary for legitimate system operations.
        </p>

        <p>
          By proceeding with registration, you acknowledge that you have read this
          notice and agree to the collection and processing of your personal information
          for the stated purpose.
        </p>
      `,
      width: '600px',
      showCloseButton: true,
      showConfirmButton: true,
      confirmButtonText: 'Close',
      buttonsStyling: false,
      allowOutsideClick: true,
      allowEscapeKey: true,
      customClass: {
        popup: 'registration-swal-popup',
        title: 'registration-swal-title',
        htmlContainer: 'registration-swal-text',
        actions: 'registration-swal-actions',
        confirmButton: 'registration-swal-confirm',
        closeButton: 'registration-swal-close'
      }
    })
  }

  const clearRegistrationFeedback = () => {
    if (registrationError) setRegistrationError('')
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    setFirstNameError('')
    setLastNameError('')
    setEmailError('')
    setPasswordError('')
    setConfirmPasswordError('')
    setPrivacyError('')
    setRegistrationError('')

    const trimmedFirstName = firstName.trim()
    const trimmedLastName = lastName.trim()
    const trimmedEmail = email.trim()
    const rawPassword = password
    const rawConfirmPassword = confirmPassword

    let hasError = false

    const firstNameValidationError = getNameValidationError(trimmedFirstName, 'First name')
    const lastNameValidationError = getNameValidationError(trimmedLastName, 'Last name')
    const emailValidationError = getEmailValidationError(trimmedEmail)
    const passwordValidationError = getPasswordValidationError(rawPassword, trimmedEmail)

    if (firstNameValidationError) {
      setFirstNameError(firstNameValidationError)
      hasError = true
    }

    if (lastNameValidationError) {
      setLastNameError(lastNameValidationError)
      hasError = true
    }

    if (emailValidationError) {
      setEmailError(emailValidationError)
      hasError = true
    }

    if (passwordValidationError) {
      setPasswordError(passwordValidationError)
      hasError = true
    }

    if (!rawConfirmPassword) {
      setConfirmPasswordError('Please confirm your password.')
      hasError = true
    } else if (rawPassword !== rawConfirmPassword) {
      setConfirmPasswordError('Passwords do not match.')
      hasError = true
    }

    if (!acceptedPrivacy) {
      setPrivacyError('Please agree to the Data Privacy Act notice before creating an account.')
      hasError = true
    }

    if (hasError) {
      return
    }

    try {
      setIsSubmitting(true)

      const response = await fetch(`${API_URL}/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          firstName: trimmedFirstName,
          lastName: trimmedLastName,
          email: trimmedEmail,
          password: rawPassword
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Registration failed.')
      }

      setFirstName('')
      setLastName('')
      setEmail('')
      setPassword('')
      setConfirmPassword('')
      setAcceptedPrivacy(false)

      if (data.otpExpiresAt) {
        sessionStorage.setItem('avinya-otp-expiry-at', data.otpExpiresAt)
      } else {
        sessionStorage.removeItem('avinya-otp-expiry-at')
      }

      if (onRegistrationSuccess) {
        onRegistrationSuccess(trimmedEmail)
      }

    } catch (error) {
      if (error instanceof TypeError || error.message === 'Failed to fetch') {
        setRegistrationError('Unable to connect to the server. Please check your internet connection and try again.')
      } else {
        setRegistrationError(error.message || 'Something went wrong while creating your account. Please try again.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleLoginClick = () => {
    if (onGoToLogin) {
      onGoToLogin()
    }
  }

  const normalizedRegistrationError = registrationError.trim().toLowerCase()

  const hasFirstNameFieldError = Boolean(firstNameError)
  const hasLastNameFieldError = Boolean(lastNameError)
  const hasEmailFieldError = Boolean(
    emailError ||
    normalizedRegistrationError.includes('email') ||
    normalizedRegistrationError.includes('verification')
  )
  const hasPasswordFieldError = Boolean(passwordError)
  const hasConfirmPasswordFieldError = Boolean(confirmPasswordError)

  return (
    <main className="login-page">
      <div className="login-left"></div>

      <section className="login-right">
        <div className="login-right-content">
          <img src={logo} alt="Avinya Logo" className="login-logo img-fluid" />

          <div className="login-text-group">
            <h1 className="login-title">AVINYA</h1>
            <p className="login-text">
              Create your Avinya account to start managing your devices.
            </p>
          </div>

          <form className="login-form" onSubmit={handleSubmit} noValidate>
            <div className="registration-name-row">
              <div className="registration-name-col">
                <div className={`login-field registration-floating-field ${hasFirstNameFieldError ? 'login-field-error' : ''}`}>
                  <span className="login-field-icon" aria-hidden="true">
                    <UserIcon />
                  </span>

                  <div className="registration-floating-control">
                    <input
                      type="text"
                      className="login-input registration-floating-input"
                      placeholder=" "
                      value={firstName}
                      onChange={(e) => {
                        setFirstName(e.target.value)
                        clearRegistrationFeedback()
                        if (firstNameError) setFirstNameError('')
                      }}
                      autoComplete="given-name"
                      aria-label="First Name"
                      aria-invalid={hasFirstNameFieldError}
                    />
                    <span className="registration-floating-label">First Name</span>
                  </div>
                </div>

                {firstNameError && (
                  <div className="login-error-row registration-error-row">
                    <span className="login-error-icon" aria-hidden="true">
                      <ErrorIcon />
                    </span>
                    <span>{firstNameError}</span>
                  </div>
                )}
              </div>

              <div className="registration-name-col">
                <div className={`login-field registration-floating-field ${hasLastNameFieldError ? 'login-field-error' : ''}`}>
                  <span className="login-field-icon" aria-hidden="true">
                    <UserIcon />
                  </span>

                  <div className="registration-floating-control">
                    <input
                      type="text"
                      className="login-input registration-floating-input"
                      placeholder=" "
                      value={lastName}
                      onChange={(e) => {
                        setLastName(e.target.value)
                        clearRegistrationFeedback()
                        if (lastNameError) setLastNameError('')
                      }}
                      autoComplete="family-name"
                      aria-label="Last Name"
                      aria-invalid={hasLastNameFieldError}
                    />
                    <span className="registration-floating-label">Last Name</span>
                  </div>
                </div>

                {lastNameError && (
                  <div className="login-error-row registration-error-row">
                    <span className="login-error-icon" aria-hidden="true">
                      <ErrorIcon />
                    </span>
                    <span>{lastNameError}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="login-field-group">
              <div className={`login-field registration-floating-field ${hasEmailFieldError ? 'login-field-error' : ''}`}>
                <span className="login-field-icon" aria-hidden="true">
                  <UserIcon />
                </span>

                <div className="registration-floating-control">
                  <input
                    type="email"
                    className="login-input registration-floating-input"
                    placeholder=" "
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value)
                      clearRegistrationFeedback()
                      if (emailError) setEmailError('')
                    }}
                    autoComplete="username"
                    aria-label="Email"
                    aria-invalid={hasEmailFieldError}
                  />
                  <span className="registration-floating-label">Email</span>
                </div>
              </div>

              {emailError && (
                <div className="login-error-row registration-error-row">
                  <span className="login-error-icon" aria-hidden="true">
                    <ErrorIcon />
                  </span>
                  <span>{emailError}</span>
                </div>
              )}
            </div>

            <div className="login-field-group">
              <div className={`login-field registration-floating-field ${hasPasswordFieldError ? 'login-field-error' : ''}`}>
                <span className="login-field-icon" aria-hidden="true">
                  <LockIcon />
                </span>

                <div className="registration-floating-control">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="login-input registration-floating-input"
                    placeholder=" "
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value)
                      clearRegistrationFeedback()
                      if (passwordError) setPasswordError('')
                    }}
                    autoComplete="new-password"
                    aria-label="Password"
                    aria-invalid={hasPasswordFieldError}
                  />
                  <span className="registration-floating-label">Password</span>
                </div>

                <button
                  type="button"
                  className="login-field-action"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPassword((prev) => !prev)}
                >
                  {showPassword ? <EyeClosedIcon /> : <EyeOpenIcon />}
                </button>
              </div>

              {passwordError && (
                <div className="login-error-row registration-error-row">
                  <span className="login-error-icon" aria-hidden="true">
                    <ErrorIcon />
                  </span>
                  <span>{passwordError}</span>
                </div>
              )}
            </div>

            <div className="login-field-group">
              <div className={`login-field registration-floating-field ${hasConfirmPasswordFieldError ? 'login-field-error' : ''}`}>
                <span className="login-field-icon" aria-hidden="true">
                  <LockIcon />
                </span>

                <div className="registration-floating-control">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    className="login-input registration-floating-input"
                    placeholder=" "
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value)
                      clearRegistrationFeedback()
                      if (confirmPasswordError) setConfirmPasswordError('')
                    }}
                    autoComplete="new-password"
                    aria-label="Confirm Password"
                    aria-invalid={hasConfirmPasswordFieldError}
                  />
                  <span className="registration-floating-label">Confirm Password</span>
                </div>

                <button
                  type="button"
                  className="login-field-action"
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                >
                  {showConfirmPassword ? <EyeClosedIcon /> : <EyeOpenIcon />}
                </button>
              </div>

              {confirmPasswordError && (
                <div className="login-error-row registration-error-row">
                  <span className="login-error-icon" aria-hidden="true">
                    <ErrorIcon />
                  </span>
                  <span>{confirmPasswordError}</span>
                </div>
              )}
            </div>

            <div className="registration-privacy-group">
              <label className="registration-privacy-label">
                <input
                  type="checkbox"
                  className="login-check"
                  checked={acceptedPrivacy}
                  onChange={(e) => {
                    setAcceptedPrivacy(e.target.checked)
                    clearRegistrationFeedback()
                    if (privacyError) setPrivacyError('')
                  }}
                />
                <span className="registration-privacy-text">
                  I have read and agree to the{' '}
                  <button
                    type="button"
                    className="registration-privacy-link"
                    onClick={(event) => {
                      event.preventDefault()
                      event.stopPropagation()
                      handlePrivacyNoticeOpen()
                    }}
                  >
                    Data Privacy Act Notice
                  </button>
                  .
                </span>
              </label>

              {privacyError && (
                <div className="login-error-row registration-error-row">
                  <span className="login-error-icon" aria-hidden="true">
                    <ErrorIcon />
                  </span>
                  <span>{privacyError}</span>
                </div>
              )}

              {registrationError && (
                <div className="login-error-row registration-error-row">
                  <span className="login-error-icon" aria-hidden="true">
                    <ErrorIcon />
                  </span>
                  <span>{registrationError}</span>
                </div>
              )}
              </div>

            <button
              type="submit"
              className="login-button"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <span className="login-button-loading">
                  <span className="login-spinner"></span>
                  <span>Creating Account</span>
                </span>
              ) : (
                'Create Account'
              )}
            </button>

            <div className="login-register-row">
              <span className="login-register-text">Already have an account?</span>
              <button
                type="button"
                className="login-register-link"
                onClick={handleLoginClick}
              >
                Login
              </button>
            </div>
          </form>

          <div className="login-powered">
            <img src={logo} alt="Avinya Logo" className="login-powered-logo img-fluid" />
            <span>
              Powered by <span className="login-powered-brand">AVINYA</span>
            </span>
          </div>
        </div>
      </section>
    </main>
  )
}

export default Registration