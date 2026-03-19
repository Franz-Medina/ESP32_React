import { useEffect, useRef, useState } from 'react'
import Login from './Pages/Login.jsx'
import Registration from './Pages/Registration.jsx'
import OTPVerification from './Pages/OTPVerification.jsx'
import Dashboard from './Pages/Dashboard.jsx'
import Devices from './Pages/Devices.jsx'
import Users from './Pages/Users.jsx'
import Logs from './Pages/Logs.jsx'
import Account from './Pages/Account.jsx'
import logo from './Pictures/Avinya.png'
import './Styles/App.css'

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(
    () => !!sessionStorage.getItem('tbToken')
  )
  const [currentPage, setCurrentPage] = useState(
    () => sessionStorage.getItem('avinya-current-page') || 'login'
  )
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState(
    () => sessionStorage.getItem('avinya-pending-verification-email') || ''
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
    sessionStorage.setItem('avinya-current-page', currentPage)
  }, [currentPage])

  useEffect(() => {
    if (pendingVerificationEmail) {
      sessionStorage.setItem('avinya-pending-verification-email', pendingVerificationEmail)
    } else {
      sessionStorage.removeItem('avinya-pending-verification-email')
    }
  }, [pendingVerificationEmail])

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

    runAppTransition(() => {
      setPendingVerificationEmail('')
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
      ) : (
        <Login
          onLoginSuccess={handleLoginSuccess}
          onGoToRegister={handleGoToRegister}
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