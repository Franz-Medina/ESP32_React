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
} from '../Components/LoginIcons.jsx'

const API_URL = 'http://localhost:5000'

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
    const trimmedPassword = password.trim()
    const trimmedConfirmPassword = confirmPassword.trim()

    let hasError = false

    if (!trimmedFirstName) {
      setFirstNameError('Please enter your first name.')
      hasError = true
    }

    if (!trimmedLastName) {
      setLastNameError('Please enter your last name.')
      hasError = true
    }

    if (!trimmedEmail) {
      setEmailError('Please enter your email.')
      hasError = true
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setEmailError('Please enter a valid email address.')
      hasError = true
    }

    if (!trimmedPassword) {
      setPasswordError('Please enter your password.')
      hasError = true
    }

    if (!trimmedConfirmPassword) {
      setConfirmPasswordError('Please confirm your password.')
      hasError = true
    } else if (trimmedPassword !== trimmedConfirmPassword) {
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
          password: trimmedPassword
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
      setRegistrationError(error.message || 'Registration failed. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleLoginClick = () => {
    if (onGoToLogin) {
      onGoToLogin()
    }
  }

  const hasFirstNameFieldError = Boolean(firstNameError || registrationError)
  const hasLastNameFieldError = Boolean(lastNameError || registrationError)
  const hasEmailFieldError = Boolean(emailError || registrationError)
  const hasPasswordFieldError = Boolean(passwordError || registrationError)
  const hasConfirmPasswordFieldError = Boolean(confirmPasswordError || registrationError)

  return (
    <main className="login-page">
      <div className="login-left"></div>

      <section className="login-right">
        <div className="login-right-content">
          <img src={logo} alt="Avinya Logo" className="login-logo img-fluid" />

          <div className="login-text-group">
            <h1 className="login-title">AVINYA</h1>
            <p className="login-text">
              Create your Avinya account to start managing your ThingsBoard devices.
            </p>
          </div>

          <form className="login-form" onSubmit={handleSubmit} noValidate>
            <div className="registration-name-row">
              <div className="registration-name-col">
                <div className={`login-field ${hasFirstNameFieldError ? 'login-field-error' : ''}`}>
                  <span className="login-field-icon" aria-hidden="true">
                    <UserIcon />
                  </span>

                  <input
                    type="text"
                    className="login-input"
                    placeholder="First Name"
                    value={firstName}
                    onChange={(e) => {
                      setFirstName(e.target.value)
                      clearRegistrationFeedback()
                      if (firstNameError) setFirstNameError('')
                    }}
                    autoComplete="given-name"
                    aria-invalid={hasFirstNameFieldError}
                  />
                </div>

                {firstNameError && (
                  <div className="login-error-row">
                    <span className="login-error-icon" aria-hidden="true">
                      <ErrorIcon />
                    </span>
                    <span>{firstNameError}</span>
                  </div>
                )}
              </div>

              <div className="registration-name-col">
                <div className={`login-field ${hasLastNameFieldError ? 'login-field-error' : ''}`}>
                  <span className="login-field-icon" aria-hidden="true">
                    <UserIcon />
                  </span>

                  <input
                    type="text"
                    className="login-input"
                    placeholder="Last Name"
                    value={lastName}
                    onChange={(e) => {
                      setLastName(e.target.value)
                      clearRegistrationFeedback()
                      if (lastNameError) setLastNameError('')
                    }}
                    autoComplete="family-name"
                    aria-invalid={hasLastNameFieldError}
                  />
                </div>

                {lastNameError && (
                  <div className="login-error-row">
                    <span className="login-error-icon" aria-hidden="true">
                      <ErrorIcon />
                    </span>
                    <span>{lastNameError}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="login-field-group">
              <div className={`login-field ${hasEmailFieldError ? 'login-field-error' : ''}`}>
                <span className="login-field-icon" aria-hidden="true">
                  <UserIcon />
                </span>

                <input
                  type="email"
                  className="login-input"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    clearRegistrationFeedback()
                    if (emailError) setEmailError('')
                  }}
                  autoComplete="username"
                  aria-invalid={hasEmailFieldError}
                />
              </div>

              {emailError && (
                <div className="login-error-row">
                  <span className="login-error-icon" aria-hidden="true">
                    <ErrorIcon />
                  </span>
                  <span>{emailError}</span>
                </div>
              )}
            </div>

            <div className="login-field-group">
              <div className={`login-field ${hasPasswordFieldError ? 'login-field-error' : ''}`}>
                <span className="login-field-icon" aria-hidden="true">
                  <LockIcon />
                </span>

                <input
                  type={showPassword ? 'text' : 'password'}
                  className="login-input"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    clearRegistrationFeedback()
                    if (passwordError) setPasswordError('')
                  }}
                  autoComplete="new-password"
                  aria-invalid={hasPasswordFieldError}
                />

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
                <div className="login-error-row">
                  <span className="login-error-icon" aria-hidden="true">
                    <ErrorIcon />
                  </span>
                  <span>{passwordError}</span>
                </div>
              )}
            </div>

            <div className="login-field-group">
              <div className={`login-field ${hasConfirmPasswordFieldError ? 'login-field-error' : ''}`}>
                <span className="login-field-icon" aria-hidden="true">
                  <LockIcon />
                </span>

                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  className="login-input"
                  placeholder="Confirm Password"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value)
                    clearRegistrationFeedback()
                    if (confirmPasswordError) setConfirmPasswordError('')
                  }}
                  autoComplete="new-password"
                  aria-invalid={hasConfirmPasswordFieldError}
                />

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
                <div className="login-error-row">
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
                <div className="login-error-row">
                  <span className="login-error-icon" aria-hidden="true">
                    <ErrorIcon />
                  </span>
                  <span>{privacyError}</span>
                </div>
              )}

              {registrationError && (
                <div className="login-error-row">
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