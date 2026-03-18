import { useEffect, useRef, useState } from 'react'
import Login from './Pages/Login.jsx'
import Dashboard from './Pages/Dashboard.jsx'
import Register from './Pages/Register.jsx'
import logo from './Pictures/Avinya.png'
import './Styles/App.css'

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(
    () => !!sessionStorage.getItem('tbToken')
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
    transitionEndTimeoutRef.current = window.setTimeout(() => {
      setIsSwitching(false)
    }, 720)

    return () => {
      window.clearTimeout(authSwitchTimeoutRef.current)
      window.clearTimeout(transitionEndTimeoutRef.current)
    }
  }, [])

  const runPageTransition = (nextAuthState) => {
    window.clearTimeout(authSwitchTimeoutRef.current)
    window.clearTimeout(transitionEndTimeoutRef.current)

    setIsSwitching(true)

    authSwitchTimeoutRef.current = window.setTimeout(() => {
      setIsAuthenticated(nextAuthState)
    }, 220)

    transitionEndTimeoutRef.current = window.setTimeout(() => {
      setIsSwitching(false)
    }, 720)
  }

  const handleLoginSuccess = () => {
    runPageTransition(true)
  }

  const handleLogout = () => {
    sessionStorage.removeItem('tbToken')
    sessionStorage.removeItem('tbRefreshToken')
    sessionStorage.removeItem('tbUser')
    runPageTransition(false)
  }

  return (
    <div className="app-shell">
      {isAuthenticated ? (
        <Dashboard
          onLogout={handleLogout}
          isDarkMode={isDarkMode}
          onThemeToggle={() => setIsDarkMode((prev) => !prev)}
        />
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