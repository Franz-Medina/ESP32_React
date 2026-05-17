export function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20 21a8 8 0 0 0-16 0"></path>
      <circle cx="12" cy="8" r="4"></circle>
    </svg>
  )
}

export function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="5" y="11" width="14" height="10" rx="2"></rect>
      <path d="M8 11V8a4 4 0 1 1 8 0v3"></path>
    </svg>
  )
}

export function EyeOpenIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"></path>
      <circle cx="12" cy="12" r="3"></circle>
    </svg>
  )
}

export function EyeClosedIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 3l18 18"></path>
      <path d="M10.58 10.58a2 2 0 1 0 2.83 2.83"></path>
      <path d="M9.88 5.09A9.77 9.77 0 0 1 12 5c7 0 11 7 11 7a19.08 19.08 0 0 1-3.04 3.81"></path>
      <path d="M6.71 6.72C3.61 8.41 1 12 1 12a18.7 18.7 0 0 0 5.12 5.11"></path>
      <path d="M14.12 14.12A3 3 0 0 1 9.88 9.88"></path>
    </svg>
  )
}

export function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.9.33 1.78.61 2.62a2 2 0 0 1-.45 2.11L8 9.73a16 16 0 0 0 6.27 6.27l1.28-1.27a2 2 0 0 1 2.11-.45c.84.28 1.72.49 2.62.61A2 2 0 0 1 22 16.92z"></path>
    </svg>
  )
}

export function GlobeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="9"></circle>
      <path d="M3 12h18"></path>
      <path d="M12 3a14.5 14.5 0 0 1 0 18"></path>
      <path d="M12 3a14.5 14.5 0 0 0 0 18"></path>
    </svg>
  )
}

export function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="7"></circle>
      <path d="m20 20-3.5-3.5"></path>
    </svg>
  )
}

export function FilterIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 6h16"></path>
      <path d="M7 12h10"></path>
      <path d="M10 18h4"></path>
    </svg>
  )
}

export function SortIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M11 6h10"></path>
      <path d="M11 12h7"></path>
      <path d="M11 18h4"></path>
      <path d="m6 4-3 3 3 3"></path>
      <path d="M3 7h6"></path>
      <path d="m6 20 3-3-3-3"></path>
      <path d="M3 17h6"></path>
    </svg>
  )
}

export function DownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 3v12"></path>
      <path d="m7 10 5 5 5-5"></path>
      <path d="M5 21h14"></path>
    </svg>
  )
}

export function FirstPageIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 6l-6 6 6 6"></path>
      <path d="M6 5v14"></path>
    </svg>
  )
}

export function PreviousPageIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M15 18l-6-6 6-6"></path>
    </svg>
  )
}

export function NextPageIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 6l6 6-6 6"></path>
    </svg>
  )
}

export function LastPageIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 6l6 6-6 6"></path>
      <path d="M18 5v14"></path>
    </svg>
  )
}

export function ProfileMenuIcon({ isOpen = false }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {isOpen ? (
        <path d="M6 14l6-6 6 6"></path>
      ) : (
        <path d="M6 10l6 6 6-6"></path>
      )}
    </svg>
  )
}

export function CameraIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
      <circle cx="12" cy="13" r="4"></circle>
    </svg>
  )
}

export function EditIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 20h9"></path>
      <path d="M16.5 3.5a2.12 2.12 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5Z"></path>
    </svg>
  )
}

export function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 6h18"></path>
      <path d="M8 6V4h8v2"></path>
      <path d="M19 6l-1 14H6L5 6"></path>
      <path d="M10 11v6"></path>
      <path d="M14 11v6"></path>
    </svg>
  )
}

export function SaveIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z"></path>
      <path d="M17 21v-8H7v8"></path>
      <path d="M7 3v5h8"></path>
    </svg>
  )
}

export function PhotoRemoveIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
      <path d="M9 13h6"></path>
    </svg>
  )
}

export function ErrorIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm1 15h-2v-2h2Zm0-4h-2V7h2Z"></path>
    </svg>
  )
}

export function CopyIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="9" y="9" width="13" height="13" rx="2"></rect>
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
    </svg>
  )
}

export function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
      <path d="M20 6L9 17l-5-5"></path>
    </svg>
  )
}

export function AccessTokenIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 2l-2 2"></path>
      <path d="M15.5 5.5l3 3"></path>
      <path d="M11.5 9.5l3 3"></path>
      <path d="M7 14l3 3"></path>
      <circle cx="6" cy="18" r="3"></circle>
      <path d="M9 15L22 2"></path>
    </svg>
  )
}

export function DashboardNameFieldIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M8 9h8" />
      <path d="M8 13h5" />
      <path d="M8 17h8" />
    </svg>
  )
}

export function LastNameFieldIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20 21a8 8 0 0 0-16 0" />
      <circle cx="12" cy="8" r="4" />
      <path d="M16 11h4" />
    </svg>
  )
}

export function FirstNameFieldIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="9" cy="8" r="4" />
      <path d="M2 21a7 7 0 0 1 14 0" />
      <path d="M18 8h4" />
      <path d="M20 6v4" />
    </svg>
  )
}

export function DashboardDeviceFieldIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="7" width="7" height="10" rx="1.5" />
      <rect x="14" y="7" width="7" height="10" rx="1.5" />
      <path d="M6.5 10.5h.01" />
      <path d="M17.5 10.5h.01" />
    </svg>
  )
}

export function DashboardDataKeyFieldIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 7h16" />
      <path d="M4 12h16" />
      <path d="M4 17h10" />
      <circle cx="18" cy="17" r="2" />
    </svg>
  )
}

export function DashboardSourceFileIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <path d="M8 13h8" />
      <path d="M8 17h5" />
    </svg>
  )
}

export function ViewDashboardIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M8 9h8" />
      <path d="M8 13h5" />
      <path d="M16 16l3 3" />
      <circle cx="14" cy="14" r="3" />
    </svg>
  )
}

export function BackDashboardIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M19 12H5" />
      <path d="M12 19l-7-7 7-7" />
    </svg>
  )
}

export function EditModeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" />
    </svg>
  )
}

export function AddWidgetIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M12 8v8" />
      <path d="M8 12h8" />
    </svg>
  )
}

export function CancelEditIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 6 6 18" />
      <path d="M6 6l12 12" />
    </svg>
  )
}

export function DashboardWidgetIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="8" height="7" rx="1.5" />
      <rect x="13" y="4" width="8" height="7" rx="1.5" />
      <rect x="3" y="13" width="8" height="7" rx="1.5" />
      <path d="M15 16h4" />
      <path d="M17 14v4" />
    </svg>
  )
}

export function MoveWidgetIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 3v18" />
      <path d="M3 12h18" />
      <path d="M8 7l4-4 4 4" />
      <path d="M8 17l4 4 4-4" />
      <path d="M7 8l-4 4 4 4" />
      <path d="M17 8l4 4-4 4" />
    </svg>
  )
}

export function LatestTelemetryIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 19V5"></path>
      <path d="M4 19h16"></path>
      <path d="M7.5 15.5l3.2-3.2 2.6 2.6L18 8"></path>
      <path d="M15.5 8H18v2.5"></path>
    </svg>
  )
}