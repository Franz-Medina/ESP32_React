import { useCallback, useEffect, useRef, useState } from 'react'
import Swal from 'sweetalert2'
import 'sweetalert2/dist/sweetalert2.min.css'
import logo from '../Pictures/Avinya.png'
import '../Styles/Dashboard.css'
import { getCurrentUserProfile, isAdministratorRole } from '../Utils/getCurrentUserProfile'
import { performReliableLogout } from '../Utils/performReliableLogout'
import { buildApiAssetUrl } from '../Config/API'
import { ProfileMenuIcon } from '../Components/Icons.jsx'

import {
  PumpControl,
  ServoMotor,
  LEDIndicator,
  CountWidgets,
  EntitiesTable,
  BatteryGauge,
  ProgressWidget,
  TimeSeriesChart,
  MarkdownCard,
} from '../Devices'
import ControlSwitch from '../Devices/ControlSwitch'
import UltraSonic from '../Devices/UltraSonic'

const GRID_COLS = 18
const CELL_SIZE = 80
const CELL_GAP  = 10

const WIDGET_DEFAULT_SIZE = {
  ControlSwitch:   [4, 2],
  ServoMotor:      [3, 2],
  LEDIndicator:    [2, 2],
  BatteryGauge:    [3, 3],
  ProgressWidget:  [4, 2],
  TimeSeriesChart: [6, 3],
  MarkdownCard:    [4, 3],
  CountWidgets:    [3, 2],
  EntitiesTable:   [6, 4],
}

const WIDGETS_STORAGE_KEY = 'avinya_dashboard_widgets_v2'

const findFreePosition = (widgets, w, h) => {
  const occupied = new Set()
  widgets.forEach(({ col, row, w: ww, h: hh }) => {
    for (let r = row; r < row + hh; r++)
      for (let c = col; c < col + ww; c++)
        occupied.add(`${c},${r}`)
  })
  for (let row = 0; row < 100; row++) {
    for (let col = 0; col <= GRID_COLS - w; col++) {
      let fits = true
      outer: for (let dr = 0; dr < h; dr++)
        for (let dc = 0; dc < w; dc++)
          if (occupied.has(`${col + dc},${row + dr}`)) { fits = false; break outer }
      if (fits) return { col, row }
    }
  }
  return { col: 0, row: 0 }
}

const clamp = (val, min, max) => Math.max(min, Math.min(max, val))

const loadWidgets = () => {
  try {
    const raw = localStorage.getItem(WIDGETS_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length > 0) return parsed
    }
  } catch { }
  return [
    { id: 'control-1', type: 'ControlSwitch', col: 0, row: 0, w: 4, h: 2 },
    { id: 'led-1',     type: 'LEDIndicator',  col: 4, row: 0, w: 2, h: 2 },
  ]
}

const cellPx = (count) => count * CELL_SIZE + (count - 1) * CELL_GAP

const isOverlapping = (widgets, excludeId, col, row, w, h) => {
  const occupied = new Set()
  widgets.forEach(ww => {
    if (ww.id === excludeId) return
    for (let r = ww.row; r < ww.row + ww.h; r++)
      for (let c = ww.col; c < ww.col + ww.w; c++)
        occupied.add(`${c},${r}`)
  })
  for (let dr = 0; dr < h; dr++)
    for (let dc = 0; dc < w; dc++)
      if (occupied.has(`${col + dc},${row + dr}`)) return true
  return false
}

