import React from 'react';
import logo from '../Pictures/Avinya.png';
import PumpControl from '../devices/PumpControl';
import ServoMotor from '../devices/ServoMotor';
import UltraSonicWidget from '../devices/UltraSonic';
import { TbLayoutDashboardFilled, TbBrandGoogleAnalytics, TbCalendarDue, TbUsers, TbWheel, TbLogout, TbSettings, TbNews } from "react-icons/tb";

import './Dashboard.css';

const Dashboard = () => {
  return (
    <div className="dashboard-layout min-vh-100 d-flex flex-column p-3 p-md-4">
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

          <div className="sidebar-body flex-grow-1 d-flex flex-column p-3 pt-1">
            <div className="sidebar-section-title">MENU</div>

            <nav className="nav flex-column mb-2">
              <a href="#" className="nav-link active">
                <TbLayoutDashboardFilled className="me-2" size={22} />
                Dashboard
              </a>
              <a href="#" className="nav-link">
                <TbNews className="me-2" size={22} />
                News
              </a>
              <a href="#" className="nav-link">
                <TbCalendarDue className="me-2" size={22} />
                Calendar
              </a>
              <a href="#" className="nav-link">
                <TbBrandGoogleAnalytics className="me-2" size={22} />
                Analytics
              </a>
              <a href="#" className="nav-link">
                <TbUsers className="me-2" size={22} />
                Team
              </a>
            </nav>

            <div className="sidebar-section-title">GENERAL</div>

            <nav className="nav flex-column">
              <a href="#" className="nav-link">
                <TbSettings className="me-2" size={22} />
                Settings
              </a>
              <a href="#" className="nav-link">
                <TbWheel className="me-2" size={22} />
                Help
              </a>
              <a href="#" className="nav-link text-danger">
                <TbLogout className="me-2" size={22} />
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
                className="search-input form-control rounded-pill bg-white border px-4 py-2"
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

          <main className="dashboard-card flex-grow-1 mt-2">
            <div className="card h-100 border-0">
              <div className="card-body p-4 p-md-5">
                <h4 className="mb-4 fw-bold">Dashboard</h4>
                <p className="text-muted mb-4">
                  Control your devices and monitor status in real time.
                </p>

                <div className="row g-3">
                  <div className="col-lg-6">
                    <div className="bg-white rounded-4 p-4 border">
                      <PumpControl />
                    </div>
                  </div>

                  <div className="col-lg-6">
                    <div className="bg-white rounded-4 p-4 border">
                      <ServoMotor />
                    </div>
                  </div>

                  <div className="col-lg-6">
                    <div className="bg-white rounded-4 p-4 border">
                      <UltraSonicWidget />
                    </div>
                  </div>

                </div>
                
              </div>
            </div>
          </main>
          
        </div>
      </div>
    </div>
  );
};

export default Dashboard;