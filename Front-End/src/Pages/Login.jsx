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

function Login({ onLoginSuccess, onGoToRegister }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
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

    const trimmedEmail = email.trim()
    const rawPassword = password

    let hasError = false

    if (!trimmedEmail) {
      setEmailError('Please enter your email.')
      hasError = true
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setEmailError('Please enter a valid email address.')
      hasError = true
    }

    if (!rawPassword.trim()) {
      setPasswordError('Please enter your password.')
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
          password: rawPassword
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Invalid email or password. Please try again.')
      }

      sessionStorage.setItem('tbToken', data.token)
      sessionStorage.setItem('tbUser', JSON.stringify(data.user))
      sessionStorage.removeItem('tbRefreshToken')
      sessionStorage.removeItem('avinya-otp-expiry-at')

      onLoginSuccess()
    } catch (error) {
      setAuthError(error.message || 'Invalid email or password. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleRegisterClick = () => {
    if (onGoToRegister) {
      onGoToRegister()
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
                    if (emailError) setEmailError('')
                    if (authError) setAuthError('')
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
                    if (passwordError) setPasswordError('')
                    if (authError) setAuthError('')
                  }}
                  autoComplete="current-password"
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

              {hasPasswordFieldError && (
                <div className="login-error-row">
                  <span className="login-error-icon" aria-hidden="true">
                    <ErrorIcon />
                  </span>
                  <span>{passwordFieldMessage}</span>
                </div>
              )}
            </div>

            <div className="login-options">
              <label className="login-remember">
                <input type="checkbox" className="login-check" />
                <span>Remember Me</span>
              </label>

              <a href="#" className="login-link">
                Forgot Password?
              </a>
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