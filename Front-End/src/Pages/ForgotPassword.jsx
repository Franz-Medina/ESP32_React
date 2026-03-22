import { useEffect, useState } from 'react'
import Swal from 'sweetalert2'
import 'sweetalert2/dist/sweetalert2.min.css'
import logo from '../Pictures/Avinya.png'
import '../Styles/ForgotPassword.css'
import { UserIcon, ErrorIcon } from '../Components/LoginIcons.jsx'

const API_URL = 'http://localhost:5000'
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

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

function ForgotPassword({ onGoToLogin }) {
  const [email, setEmail] = useState('')
  const [emailError, setEmailError] = useState('')
  const [requestError, setRequestError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    document.title = 'Avinya | Forgot Password'
  }, [])

  const handleSubmit = async (event) => {
    event.preventDefault()

    setEmailError('')
    setRequestError('')

    const rawEmail = email
    const trimmedEmail = email.trim()
    const emailValidationError = getEmailValidationError(rawEmail)

    if (emailValidationError) {
      setEmailError(emailValidationError)
      return
    }

    try {
      setIsSubmitting(true)

      const response = await fetch(`${API_URL}/password-reset/request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: trimmedEmail
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Something went wrong while sending the reset link. Please try again.')
      }

      await Swal.fire({
        html: `
          <div class="auth-swal-card">
            <div class="auth-swal-symbol auth-swal-symbol-success" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </div>

            <h2 class="auth-swal-heading">Reset Link Sent</h2>

            <p class="auth-swal-message">
              A password reset link has been sent to your email address.
            </p>
          </div>
        `,
        timer: 5000,
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
    } catch (error) {
      if (error instanceof TypeError || error.message === 'Failed to fetch') {
        setRequestError('Unable to connect to the server. Please check your internet connection and try again.')
      } else {
        setRequestError(error.message || 'Something went wrong while sending the reset link. Please try again.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="login-page">
      <div className="login-left"></div>

      <section className="login-right">
        <div className="login-right-content">
          <img src={logo} alt="Avinya Logo" className="login-logo img-fluid" />

          <div className="login-text-group">
            <h1 className="login-title">AVINYA</h1>
            <p className="login-text">
              Enter your email address and we will send you a link to create a new password.
            </p>
          </div>

          <p className="forgot-password-helper-text">
            Use the same email address linked to your Avinya account.
          </p>

          <form className="login-form" onSubmit={handleSubmit} noValidate>
            <div className="login-field-group">
              <div className={`login-field login-floating-field ${emailError || requestError ? 'login-field-error' : ''}`}>
                <span className="login-field-icon" aria-hidden="true">
                  <UserIcon />
                </span>

                <div className="login-floating-control">
                  <input
                    id="forgot-password-email"
                    type="email"
                    className="login-input login-floating-input"
                    placeholder=" "
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value)
                      if (emailError) setEmailError('')
                      if (requestError) setRequestError('')
                    }}
                    autoComplete="username"
                    aria-invalid={Boolean(emailError || requestError)}
                  />
                  <label htmlFor="forgot-password-email" className="login-floating-label">
                    Email
                  </label>
                </div>
              </div>

              {emailError && (
                <div className="login-error-row login-error-row-animated">
                  <span className="login-error-icon" aria-hidden="true">
                    <ErrorIcon />
                  </span>
                  <span>{emailError}</span>
                </div>
              )}

              {requestError && (
                <div className="login-error-row login-error-row-animated">
                  <span className="login-error-icon" aria-hidden="true">
                    <ErrorIcon />
                  </span>
                  <span>{requestError}</span>
                </div>
              )}
            </div>

            <button type="submit" className="login-button" disabled={isSubmitting}>
              {isSubmitting ? (
                <span className="login-button-loading">
                  <span className="login-spinner"></span>
                  <span>Sending Link</span>
                </span>
              ) : (
                'Send Reset Link'
              )}
            </button>

            <div className="login-register-row">
              <span className="login-register-text">Remembered your password?</span>
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

export default ForgotPassword