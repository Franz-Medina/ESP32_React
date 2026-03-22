import { useEffect, useState } from 'react'
import logo from '../Pictures/Avinya.png'
import '../Styles/Login.css'
import {
  UserIcon,
  LockIcon,
  EyeOpenIcon,
  EyeClosedIcon,
  ErrorIcon
} from '../Components/LoginIcons.jsx'

const API_URL = 'http://localhost:5000'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const getLoginEmailValidationError = (value) => {
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

const getLoginPasswordValidationError = (value) => {
  if (!value) {
    return 'Please enter your password.'
  }

  if (value !== value.trim()) {
    return 'Password must not start or end with spaces.'
  }

  return ''
}

function Login({ onLoginSuccess, onGoToRegister, onGoToForgotPassword }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(
    () => localStorage.getItem('avinya-remember-me') === 'true'
  )
  const [loading, setLoading] = useState(false)
  const [emailError, setEmailError] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [authError, setAuthError] = useState('')

  useEffect(() => {
    document.title = 'Avinya | Login'
  }, [])

  const handleSubmit = async (event) => {
    event.preventDefault()

    setEmailError('')
    setPasswordError('')
    setAuthError('')

    const rawEmail = email
    const trimmedEmail = email.trim()
    const rawPassword = password

    const emailValidationError = getLoginEmailValidationError(rawEmail)
    const passwordValidationError = getLoginPasswordValidationError(rawPassword)

    let hasError = false

    if (emailValidationError) {
      setEmailError(emailValidationError)
      hasError = true
    }

    if (passwordValidationError) {
      setPasswordError(passwordValidationError)
      hasError = true
    }

    if (hasError) {
      return
    }

    try {
      setLoading(true)

      const response = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: trimmedEmail,
          password: rawPassword,
          rememberMe
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Something went wrong while logging in. Please try again.')
      }

      const targetStorage = rememberMe ? localStorage : sessionStorage
      const otherStorage = rememberMe ? sessionStorage : localStorage

      otherStorage.removeItem('tbToken')
      otherStorage.removeItem('tbUser')
      otherStorage.removeItem('tbRefreshToken')
      otherStorage.removeItem('avinya-current-page')

      targetStorage.setItem('tbToken', data.token)
      targetStorage.setItem('tbUser', JSON.stringify(data.user))
      targetStorage.removeItem('tbRefreshToken')

      localStorage.setItem('avinya-remember-me', rememberMe ? 'true' : 'false')
      sessionStorage.removeItem('avinya-otp-expiry-at')

      onLoginSuccess()
    } catch (error) {
      if (error instanceof TypeError || error.message === 'Failed to fetch') {
        setAuthError('Unable to connect to the server. Please check your internet connection and try again.')
      } else {
        setAuthError(error.message || 'Something went wrong while logging in. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleRegisterClick = () => {
    if (onGoToRegister) {
      onGoToRegister()
    }
  }

  const handleForgotPasswordClick = () => {
    if (onGoToForgotPassword) {
      onGoToForgotPassword()
    }
  }

  const hasEmailFieldError = Boolean(emailError || authError)
  const passwordFieldMessage = passwordError || authError
  const hasPasswordFieldError = Boolean(passwordFieldMessage)

  return (
    <main className="login-page">
      <div className="login-left"></div>

      <section className="login-right">
        <div className="login-right-content">
          <img src={logo} alt="Avinya Logo" className="login-logo img-fluid" />

          <div className="login-text-group">
            <h1 className="login-title">AVINYA</h1>
            <p className="login-text">
              Login to your Avinya account to continue managing your ThingsBoard devices.
            </p>
          </div>

          <form className="login-form" onSubmit={handleSubmit} noValidate>
            <div className="login-field-group">
              <div className={`login-field login-floating-field ${hasEmailFieldError ? 'login-field-error' : ''}`}>
                <span className="login-field-icon" aria-hidden="true">
                  <UserIcon />
                </span>

                <div className="login-floating-control">
                  <input
                    id="login-email"
                    type="email"
                    className="login-input login-floating-input"
                    placeholder=" "
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value)
                      if (emailError) setEmailError('')
                      if (authError) setAuthError('')
                    }}
                    autoComplete="username"
                    aria-invalid={hasEmailFieldError}
                  />
                  <label htmlFor="login-email" className="login-floating-label">
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
            </div>

            <div className="login-field-group">
              <div className={`login-field login-floating-field ${hasPasswordFieldError ? 'login-field-error' : ''}`}>
                <span className="login-field-icon" aria-hidden="true">
                  <LockIcon />
                </span>

                <div className="login-floating-control">
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    className="login-input login-floating-input"
                    placeholder=" "
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value)
                      if (passwordError) setPasswordError('')
                      if (authError) setAuthError('')
                    }}
                    autoComplete="current-password"
                    aria-invalid={hasPasswordFieldError}
                  />
                  <label htmlFor="login-password" className="login-floating-label">
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

              {hasPasswordFieldError && (
                <div className="login-error-row login-error-row-animated">
                  <span className="login-error-icon" aria-hidden="true">
                    <ErrorIcon />
                  </span>
                  <span>{passwordFieldMessage}</span>
                </div>
              )}
            </div>

            <div className="login-options">
              <label className="login-remember">
                <input
                  type="checkbox"
                  className="login-check"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                <span>Remember Me</span>
              </label>

              <button
                type="button"
                className="login-link login-link-button"
                onClick={handleForgotPasswordClick}
              >
                Forgot Password?
              </button>
            </div>

            <button type="submit" className="login-button" disabled={loading}>
              {loading ? (
                <span className="login-button-loading">
                  <span className="login-spinner"></span>
                  <span>Logging In</span>
                </span>
              ) : (
                'Login'
              )}
            </button>

            <div className="login-register-row">
              <span className="login-register-text">Don’t have an account?</span>
              <button
                type="button"
                className="login-register-link"
                onClick={handleRegisterClick}
              >
                Register
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

export default Login