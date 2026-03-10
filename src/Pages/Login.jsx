import { useState } from 'react'
import logo from '../Pictures/Avinya.png'
import '../Styles/Login.css'
import {
  loginToThingsBoard,
  getCurrentThingsBoardUser
} from '../Services/ThingsBoardAuth.js'

function Login({ onLoginSuccess }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [emailError, setEmailError] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [authError, setAuthError] = useState('')

  const handleSubmit = async (event) => {
    event.preventDefault()

    setEmailError('')
    setPasswordError('')
    setAuthError('')

    let hasError = false

    if (!email.trim()) {
      setEmailError('Please enter your email.')
      hasError = true
    }

    if (!password.trim()) {
      setPasswordError('Please enter your password.')
      hasError = true
    }

    if (hasError) {
      return
    }

    try {
      setLoading(true)

      const authData = await loginToThingsBoard(email.trim(), password)

      sessionStorage.setItem('tbToken', authData.token)
      sessionStorage.setItem('tbRefreshToken', authData.refreshToken)

      const user = await getCurrentThingsBoardUser(authData.token)
      sessionStorage.setItem('tbUser', JSON.stringify(user))

      onLoginSuccess()
    } catch (err) {
      setAuthError('Invalid email or password. Please try again.')
    } finally {
      setLoading(false)
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
              Please provide your ThingsBoard login details to securely access your account.
            </p>
          </div>

          <form className="login-form" onSubmit={handleSubmit}>
            <div className="login-field-group">
              <div className={`login-field ${emailError ? 'login-field-error' : ''}`}>
                <span className="login-field-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 21a8 8 0 0 0-16 0"></path>
                    <circle cx="12" cy="8" r="4"></circle>
                  </svg>
                </span>

                <input
                  type="text"
                  className="login-input"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="username"
                />
              </div>

              {emailError && (
                <div className="login-error-row">
                  <span className="login-error-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm1 15h-2v-2h2Zm0-4h-2V7h2Z"></path>
                    </svg>
                  </span>
                  <span>{emailError}</span>
                </div>
              )}
            </div>

            <div className="login-field-group">
              <div className={`login-field ${passwordError || authError ? 'login-field-error' : ''}`}>
                <span className="login-field-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="5" y="11" width="14" height="10" rx="2"></rect>
                    <path d="M8 11V8a4 4 0 1 1 8 0v3"></path>
                  </svg>
                </span>

                <input
                  type={showPassword ? 'text' : 'password'}
                  className="login-input"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />

                <button
                  type="button"
                  className="login-field-action"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 3l18 18"></path>
                      <path d="M10.58 10.58a2 2 0 1 0 2.83 2.83"></path>
                      <path d="M9.88 5.09A9.77 9.77 0 0 1 12 5c7 0 11 7 11 7a19.08 19.08 0 0 1-3.04 3.81"></path>
                      <path d="M6.71 6.72C3.61 8.41 1 12 1 12a18.7 18.7 0 0 0 5.12 5.11"></path>
                      <path d="M14.12 14.12A3 3 0 0 1 9.88 9.88"></path>
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"></path>
                      <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                  )}
                </button>
              </div>

              {(passwordError || authError) && (
                <div className="login-error-row">
                  <span className="login-error-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm1 15h-2v-2h2Zm0-4h-2V7h2Z"></path>
                    </svg>
                  </span>
                  <span>{passwordError || authError}</span>
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
                  <span>Signing in...</span>
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