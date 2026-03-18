import { useEffect, useRef, useState } from 'react'
import Login from './Pages/Login.jsx'
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
    () => sessionStorage.getItem('avinya-current-page') || 'dashboard'
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

    runAppTransition(() => {
      setCurrentPage('dashboard')
      setIsAuthenticated(false)
    })
  }

  const handlePageChange = (nextPage) => {
    if (nextPage === currentPage) return

    runAppTransition(() => {
      setCurrentPage(nextPage)
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
      ) : (
        <Login onLoginSuccess={handleLoginSuccess} />
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