const Dashboard = ({ onLogout, onNavigate, isDarkMode, onThemeToggle }) => {
  const [isEntitiesOpen,     setIsEntitiesOpen]     = useState(false)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [isProfileMenuOpen,  setIsProfileMenuOpen]  = useState(false)
  const [showAddModal,       setShowAddModal]        = useState(false)
  const [searchQuery,        setSearchQuery]         = useState('')
  const [isEditMode,         setIsEditMode]          = useState(false)
  const [widgets,            setWidgets]             = useState(loadWidgets)
  const [dragPreview,        setDragPreview]         = useState(null)
  const [resizePreview,      setResizePreview]       = useState(null)

  const gridRef    = useRef(null)
  const dragInfo   = useRef(null)
  const resizeInfo = useRef(null)

  const user = getCurrentUserProfile()
  const isAdministrator = isAdministratorRole(user.roleLabel)
  const sidebarProfileImagePreview = buildApiAssetUrl(user.profilePictureUrl)
  const sidebarUserInitials = [user.firstName, user.lastName]
    .filter(Boolean).map(v => String(v).trim().charAt(0).toUpperCase()).join('').slice(0, 2) || 'A'

  useEffect(() => {
    try { localStorage.setItem(WIDGETS_STORAGE_KEY, JSON.stringify(widgets)) } catch { }
  }, [widgets])

  useEffect(() => {
    document.title = 'Avinya | Dashboard'
    const handleOutsideClick = (e) => {
      if (!(e.target instanceof Element)) return
      if (!e.target.closest('.dashboard-sidebar-user-group')) setIsProfileMenuOpen(false)
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [])

  const closeDropdowns = () => {
    setIsEntitiesOpen(false)
    setIsProfileMenuOpen(false)
  }

  const handleProfileMenuToggle = (event) => {
    event.stopPropagation()
    setIsEntitiesOpen(false)
    setIsProfileMenuOpen((prev) => !prev)
  }

  const handleLogout = async (e) => {
    e.preventDefault(); e.stopPropagation()
    const result = await Swal.fire({
      title: 'Log Out?', text: 'Are you sure you want to log out?', icon: 'question',
      showCancelButton: true, confirmButtonText: 'Yes', cancelButtonText: 'No',
      reverseButtons: true, buttonsStyling: false, allowOutsideClick: true, allowEscapeKey: true,
      customClass: {
        popup: 'avinya-swal-popup', icon: 'avinya-swal-icon', title: 'avinya-swal-title',
        htmlContainer: 'avinya-swal-text', actions: 'avinya-swal-actions',
        confirmButton: 'avinya-swal-confirm', cancelButton: 'avinya-swal-cancel',
      },
    })
    if (!result.isConfirmed) return
    closeDropdowns(); performReliableLogout(onLogout)
  }

  const availableWidgets = [
    { type: 'ControlSwitch',   name: 'Control Switch',           icon: '⚙️',  description: 'Toggle on/off' },
    { type: 'ServoMotor',      name: 'Servo Motor',             icon: '🔧',  description: 'Control servo position' },
    { type: 'LEDIndicator',    name: 'LED Indicator',           icon: '💡',  description: 'Visual status light' },
    { type: 'BatteryGauge',    name: 'Battery Gauge',           icon: '🔋',  description: 'Battery level display' },
    { type: 'ProgressWidget',  name: 'Progress Widget',         icon: '📊',  description: 'Track progress metrics' },
    { type: 'TimeSeriesChart', name: 'Time Series Chart',       icon: '📈',  description: 'Historical data chart' },
    { type: 'MarkdownCard',    name: 'Markdown Card',           icon: '📝',  description: 'Rich text content' },
    { type: 'CountWidgets',    name: 'Count Widgets',           icon: '🔢',  description: 'Numeric counter display' },
    { type: 'EntitiesTable',   name: 'Entities Table',          icon: '📋',  description: 'Tabular entity data' },
    { type: 'UltraSonic',      name: 'UltraSonic Sensor',       icon: '�',  description: 'Distance measurement' },
  ]

  const WidgetMap = {
    ControlSwitch, ServoMotor, LEDIndicator, BatteryGauge, ProgressWidget,
    TimeSeriesChart, MarkdownCard, CountWidgets, EntitiesTable, UltraSonic,
  }

  const addWidget = (type) => {
    const [w, h] = WIDGET_DEFAULT_SIZE[type] || [3, 2]
    const { col, row } = findFreePosition(widgets, w, h)
    setWidgets(prev => [...prev, { id: `widget-${Date.now()}`, type, col, row, w, h }])
    setShowAddModal(false); setSearchQuery('')
  }

  const deleteWidget = async (id) => {
    const result = await Swal.fire({
      title: 'Remove Widget?', text: 'This widget will be removed from your dashboard.',
      icon: 'warning', showCancelButton: true, confirmButtonText: 'Remove', cancelButtonText: 'Cancel',
      reverseButtons: true, buttonsStyling: false, allowOutsideClick: true,
      customClass: {
        popup: 'avinya-swal-popup', icon: 'avinya-swal-icon', title: 'avinya-swal-title',
        htmlContainer: 'avinya-swal-text', actions: 'avinya-swal-actions',
        confirmButton: 'avinya-swal-confirm', cancelButton: 'avinya-swal-cancel',
      },
    })
    if (result.isConfirmed) setWidgets(prev => prev.filter(w => w.id !== id))
  }

  const mouseToCell = (mx, my) => {
    const rect = gridRef.current?.getBoundingClientRect() ?? { left: 0, top: 0 }
    return {
      col: Math.floor((mx - rect.left)  / (CELL_SIZE + CELL_GAP)),
      row: Math.floor((my - rect.top)   / (CELL_SIZE + CELL_GAP)),
    }
  }

  const onWidgetMouseDown = useCallback((e, widget) => {
    if (!isEditMode) return
    if (e.target.closest('.widget-resize-handle') || e.target.closest('.widget-delete-btn')) return
    e.preventDefault()

    const rect = e.currentTarget.getBoundingClientRect()
    dragInfo.current = {
      id:        widget.id,
      w:         widget.w,
      h:         widget.h,
      offsetCol: clamp(Math.floor((e.clientX - rect.left)  / (CELL_SIZE + CELL_GAP)), 0, widget.w - 1),
      offsetRow: clamp(Math.floor((e.clientY - rect.top)   / (CELL_SIZE + CELL_GAP)), 0, widget.h - 1),
    }

    const onMove = (me) => {
      const d = dragInfo.current; if (!d) return
      const { col: rc, row: rr } = mouseToCell(me.clientX, me.clientY)
      const col = clamp(rc - d.offsetCol, 0, GRID_COLS - d.w)
      const row = clamp(rr - d.offsetRow, 0, 99)
      const valid = !isOverlapping(widgets, d.id, col, row, d.w, d.h)
      setDragPreview({ col, row, w: d.w, h: d.h, valid })
    }

    const onUp = (me) => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      const d = dragInfo.current; dragInfo.current = null
      if (!d) { setDragPreview(null); return }
      const { col: rc, row: rr } = mouseToCell(me.clientX, me.clientY)
      const col = clamp(rc - d.offsetCol, 0, GRID_COLS - d.w)
      const row = clamp(rr - d.offsetRow, 0, 99)
      if (!isOverlapping(widgets, d.id, col, row, d.w, d.h)) {
        setWidgets(prev => prev.map(ww => ww.id === d.id ? { ...ww, col, row } : ww))
      }
      setDragPreview(null)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [isEditMode, widgets])

  const onResizeMouseDown = useCallback((e, widget) => {
    e.preventDefault(); e.stopPropagation()
    resizeInfo.current = { id: widget.id, startMX: e.clientX, startMY: e.clientY, startW: widget.w, startH: widget.h, col: widget.col, row: widget.row }

    const onMove = (me) => {
      const r = resizeInfo.current; if (!r) return
      const dC = Math.round((me.clientX - r.startMX) / (CELL_SIZE + CELL_GAP))
      const dR = Math.round((me.clientY - r.startMY) / (CELL_SIZE + CELL_GAP))
      const newW = clamp(r.startW + dC, 1, GRID_COLS - r.col)
      const newH = clamp(r.startH + dR, 1, 20)
      const valid = !isOverlapping(widgets, r.id, r.col, r.row, newW, newH)
      setResizePreview({ id: r.id, w: newW, h: newH, valid })
    }

    const onUp = (me) => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      const r = resizeInfo.current; resizeInfo.current = null
      if (!r) { setResizePreview(null); return }
      const dC = Math.round((me.clientX - r.startMX) / (CELL_SIZE + CELL_GAP))
      const dR = Math.round((me.clientY - r.startMY) / (CELL_SIZE + CELL_GAP))
      const newW = clamp(r.startW + dC, 1, GRID_COLS - r.col)
      const newH = clamp(r.startH + dR, 1, 20)
      if (!isOverlapping(widgets, r.id, r.col, r.row, newW, newH)) {
        setWidgets(prev => prev.map(ww => ww.id === r.id ? { ...ww, w: newW, h: newH } : ww))
      }
      setResizePreview(null)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [widgets])

  const gridRows = Math.max(8, ...widgets.map(w => w.row + w.h), dragPreview ? dragPreview.row + dragPreview.h + 2 : 0)
  const filteredWidgets = availableWidgets.filter(w =>
    w.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    w.description.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <main className="dashboard-page">
      <aside className={`dashboard-sidebar ${isSidebarCollapsed ? 'collapsed' : ''}`}>
        <div className="dashboard-sidebar-panel">
          <div className="dashboard-sidebar-header">
            <div className="dashboard-sidebar-top">
              <img src={logo} alt="Avinya Logo" className="dashboard-sidebar-logo" />
              <span className="dashboard-sidebar-brand">AVINYA</span>
            </div>
            <button type="button" className="dashboard-sidebar-collapse" onClick={() => { if (!isSidebarCollapsed) closeDropdowns(); setIsSidebarCollapsed(p => !p) }}
              aria-label={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                {isSidebarCollapsed ? <path d="M9 6l6 6-6 6" /> : <path d="M15 6l-6 6 6 6" />}
              </svg>
            </button>
          </div>

          <nav className="dashboard-sidebar-nav">
            <button type="button" className="dashboard-sidebar-link active" data-tooltip="Dashboard" aria-current="page">
              <span className="dashboard-sidebar-link-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" />
                  <rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" />
                </svg>
              </span>
              <span className="dashboard-sidebar-link-label">Dashboard</span>
            </button>

            <div className={`dashboard-sidebar-group ${isEntitiesOpen ? 'open' : ''}`}>
              <button type="button"
                className={`dashboard-sidebar-link dashboard-sidebar-toggle ${isEntitiesOpen ? 'dashboard-sidebar-link-open' : ''}`}
                onClick={() => { setIsProfileMenuOpen(false); setIsEntitiesOpen(p => !p) }}
                aria-expanded={isEntitiesOpen} data-tooltip="Entities">
                <span className="dashboard-sidebar-link-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 7h7" /><path d="M4 12h10" /><path d="M4 17h7" />
                    <circle cx="17" cy="7" r="2" /><circle cx="20" cy="12" r="2" /><circle cx="17" cy="17" r="2" />
                  </svg>
                </span>
                <span className="dashboard-sidebar-link-label">Entities</span>
                <span className="dashboard-sidebar-link-end" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    {isEntitiesOpen ? <path d="M18 15l-6-6-6 6" /> : <path d="M6 9l6 6 6-6" />}
                  </svg>
                </span>
              </button>
              <div className={`dashboard-sidebar-submenu ${isEntitiesOpen ? 'open' : ''}`}>
                <button type="button" className="dashboard-sidebar-sublink" onClick={() => onNavigate('devices')}>
                  <span className="dashboard-sidebar-sublink-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="7" width="7" height="10" rx="1.5" /><rect x="14" y="7" width="7" height="10" rx="1.5" />
                      <path d="M6.5 10.5h.01" /><path d="M17.5 10.5h.01" />
                    </svg>
                  </span>
                  <span className="dashboard-sidebar-sublink-label">Devices</span>
                </button>
              </div>
            </div>

            {isAdministrator && (
              <button type="button" className="dashboard-sidebar-link" data-tooltip="Users" onClick={() => onNavigate('users')}>
                <span className="dashboard-sidebar-link-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
                    <path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                </span>
                <span className="dashboard-sidebar-link-label">Users</span>
              </button>
            )}

            {isAdministrator && (
              <button type="button" className="dashboard-sidebar-link" data-tooltip="Logs" onClick={() => onNavigate('logs')}>
                <span className="dashboard-sidebar-link-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                  </svg>
                </span>
                <span className="dashboard-sidebar-link-label">Logs</span>
              </button>
            )}
          </nav>

          <div className="dashboard-sidebar-footer">
            <button type="button" className={`dashboard-sidebar-theme ${isDarkMode ? 'active' : ''}`}
              onClick={onThemeToggle} aria-label={isDarkMode ? 'Turn off dark mode' : 'Turn on dark mode'}
              aria-pressed={isDarkMode} data-tooltip={isDarkMode ? 'Light Mode' : 'Dark Mode'}>
              <span className="dashboard-sidebar-theme-icon" aria-hidden="true">
                {isDarkMode ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="4" /><path d="M12 2v2" /><path d="M12 20v2" />
                    <path d="m4.93 4.93 1.41 1.41" /><path d="m17.66 17.66 1.41 1.41" />
                    <path d="M2 12h2" /><path d="M20 12h2" />
                    <path d="m6.34 17.66-1.41 1.41" /><path d="m19.07 4.93-1.41 1.41" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z" />
                  </svg>
                )}
              </span>
              <span className="dashboard-sidebar-theme-label">{isDarkMode ? 'Light Mode' : 'Dark Mode'}</span>
              <span className="dashboard-sidebar-theme-switch" aria-hidden="true">
                <span className="dashboard-sidebar-theme-thumb" />
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
                  {sidebarProfileImagePreview
                    ? <img src={sidebarProfileImagePreview} alt="" className="dashboard-sidebar-user-avatar-image" />
                    : <div className="dashboard-sidebar-user-avatar-fallback">
                        <span className="dashboard-sidebar-user-avatar-fallback-text">{sidebarUserInitials}</span>
                      </div>
                  }
                </div>
                <div className="dashboard-sidebar-user-details">
                  <span className="dashboard-sidebar-user-name">{user.fullName}</span>
                  <span className="dashboard-sidebar-user-email">{user.roleLabel}</span>
                </div>
                <button
                  type="button"
                  className="dashboard-sidebar-user-more"
                  aria-label={isProfileMenuOpen ? 'Close profile menu' : 'Open profile menu'}
                  aria-expanded={isProfileMenuOpen}
                  onClick={handleProfileMenuToggle}
                >
                  <ProfileMenuIcon isOpen={isProfileMenuOpen} />
                </button>
              </div>
              <div className={`dashboard-sidebar-user-menu ${isProfileMenuOpen ? 'open' : ''}`}>
                <button type="button" className="dashboard-sidebar-user-menu-item"
                  onClick={() => { closeDropdowns(); onNavigate('account') }}>
                  <span className="dashboard-sidebar-user-menu-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M20 21a8 8 0 0 0-16 0" /><circle cx="12" cy="8" r="4" />
                    </svg>
                  </span>
                  <span>Account</span>
                </button>
                <button type="button" className="dashboard-sidebar-user-menu-item dashboard-sidebar-user-menu-item-danger" onClick={handleLogout}>
                  <span className="dashboard-sidebar-user-menu-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                      <path d="M16 17l5-5-5-5" /><path d="M21 12H9" />
                    </svg>
                  </span>
                  <span>Log Out</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </aside>

      <section className="dashboard-content">
        <div className="dashboard-content-body dashboard-content-body-frame">
          <div className="dashboard-header dashboard-page-title-row">
            <h1 className="dashboard-content-title">Dashboard</h1>
            <button type="button" className={`edit-mode-btn ${isEditMode ? 'active' : ''}`} onClick={() => setIsEditMode(p => !p)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15">
                {isEditMode
                  ? <path d="M20 6L9 17l-5-5" />
                  : <><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                     <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></>
                }
              </svg>
              {isEditMode ? 'Done' : 'Edit Layout'}
            </button>
          </div>

          {/* Grid */}
          <div className="widget-grid-scroll">
            <div
              ref={gridRef}
              className={`widget-grid-canvas ${isEditMode ? 'edit-mode' : ''}`}
              style={{ height: `${cellPx(gridRows)}px` }}
            >
              {/* Grid dot background */}
              {isEditMode && Array.from({ length: gridRows * GRID_COLS }).map((_, i) => {
                const c = i % GRID_COLS
                const r = Math.floor(i / GRID_COLS)
                return (
                  <div key={i} className="grid-cell-dot" style={{
                    left:   c * (CELL_SIZE + CELL_GAP),
                    top:    r * (CELL_SIZE + CELL_GAP),
                    width:  CELL_SIZE,
                    height: CELL_SIZE,
                  }} />
                )
              })}

              {/* Drag ghost */}
              {dragPreview && (
                <div className={`widget-drag-ghost ${dragPreview.valid ? 'valid' : 'invalid'}`} style={{
                  left:   dragPreview.col * (CELL_SIZE + CELL_GAP),
                  top:    dragPreview.row * (CELL_SIZE + CELL_GAP),
                  width:  cellPx(dragPreview.w),
                  height: cellPx(dragPreview.h),
                }} />
              )}

              {/* Widgets */}
              {widgets.map((widget) => {
                const Component = WidgetMap[widget.type]
                if (!Component) return null
                const isResizing = resizePreview?.id === widget.id
                const dW = isResizing ? resizePreview.w : widget.w
                const dH = isResizing ? resizePreview.h : widget.h
                const resizeOk = isResizing ? resizePreview.valid : true

                return (
                  <div
                    key={widget.id}
                    className={`dashboard-widget-wrapper ${isEditMode ? 'editable' : ''} ${isResizing ? (resizeOk ? 'resizing-valid' : 'resizing-invalid') : ''}`}
                    style={{
                      left:   widget.col * (CELL_SIZE + CELL_GAP),
                      top:    widget.row * (CELL_SIZE + CELL_GAP),
                      width:  cellPx(dW),
                      height: cellPx(dH),
                    }}
                    onMouseDown={(e) => onWidgetMouseDown(e, widget)}
                  >
                    <div className="widget-inner"><Component /></div>

                    {isEditMode && (
                      <>
                        <div className="widget-drag-handle" title="Drag to move">
                          <svg viewBox="0 0 20 20" fill="currentColor" width="13" height="13">
                            <circle cx="7" cy="4" r="1.5"/><circle cx="13" cy="4" r="1.5"/>
                            <circle cx="7" cy="10" r="1.5"/><circle cx="13" cy="10" r="1.5"/>
                            <circle cx="7" cy="16" r="1.5"/><circle cx="13" cy="16" r="1.5"/>
                          </svg>
                        </div>

                        <button type="button" className="widget-delete-btn" title="Remove widget"
                          onClick={(e) => { e.stopPropagation(); deleteWidget(widget.id) }}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="11" height="11">
                            <path d="M18 6L6 18M6 6l12 12" />
                          </svg>
                        </button>

                        <div className="widget-size-badge">{dW} × {dH}</div>

                        <div className="widget-resize-handle" title="Drag to resize"
                          onMouseDown={(e) => onResizeMouseDown(e, widget)}>
                          <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" width="10" height="10" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 1L1 11M7 11h4V7" />
                          </svg>
                        </div>
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          <button className="add-widget-float-btn" onClick={() => setShowAddModal(true)} title="Add new widget">+</button>

          {showAddModal && (
            <div className="modal-overlay" onClick={() => { setShowAddModal(false); setSearchQuery('') }}>
              <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                  <div className="modal-header-left">
                    <div className="modal-header-icon">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="3" width="7" height="7" rx="1.5" />
                        <rect x="14" y="3" width="7" height="7" rx="1.5" />
                        <rect x="3" y="14" width="7" height="7" rx="1.5" />
                        <path d="M14 17.5h7M17.5 14v7" />
                      </svg>
                    </div>
                    <div>
                      <h2 className="modal-title">Add Widget</h2>
                      <p className="modal-subtitle">Choose a widget to add to your dashboard</p>
                    </div>
                  </div>
                  <button className="modal-close" onClick={() => { setShowAddModal(false); setSearchQuery('') }} aria-label="Close">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="modal-search-wrapper">
                  <span className="modal-search-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
                    </svg>
                  </span>
                  <input className="modal-search-input" type="text" placeholder="Search widgets…"
                    value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} autoFocus />
                  {searchQuery && (
                    <button className="modal-search-clear" onClick={() => setSearchQuery('')}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M18 6L6 18M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>

                <div className="available-widgets-list">
                  {filteredWidgets.length > 0 ? filteredWidgets.map((w) => {
                    const [ww, hh] = WIDGET_DEFAULT_SIZE[w.type] || [3, 2]
                    return (
                      <button key={w.type} className="widget-option" onClick={() => addWidget(w.type)}>
                        <span className="widget-option-icon">{w.icon}</span>
                        <span className="widget-option-name">{w.name}</span>
                        <span className="widget-option-desc">{w.description}</span>
                        <span className="widget-option-size-hint">{ww}×{hh}</span>
                        <span className="widget-option-add-icon">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M12 5v14M5 12h14" />
                          </svg>
                        </span>
                      </button>
                    )
                  }) : (
                    <div className="modal-empty-state">
                      <span className="modal-empty-icon">🔍</span>
                      <p>No widgets match <strong>"{searchQuery}"</strong></p>
                    </div>
                  )}
                </div>

                <div className="modal-footer">
                  <span className="modal-footer-count">{availableWidgets.length} widgets available</span>
                </div>
              </div>
            </div>
          )}

        </div>
      </section>
    </main>
  )
}

export default Dashboard