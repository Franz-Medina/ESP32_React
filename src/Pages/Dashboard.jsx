import { useEffect, useState } from 'react'
import Swal from 'sweetalert2'
import 'sweetalert2/dist/sweetalert2.min.css'
import logo from '../Pictures/Avinya.png'
import '../Styles/Dashboard.css'

const Dashboard = ({ onLogout, isDarkMode, onThemeToggle }) => {
  const [isEntitiesOpen, setIsEntitiesOpen] = useState(false)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false)

  const userFullName = 'Franz Lester C. Medina'
  const userEmail = 'franzmedina03@gmail.com'

  useEffect(() => {
    document.title = 'Avinya | Dashboard'

    const handleOutsideClick = (event) => {
      if (!event.target.closest('.dashboard-sidebar-user-group')) {
        setIsProfileMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleOutsideClick)

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
    }
  }, [])

  const handleSidebarToggle = () => {
    if (!isSidebarCollapsed) {
      setIsEntitiesOpen(false)
      setIsProfileMenuOpen(false)
    }

    setIsSidebarCollapsed((prev) => !prev)
  }

  const handleEntitiesToggle = () => {
    setIsProfileMenuOpen(false)
    setIsEntitiesOpen((prev) => !prev)
  }

  const handleProfileMenuToggle = (event) => {
    event.stopPropagation()
    setIsEntitiesOpen(false)
    setIsProfileMenuOpen((prev) => !prev)
  }

  const handleLogout = async (event) => {
    event.preventDefault()
    event.stopPropagation()

    const result = await Swal.fire({
      title: 'Log Out?',
      text: 'Are you sure you want to log out?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Yes',
      cancelButtonText: 'No',
      reverseButtons: true,
      buttonsStyling: false,
      allowOutsideClick: true,
      allowEscapeKey: true,
      customClass: {
        popup: 'avinya-swal-popup',
        icon: 'avinya-swal-icon',
        title: 'avinya-swal-title',
        htmlContainer: 'avinya-swal-text',
        actions: 'avinya-swal-actions',
        confirmButton: 'avinya-swal-confirm',
        cancelButton: 'avinya-swal-cancel'
      }
    })

    if (!result.isConfirmed) {
      return
    }

    setIsEntitiesOpen(false)
    setIsProfileMenuOpen(false)
    onLogout()
  }

  return (
    <main className="dashboard-page">
      <aside className={`dashboard-sidebar ${isSidebarCollapsed ? 'collapsed' : ''}`}>
        <div className="dashboard-sidebar-header">
          <div className="dashboard-sidebar-top">
            <img
              src={logo}
              alt="Avinya Logo"
              className="dashboard-sidebar-logo"
            />
            <span className="dashboard-sidebar-brand">AVINYA</span>
          </div>

          <button
            type="button"
            className="dashboard-sidebar-collapse"
            onClick={handleSidebarToggle}
            aria-label={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {isSidebarCollapsed ? (
                <path d="M9 6l6 6-6 6"></path>
              ) : (
                <path d="M15 6l-6 6 6 6"></path>
              )}
            </svg>
          </button>
        </div>

        <nav className="dashboard-sidebar-nav">
          <div
            className="dashboard-sidebar-link active"
            data-tooltip="Dashboard"
            aria-current="page"
          >
            <span className="dashboard-sidebar-link-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7" rx="1.5"></rect>
                <rect x="14" y="3" width="7" height="7" rx="1.5"></rect>
                <rect x="3" y="14" width="7" height="7" rx="1.5"></rect>
                <rect x="14" y="14" width="7" height="7" rx="1.5"></rect>
              </svg>
            </span>
            <span className="dashboard-sidebar-link-label">Dashboard</span>
          </div>

          <div className={`dashboard-sidebar-group ${isEntitiesOpen ? 'open' : ''}`}>
            <button
              type="button"
              className={`dashboard-sidebar-link dashboard-sidebar-toggle ${isEntitiesOpen ? 'dashboard-sidebar-link-open' : ''}`}
              onClick={handleEntitiesToggle}
              aria-expanded={isEntitiesOpen}
              data-tooltip="Entities"
            >
              <span className="dashboard-sidebar-link-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 7h7"></path>
                  <path d="M4 12h10"></path>
                  <path d="M4 17h7"></path>
                  <circle cx="17" cy="7" r="2"></circle>
                  <circle cx="20" cy="12" r="2"></circle>
                  <circle cx="17" cy="17" r="2"></circle>
                </svg>
              </span>

              <span className="dashboard-sidebar-link-label">Entities</span>

              <span className="dashboard-sidebar-link-end" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  {isEntitiesOpen ? (
                    <path d="M18 15l-6-6-6 6"></path>
                  ) : (
                    <path d="M6 9l6 6 6-6"></path>
                  )}
                </svg>
              </span>
            </button>

            <div className={`dashboard-sidebar-submenu ${isEntitiesOpen ? 'open' : ''}`}>
              <div className="dashboard-sidebar-sublink">
                <span className="dashboard-sidebar-sublink-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="7" width="7" height="10" rx="1.5"></rect>
                    <rect x="14" y="7" width="7" height="10" rx="1.5"></rect>
                    <path d="M6.5 10.5h.01"></path>
                    <path d="M17.5 10.5h.01"></path>
                  </svg>
                </span>
                <span className="dashboard-sidebar-sublink-label">Devices</span>
              </div>
            </div>
          </div>
          <div className="dashboard-sidebar-link" data-tooltip="Users">
            <span className="dashboard-sidebar-link-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
                <path d="M22 21v-2a4 4 0 0 0-3-3.87"></path>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
              </svg>
            </span>
            <span className="dashboard-sidebar-link-label">Users</span>
          </div>

          <div className="dashboard-sidebar-link" data-tooltip="Logs">
            <span className="dashboard-sidebar-link-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 11l3 3L22 4"></path>
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
              </svg>
            </span>
            <span className="dashboard-sidebar-link-label">Logs</span>
          </div>
        </nav>

        <div className="dashboard-sidebar-footer">
          <button
            type="button"
            className={`dashboard-sidebar-theme ${isDarkMode ? 'active' : ''}`}
            onClick={onThemeToggle}
            aria-label={isDarkMode ? 'Turn off dark mode' : 'Turn on dark mode'}
            aria-pressed={isDarkMode}
            data-tooltip={isDarkMode ? 'Light Mode' : 'Dark Mode'}
          >
            <span className="dashboard-sidebar-theme-icon" aria-hidden="true">
              {isDarkMode ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="4"></circle>
                  <path d="M12 2v2"></path>
                  <path d="M12 20v2"></path>
                  <path d="m4.93 4.93 1.41 1.41"></path>
                  <path d="m17.66 17.66 1.41 1.41"></path>
                  <path d="M2 12h2"></path>
                  <path d="M20 12h2"></path>
                  <path d="m6.34 17.66-1.41 1.41"></path>
                  <path d="m19.07 4.93-1.41 1.41"></path>
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z"></path>
                </svg>
              )}
            </span>

            <span className="dashboard-sidebar-theme-label">{isDarkMode ? 'Light Mode' : 'Dark Mode'}</span>

            <span className="dashboard-sidebar-theme-switch" aria-hidden="true">
              <span className="dashboard-sidebar-theme-thumb"></span>
            </span>
          </button>

          <div className={`dashboard-sidebar-user-group ${isProfileMenuOpen ? 'open' : ''}`}>
            <div
              className="dashboard-sidebar-user"
              data-tooltip="Profile"
              onClick={isSidebarCollapsed ? handleProfileMenuToggle : undefined}
              role={isSidebarCollapsed ? 'button' : undefined}
              tabIndex={isSidebarCollapsed ? 0 : undefined}
              onKeyDown={
                isSidebarCollapsed
                  ? (event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        handleProfileMenuToggle(event)
                      }
                    }
                  : undefined
              }
            >
              <div className="dashboard-sidebar-user-avatar" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 21a8 8 0 0 0-16 0"></path>
                  <circle cx="12" cy="8" r="4"></circle>
                </svg>
              </div>

              <div className="dashboard-sidebar-user-details">
                <span className="dashboard-sidebar-user-name">{userFullName}</span>
                <span className="dashboard-sidebar-user-email">{userEmail}</span>
              </div>

              <button
                type="button"
                className="dashboard-sidebar-user-more"
                aria-label="More user options"
                aria-expanded={isProfileMenuOpen}
                onClick={handleProfileMenuToggle}
              >
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="12" cy="5" r="1.8"></circle>
                  <circle cx="12" cy="12" r="1.8"></circle>
                  <circle cx="12" cy="19" r="1.8"></circle>
                </svg>
              </button>
            </div>

            <div className={`dashboard-sidebar-user-menu ${isProfileMenuOpen ? 'open' : ''}`}>
              <a href="#" className="dashboard-sidebar-user-menu-item">
                <span className="dashboard-sidebar-user-menu-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 21a8 8 0 0 0-16 0"></path>
                    <circle cx="12" cy="8" r="4"></circle>
                  </svg>
                </span>
                <span>Account</span>
              </a>

              <a
                href="#"
                className="dashboard-sidebar-user-menu-item dashboard-sidebar-user-menu-item-danger"
                onClick={handleLogout}
              >
                <span className="dashboard-sidebar-user-menu-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                    <path d="M16 17l5-5-5-5"></path>
                    <path d="M21 12H9"></path>
                  </svg>
                </span>
                <span>Log Out</span>
              </a>
            </div>
          </div>
        </div>
      </aside>

      <section className="dashboard-content">
        <div className="dashboard-content-body">
          <h1 className="dashboard-content-title">Dashboard</h1>
        </div>
      </section>
    </main>
  )
}

export default Dashboard