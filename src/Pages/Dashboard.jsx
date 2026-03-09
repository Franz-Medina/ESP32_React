import React from 'react';
import logo from '../Pictures/Avinya.png';
import './Dashboard.css';

const Dashboard = () => {
  return (
    <div className="dashboard-layout min-vh-100 bg-light d-flex flex-column p-3 p-md-4">
      <div className="d-flex flex-grow-1 gap-4">
        <aside className="sidebar-card d-none d-lg-flex flex-column">
          <div className="sidebar-header p-4 pb-3">
            <div className="d-flex align-items-center">
              <img
                src={logo}
                alt="Avinya Logo"
                className="logo"
              />
              <span className="fs-4 ms-3 fw-bold text-dark">Avinya</span>
            </div>
          </div>

          <div className="sidebar-body p-3 pt-2 flex-grow-1 d-flex flex-column">
            <div className="sidebar-section-title">MENU</div>

            <nav className="nav flex-column gap-1 mb-auto">
              <a href="#" className="nav-link active">
                <i className="bi bi-grid-1x2-fill me-3"></i>
                Dashboard
              </a>
              <a href="#" className="nav-link">
                <i className="bi bi-check2-square me-3"></i>
                Tasks
              </a>
              <a href="#" className="nav-link">
                <i className="bi bi-calendar-event me-3"></i>
                Calendar
              </a>
              <a href="#" className="nav-link">
                <i className="bi bi-bar-chart-line me-3"></i>
                Analytics
              </a>
              <a href="#" className="nav-link">
                <i className="bi bi-people-fill me-3"></i>
                Team
              </a>
            </nav>



            <div className="sidebar-section-title">GENERAL</div>

            <nav className="nav flex-column gap-1">
              <a href="#" className="nav-link">
                <i className="bi bi-gear me-3"></i>
                Settings
              </a>
              <a href="#" className="nav-link">
                <i className="bi bi-question-circle me-3"></i>
                Help
              </a>
              <a href="#" className="nav-link text-danger">
                <i className="bi bi-box-arrow-right me-3"></i>
                Logout
              </a>
            </nav>

          </div>
        </aside>

        <div className="main-content d-flex flex-column flex-grow-1">
          <div className="topbar-card">
            <header className="topbar d-flex align-items-center justify-content-between flex-wrap gap-3">
              <input
                type="text"
                placeholder="Search task..."
                className="search-input form-control rounded-pill bg-white border px-4 py-2 shadow-sm"
              />

              <div className="d-flex align-items-center gap-3 gap-md-4">
                <button className="btn btn-link text-muted p-0" aria-label="Notifications">
                  <i className="bi bi-bell fs-5"></i>
                </button>
                <button className="btn btn-link text-muted p-0" aria-label="Messages">
                  <i className="bi bi-envelope fs-5"></i>
                </button>

                <div className="user-profile d-flex align-items-center gap-2">
                  <div className="avatar rounded-circle bg-secondary"></div>
                  <div className="d-none d-sm-block">
                    <div className="fw-medium">John Doe</div>
                    <div className="user-email small text-muted">johndoe@gmail.com</div>
                  </div>
                </div>
              </div>
            </header>
          </div>

          <main className="content-area flex-grow-1 mt-4">
            <div>
              
            </div>
          </main>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;