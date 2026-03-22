import { useEffect, useRef, useState } from 'react'
import Login from './Pages/Login.jsx'
import Registration from './Pages/Registration.jsx'
import OTPVerification from './Pages/OTPVerification.jsx'
import ForgotPassword from './Pages/ForgotPassword.jsx'
import CreateNewPassword from './Pages/CreateNewPassword.jsx'
import Dashboard from './Pages/Dashboard.jsx'
import Devices from './Pages/Devices.jsx'
import Users from './Pages/Users.jsx'
import Logs from './Pages/Logs.jsx'
import Account from './Pages/Account.jsx'
import logo from './Pictures/Avinya.png'
import './Styles/App.css'

const AUTH_PAGE_KEYS = new Set([
  'login',
  'register',
  'otp-verification',
  'forgot-password',
  'create-new-password'
])

const getStoredToken = () =>
  sessionStorage.getItem('tbToken') || localStorage.getItem('tbToken')

const getStoredPage = () =>
  sessionStorage.getItem('avinya-current-page') || localStorage.getItem('avinya-current-page')

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(
    () => !!getStoredToken()
  )
  const [currentPage, setCurrentPage] = useState(() => {
    const storedPage = getStoredPage()
    const hasStoredToken = !!getStoredToken()

    if (hasStoredToken) {
      return storedPage && !AUTH_PAGE_KEYS.has(storedPage) ? storedPage : 'dashboard'
    }

    return storedPage || 'login'
  })
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState(
    () => sessionStorage.getItem('avinya-pending-verification-email') || ''
  )
  const [pendingResetToken, setPendingResetToken] = useState(
    () => sessionStorage.getItem('avinya-reset-token') || ''
  )
  const [isSwitching, setIsSwitching] = useState(true)
  const [isDarkMode, setIsDarkMode] = useState(
    () => localStorage.getItem('avinya-theme') === 'dark'
  )

  const authSwitchTimeoutRef = useRef(null)
  const transitionEndTimeoutRef = useRef(null)

  useEffect(() => {
    const theme = isDarkMode ? 'dark' : 'light'
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('avinya-theme', theme)
  }, [isDarkMode])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const page = params.get('page')
    const token = params.get('token')

    if (page === 'create-new-password' && token) {
      sessionStorage.removeItem('tbToken')
      sessionStorage.removeItem('tbUser')
      sessionStorage.removeItem('tbRefreshToken')
      sessionStorage.removeItem('avinya-current-page')
      sessionStorage.removeItem('avinya-pending-verification-email')

      localStorage.removeItem('tbToken')
      localStorage.removeItem('tbUser')
      localStorage.removeItem('tbRefreshToken')
      localStorage.removeItem('avinya-current-page')

      setIsAuthenticated(false)
      setPendingVerificationEmail('')
      setPendingResetToken(token)
      setCurrentPage('create-new-password')

      window.history.replaceState({}, document.title, window.location.pathname)
    }
  }, [])

  useEffect(() => {
    const targetStorage = isAuthenticated && localStorage.getItem('tbToken')
      ? localStorage
      : sessionStorage

    const otherStorage = targetStorage === localStorage ? sessionStorage : localStorage

    targetStorage.setItem('avinya-current-page', currentPage)
    otherStorage.removeItem('avinya-current-page')
  }, [currentPage, isAuthenticated])

  useEffect(() => {
    if (pendingVerificationEmail) {
      sessionStorage.setItem('avinya-pending-verification-email', pendingVerificationEmail)
    } else {
      sessionStorage.removeItem('avinya-pending-verification-email')
    }
  }, [pendingVerificationEmail])

  useEffect(() => {
    if (pendingResetToken) {
      sessionStorage.setItem('avinya-reset-token', pendingResetToken)
    } else {
      sessionStorage.removeItem('avinya-reset-token')
    }
  }, [pendingResetToken])

  useEffect(() => {
    transitionEndTimeoutRef.current = window.setTimeout(() => {
      setIsSwitching(false)
    }, 720)

    return () => {
      window.clearTimeout(authSwitchTimeoutRef.current)
      window.clearTimeout(transitionEndTimeoutRef.current)
    }
  }, [])

  const runAppTransition = (callback) => {
    window.clearTimeout(authSwitchTimeoutRef.current)
    window.clearTimeout(transitionEndTimeoutRef.current)

    setIsSwitching(true)

    authSwitchTimeoutRef.current = window.setTimeout(() => {
      callback()
    }, 240)

    transitionEndTimeoutRef.current = window.setTimeout(() => {
      setIsSwitching(false)
    }, 780)
  }

  const handleLoginSuccess = () => {
    runAppTransition(() => {
      setCurrentPage('dashboard')
      setIsAuthenticated(true)
    })
  }

  const handleLogout = () => {
    sessionStorage.removeItem('tbToken')
    sessionStorage.removeItem('tbRefreshToken')
    sessionStorage.removeItem('tbUser')
    sessionStorage.removeItem('avinya-current-page')
    sessionStorage.removeItem('avinya-pending-verification-email')
    sessionStorage.removeItem('avinya-reset-token')

    localStorage.removeItem('tbToken')
    localStorage.removeItem('tbRefreshToken')
    localStorage.removeItem('tbUser')
    localStorage.removeItem('avinya-current-page')

    runAppTransition(() => {
      setPendingVerificationEmail('')
      setPendingResetToken('')
      setCurrentPage('login')
      setIsAuthenticated(false)
    })
  }

  const handlePageChange = (nextPage) => {
    if (nextPage === currentPage) return

    runAppTransition(() => {
      setCurrentPage(nextPage)
    })
  }

  const handleGoToRegister = () => {
    runAppTransition(() => {
      setPendingVerificationEmail('')
      setCurrentPage('register')
    })
  }

  const handleRegistrationSuccess = (registeredEmail) => {
    runAppTransition(() => {
      setPendingVerificationEmail(registeredEmail)
      setCurrentPage('otp-verification')
    })
  }

  const handleGoToLogin = () => {
    runAppTransition(() => {
      setPendingVerificationEmail('')
      setPendingResetToken('')
      setCurrentPage('login')
    })
  }

  const handleGoToForgotPassword = () => {
    runAppTransition(() => {
      setCurrentPage('forgot-password')
    })
  }

  const handlePasswordResetComplete = () => {
    runAppTransition(() => {
      setPendingResetToken('')
      setCurrentPage('login')
    })
  }

  return (
    <div className="app-shell">
      {isAuthenticated ? (
        currentPage === 'devices' ? (
          <Devices
            onLogout={handleLogout}
            onNavigate={handlePageChange}
            isDarkMode={isDarkMode}
            onThemeToggle={() => setIsDarkMode((prev) => !prev)}
          />
        ) : currentPage === 'users' ? (
          <Users
            onLogout={handleLogout}
            onNavigate={handlePageChange}
            isDarkMode={isDarkMode}
            onThemeToggle={() => setIsDarkMode((prev) => !prev)}
          />
        ) : currentPage === 'logs' ? (
          <Logs
            onLogout={handleLogout}
            onNavigate={handlePageChange}
            isDarkMode={isDarkMode}
            onThemeToggle={() => setIsDarkMode((prev) => !prev)}
          />
        ) : currentPage === 'account' ? (
          <Account
            onLogout={handleLogout}
            onNavigate={handlePageChange}
            isDarkMode={isDarkMode}
            onThemeToggle={() => setIsDarkMode((prev) => !prev)}
          />
        ) : (
          <Dashboard
            onLogout={handleLogout}
            onNavigate={handlePageChange}
            isDarkMode={isDarkMode}
            onThemeToggle={() => setIsDarkMode((prev) => !prev)}
          />
        )
      ) : currentPage === 'register' ? (
        <Registration
          onGoToLogin={handleGoToLogin}
          onRegistrationSuccess={handleRegistrationSuccess}
          isDarkMode={isDarkMode}
        />
      ) : currentPage === 'otp-verification' ? (
        <OTPVerification
          verificationEmail={pendingVerificationEmail}
          onGoToLogin={handleGoToLogin}
          onGoToRegister={handleGoToRegister}
        />
      ) : currentPage === 'forgot-password' ? (
        <ForgotPassword
          onGoToLogin={handleGoToLogin}
        />
      ) : currentPage === 'create-new-password' ? (
        <CreateNewPassword
          resetToken={pendingResetToken}
          onGoToLogin={handlePasswordResetComplete}
        />
      ) : (
        <Login
          onLoginSuccess={handleLoginSuccess}
          onGoToRegister={handleGoToRegister}
          onGoToForgotPassword={handleGoToForgotPassword}
        />
      )}

      <div className={`app-transition ${isSwitching ? 'active' : ''}`}>
        <div className="app-transition-card">
          <img src={logo} alt="Avinya Logo" className="app-transition-logo" />
          <div className="app-transition-loader">
            <span></span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App