import React from 'react';
import logo from '../Pictures/Avinya.png';

const Dashboard = () => {
  return (
    <div className="d-flex flex-column min-vh-100 bg-light">
      <div className="d-flex flex-grow-1">

        <div
          className="d-none d-md-flex flex-column flex-shrink-0 bg-white shadow"
          style={{ width: '260px', minWidth: '260px' }}
        >
          <div className="p-4 pb-3 border-bottom">
            <div className="d-flex align-items-center">
              <img
                src={logo}
                alt="Avinya Logo"
                style={{
                  width: '52px',
                  height: '52px',
                  objectFit: 'contain',
                  borderRadius: '12px',
                }}
              />
              <span className="fs-4 ms-3 fw-bold text-dark">Avinya</span>
            </div>
          </div>

          <div className="p-3 flex-grow-1 d-flex flex-column">
            <div className="small text-uppercase fw-bold text-muted mb-2 px-3">MENU</div>
            <ul className="nav nav-pills flex-column gap-1 mb-auto">
              <li>
                <a href="#" className="nav-link active rounded-pill bg-danger text-white d-flex align-items-center py-3 px-3">
                  <i className="bi bi-grid-1x2-fill me-3 fs-5"></i> Dashboard
                </a>
              </li>
              <li>
                <a href="#" className="nav-link text-dark rounded-pill d-flex align-items-center py-3 px-3">
                  <i className="bi bi-check2-square me-3 fs-5"></i> Tasks
                </a>
              </li>
              <li>
                <a href="#" className="nav-link text-dark rounded-pill d-flex align-items-center py-3 px-3">
                  <i className="bi bi-calendar-event me-3 fs-5"></i> Calendar
                </a>
              </li>
              <li>
                <a href="#" className="nav-link text-dark rounded-pill d-flex align-items-center py-3 px-3">
                  <i className="bi bi-bar-chart-line me-3 fs-5"></i> Analytics
                </a>
              </li>
              <li>
                <a href="#" className="nav-link text-dark rounded-pill d-flex align-items-center py-3 px-3">
                  <i className="bi bi-people-fill me-3 fs-5"></i> Team
                </a>
              </li>
            </ul>

            <hr className="my-4 opacity-50" />

            <div className="small text-uppercase fw-bold text-muted mb-2 px-3">GENERAL</div>
            <ul className="nav nav-pills flex-column gap-1">
              <li><a href="#" className="nav-link text-dark rounded-pill d-flex align-items-center py-3 px-3"><i className="bi bi-gear me-3 fs-5"></i> Settings</a></li>
              <li><a href="#" className="nav-link text-dark rounded-pill d-flex align-items-center py-3 px-3"><i className="bi bi-question-circle me-3 fs-5"></i> Help</a></li>
              <li><a href="#" className="nav-link text-danger rounded-pill d-flex align-items-center py-3 px-3"><i className="bi bi-box-arrow-right me-3 fs-5"></i> Logout</a></li>
            </ul>
          </div>
        </div>

        {/* Main area - takes all remaining space */}
        <div className="d-flex flex-column flex-grow-1 overflow-hidden">
          {/* Top bar */}
          <header className="bg-white border-bottom px-3 px-md-4 py-3 d-flex align-items-center justify-content-between flex-wrap gap-3">
            <input
              type="text"
              placeholder="Search task"
              className="form-control rounded-pill bg-light border-0 px-4 py-2 flex-grow-1"
              style={{ maxWidth: '420px', minWidth: '200px' }}
            />

            <div className="d-flex align-items-center gap-3 gap-md-4">
              <button className="btn btn-link text-muted p-0"><i className="bi bi-bell fs-5"></i></button>
              <button className="btn btn-link text-muted p-0"><i className="bi bi-envelope fs-5"></i></button>

              <div className="d-flex align-items-center gap-2">
                <div className="rounded-circle bg-secondary" style={{ width: '40px', height: '40px' }}></div>
                <div className="d-none d-sm-block">
                  <div className="fw-medium">John Doe</div>
                  <div className="small text-muted">johndoe@gmail.com</div>
                </div>
              </div>
            </div>
          </header>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;