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

const API_URL = "http://localhost:5000";

function Login({ onLoginSuccess }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [emailError, setEmailError] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [authError, setAuthError] = useState('')

  const [showRegisterModal, setShowRegisterModal] = useState(false)
  const [isClosing, setIsClosing] = useState(false)
  const [regEmail, setRegEmail] = useState('')
  const [regPassword, setRegPassword] = useState('')
  const [showRegPassword, setShowRegPassword] = useState(false)
  const [regLoading, setRegLoading] = useState(false)
  const [regError, setRegError] = useState('')

  useEffect(() => {
    document.title = 'Avinya | Login'
  }, [])

  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape' && showRegisterModal && !isClosing) {
        closeModal()
      }
    }
    if (showRegisterModal) {
      window.addEventListener('keydown', handleEsc)
    }
    return () => window.removeEventListener('keydown', handleEsc)
  }, [showRegisterModal, isClosing])

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

      // 🔐 Backend login first
      const res = await fetch(`${API_URL}/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: trimmedEmail,
          password: rawPassword,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Login failed");
      }

      console.log("Backend login success:", data);

      // 🔗 ThingsBoard login
      const authData = await loginToThingsBoard(trimmedEmail, rawPassword)

      sessionStorage.setItem('tbToken', authData.token)
      sessionStorage.setItem('tbRefreshToken', authData.refreshToken)

      const user = await getCurrentThingsBoardUser(authData.token)
      sessionStorage.setItem('tbUser', JSON.stringify(user))

      onLoginSuccess()
    } catch (err) {
      console.error(err)
      setAuthError('Invalid email or password. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const openRegisterModal = () => {
    setShowRegisterModal(true)
    setIsClosing(false)
    setRegEmail('')
    setRegPassword('')
    setRegError('')
    setShowRegPassword(false)
  }

  const closeModal = () => {
    setIsClosing(true)
    setTimeout(() => {
      setShowRegisterModal(false)
      setIsClosing(false)
      setRegEmail('')
      setRegPassword('')
      setRegError('')
      setShowRegPassword(false)
    }, 350)
  }

  const handleRegister = async (event) => {
    event.preventDefault()
    setRegError('')

    const trimmedRegEmail = regEmail.trim()
    const rawRegPassword = regPassword

    if (!trimmedRegEmail) {
      setRegError('Please enter your email.')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedRegEmail)) {
      setRegError('Please enter a valid email address.')
      return
    }
    if (!rawRegPassword.trim()) {
      setRegError('Please enter your password.')
      return
    }

    try {
      setRegLoading(true)

      const res = await fetch(`${API_URL}/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: trimmedRegEmail,
          password: rawRegPassword,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Registration failed");
      }

      console.log("Registered user:", data);

      alert("Account created successfully!")

      closeModal()
    } catch (err) {
      console.error(err)
      setRegError("Registration failed. Try a different email.")
    } finally {
      setRegLoading(false)
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

            <button
              type="button"
              className="login-button"
              onClick={openRegisterModal}
              disabled={loading}
            >
              Register
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

      {showRegisterModal && (
        <div
          className={`modal-overlay ${isClosing ? 'modal-closing' : 'modal-open'}`}
          onClick={closeModal}
        >
          <div
            className={`modal-content ${isClosing ? 'modal-closing' : 'modal-open'}`}
            onClick={(e) => e.stopPropagation()}
          >
           
            <img src={logo} alt="Avinya Logo" className="login-logo img-fluid modal-logo" />

            <div className="login-text-group">
              <h2 className="login-title">Create Account</h2>
              <p className="login-text">
                Join Avinya and start managing your ThingsBoard devices.
              </p>
            </div>

            <form className="modal-form" onSubmit={handleRegister} noValidate>
              <div className="login-field-group">
                <div className={`login-field ${regError ? 'login-field-error' : ''}`}>
                  <span className="login-field-icon" aria-hidden="true">
                    <UserIcon />
                  </span>
                  <input
                    type="email"
                    className="login-input"
                    placeholder="Email"
                    value={regEmail}
                    onChange={(e) => {
                      setRegEmail(e.target.value)
                      if (regError) setRegError('')
                    }}
                    autoComplete="username"
                  />
                </div>
              </div>

              <div className="login-field-group">
                <div className={`login-field ${regError ? 'login-field-error' : ''}`}>
                  <span className="login-field-icon" aria-hidden="true">
                    <LockIcon />
                  </span>
                  <input
                    type={showRegPassword ? 'text' : 'password'}
                    className="login-input"
                    placeholder="Password"
                    value={regPassword}
                    onChange={(e) => {
                      setRegPassword(e.target.value)
                      if (regError) setRegError('')
                    }}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className="login-field-action"
                    aria-label={showRegPassword ? 'Hide password' : 'Show password'}
                    onClick={() => setShowRegPassword((prev) => !prev)}
                  >
                    {showRegPassword ? <EyeClosedIcon /> : <EyeOpenIcon />}
                  </button>
                </div>
              </div>

              {regError && (
                <div className="login-error-row">
                  <span className="login-error-icon" aria-hidden="true">
                    <ErrorIcon />
                  </span>
                  <span>{regError}</span>
                </div>
              )}

              <button
                type="submit"
                className="login-button"
                disabled={regLoading}
              >
                {regLoading ? (
                  <span className="login-button-loading">
                    <span className="login-spinner"></span>
                    <span>Creating Account</span>
                  </span>
                ) : (
                  'Create Account'
                )}
              </button>

              <button
                type="button"
                className="login-button"
                style={{ backgroundColor: '#6b7280', marginTop: '0.5rem' }}
                onClick={closeModal}
              >
                Cancel
              </button>
            </form>
          </div>
        </div>
      )}
    </main>
  )
}

export default Login