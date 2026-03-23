import { useEffect, useState } from 'react'
import Swal from 'sweetalert2'
import 'sweetalert2/dist/sweetalert2.min.css'
import logo from '../Pictures/Avinya.png'
import '../Styles/CreateNewPassword.css'
import {
  LockIcon,
  EyeOpenIcon,
  EyeClosedIcon,
  ErrorIcon
} from '../Components/LoginIcons.jsx'

import { API_URL } from '../Config/API'

const PASSWORD_UPPERCASE_REGEX = /[A-Z]/
const PASSWORD_LOWERCASE_REGEX = /[a-z]/
const PASSWORD_NUMBER_REGEX = /[0-9]/
const PASSWORD_SPECIAL_REGEX = /[^A-Za-z0-9\s]/

const getPasswordValidationError = (value) => {
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

  return ''
}

function CreateNewPassword({ resetToken, onGoToLogin }) {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  const [confirmPasswordError, setConfirmPasswordError] = useState('')
  const [formError, setFormError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isCheckingToken, setIsCheckingToken] = useState(true)
  const [isTokenValid, setIsTokenValid] = useState(false)

  useEffect(() => {
    document.title = 'Avinya | Create New Password'
  }, [])

  const showInvalidResetLinkAlert = async (message) => {
    await Swal.fire({
      html: `
        <div class="auth-swal-card">
          <div class="auth-swal-symbol auth-swal-symbol-error" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M15 9l-6 6" />
              <path d="m9 9 6 6" />
            </svg>
          </div>

          <h2 class="auth-swal-heading">Reset Link Unavailable</h2>

          <p class="auth-swal-message">
            ${message}
          </p>
        </div>
      `,
      timer: 5000,
      showConfirmButton: false,
      showCancelButton: false,
      showCloseButton: false,
      buttonsStyling: false,
      allowOutsideClick: false,
      allowEscapeKey: false,
      customClass: {
        popup: 'auth-swal-popup',
        htmlContainer: 'auth-swal-html'
      }
    })

    if (onGoToLogin) {
      onGoToLogin()
    }
  }

  useEffect(() => {
    let isMounted = true

    const validateResetToken = async () => {
      if (!resetToken) {
        await showInvalidResetLinkAlert(
          'This reset link is invalid, expired, or is no longer the latest request. Please request a new one.'
        )
        return
      }

      try {
        setIsCheckingToken(true)

        const response = await fetch(`${API_URL}/password-reset/validate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            token: resetToken
          })
        })

        const data = await response.json()

        if (!response.ok) {
          throw new Error(
            data.message || 'This reset link is invalid, expired, or is no longer the latest request. Please request a new one.'
          )
        }

        if (isMounted) {
          setIsTokenValid(true)
        }
      } catch (error) {
        if (isMounted) {
          setIsTokenValid(false)
        }

        await showInvalidResetLinkAlert(
          error.message || 'This reset link is invalid, expired, or is no longer the latest request. Please request a new one.'
        )
      } finally {
        if (isMounted) {
          setIsCheckingToken(false)
        }
      }
    }

    validateResetToken()

    return () => {
      isMounted = false
    }
  }, [resetToken])

  const handleSubmit = async (event) => {
    event.preventDefault()

    setPasswordError('')
    setConfirmPasswordError('')
    setFormError('')

    const rawPassword = password
    const rawConfirmPassword = confirmPassword
    const passwordValidationError = getPasswordValidationError(rawPassword)

    let hasError = false

    if (!resetToken || !isTokenValid) {
      await showInvalidResetLinkAlert(
        'This reset link is invalid, expired, or is no longer the latest request. Please request a new one.'
      )
      return
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

    if (hasError) {
      return
    }

    try {
      setIsSubmitting(true)

      const response = await fetch(`${API_URL}/password-reset/confirm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          token: resetToken,
          password: rawPassword
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Something went wrong while updating your password. Please try again.')
      }

      setPassword('')
      setConfirmPassword('')

      if (onGoToLogin) {
        onGoToLogin()
      }
    } catch (error) {
      if (error instanceof TypeError || error.message === 'Failed to fetch') {
        setFormError('Unable to connect to the server. Please check your internet connection and try again.')
      } else {
        setFormError(error.message || 'Something went wrong while updating your password. Please try again.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const hasPasswordFieldError = Boolean(passwordError || formError)
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
              Create a new password for your Avinya account to continue securely.
            </p>
          </div>

          <p className="create-password-helper-text">
            Use a strong password with uppercase, lowercase, number, and special character.
          </p>

          <form className="login-form" onSubmit={handleSubmit} noValidate>
            <div className="login-field-group">
              <div className={`login-field login-floating-field ${hasPasswordFieldError ? 'login-field-error' : ''}`}>
                <span className="login-field-icon" aria-hidden="true">
                  <LockIcon />
                </span>

                <div className="login-floating-control">
                  <input
                    id="create-password"
                    type={showPassword ? 'text' : 'password'}
                    className="login-input login-floating-input"
                    placeholder=" "
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value)
                      if (passwordError) setPasswordError('')
                      if (formError) setFormError('')
                    }}
                    autoComplete="new-password"
                    aria-invalid={hasPasswordFieldError}
                  />
                  <label htmlFor="create-password" className="login-floating-label">
                    Password
                  </label>
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
                <div className="login-error-row login-error-row-animated">
                  <span className="login-error-icon" aria-hidden="true">
                    <ErrorIcon />
                  </span>
                  <span>{passwordError}</span>
                </div>
              )}

              {formError && (
                <div className="login-error-row login-error-row-animated">
                  <span className="login-error-icon" aria-hidden="true">
                    <ErrorIcon />
                  </span>
                  <span>{formError}</span>
                </div>
              )}
            </div>

            <div className="login-field-group">
              <div className={`login-field login-floating-field ${hasConfirmPasswordFieldError ? 'login-field-error' : ''}`}>
                <span className="login-field-icon" aria-hidden="true">
                  <LockIcon />
                </span>

                <div className="login-floating-control">
                  <input
                    id="create-confirm-password"
                    type={showConfirmPassword ? 'text' : 'password'}
                    className="login-input login-floating-input"
                    placeholder=" "
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value)
                      if (confirmPasswordError) setConfirmPasswordError('')
                    }}
                    autoComplete="new-password"
                    aria-invalid={hasConfirmPasswordFieldError}
                  />
                  <label htmlFor="create-confirm-password" className="login-floating-label">
                    Confirm Password
                  </label>
                </div>

                <button
                  type="button"
                  className="login-field-action"
                  aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                >
                  {showConfirmPassword ? <EyeClosedIcon /> : <EyeOpenIcon />}
                </button>
              </div>

              {confirmPasswordError && (
                <div className="login-error-row login-error-row-animated">
                  <span className="login-error-icon" aria-hidden="true">
                    <ErrorIcon />
                  </span>
                  <span>{confirmPasswordError}</span>
                </div>
              )}
            </div>

            <button
              type="submit"
              className="login-button"
              disabled={isSubmitting || isCheckingToken || !isTokenValid}
            >
              {isCheckingToken ? (
                <span className="login-button-loading">
                  <span className="login-spinner"></span>
                  <span>Checking Link</span>
                </span>
              ) : isSubmitting ? (
                <span className="login-button-loading">
                  <span className="login-spinner"></span>
                  <span>Updating Password</span>
                </span>
              ) : (
                'Update Password'
              )}
            </button>

            <div className="login-register-row">
              <span className="login-register-text">Want to go back?</span>
              <button
                type="button"
                className="login-register-link"
                onClick={onGoToLogin}
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

export default CreateNewPassword