import { useEffect, useState } from 'react'
import logo from '../Pictures/Avinya.png'
import '../Styles/Login.css'
import {
  loginToThingsBoard,
  getCurrentThingsBoardUser
} from '../Services/ThingsBoardAuth.js'
import {
  UserIcon,
  LockIcon,
  EyeOpenIcon,
  EyeClosedIcon,
  ErrorIcon
} from '../Components/LoginIcons.jsx'

function Login({ onLoginSuccess }) {
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

      const authData = await loginToThingsBoard(trimmedEmail, rawPassword)

      sessionStorage.setItem('tbToken', authData.token)
      sessionStorage.setItem('tbRefreshToken', authData.refreshToken)

      const user = await getCurrentThingsBoardUser(authData.token)
      sessionStorage.setItem('tbUser', JSON.stringify(user))

      onLoginSuccess()
    } catch {
      setAuthError('Invalid email or password. Please try again.')
    } finally {
      setLoading(false)
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
              Please provide your ThingsBoard login details to securely access your account.
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