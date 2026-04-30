import { API_URL } from '../Config/API'
import { getStoredAuthToken } from './authStorage'

export const ACTIVITY_LOG_TYPES = {
  LOGIN: 'login',
  LOGOUT: 'logout',
  DEVICE_ADDED: 'device_added',
  DEVICE_UPDATED: 'device_updated',
  DEVICE_REMOVED: 'device_removed',

  PUMP_ON: 'pump_on',
  PUMP_OFF: 'pump_off',
  LED_ON: 'led_on',
  LED_OFF: 'led_off',
  SERVO_MOVE: 'servo_move',
  TELEMETRY_UPDATE: 'telemetry_update',
  SYSTEM_EVENT: 'system_event',
}

const BACKEND_ACTIVITY_LOG_TYPES = new Set([
  ACTIVITY_LOG_TYPES.LOGIN,
  ACTIVITY_LOG_TYPES.LOGOUT,
  ACTIVITY_LOG_TYPES.DEVICE_ADDED,
  ACTIVITY_LOG_TYPES.DEVICE_UPDATED,
  ACTIVITY_LOG_TYPES.DEVICE_REMOVED,
])

const WIDGET_ACTION_TYPE_MAP = {
  [ACTIVITY_LOG_TYPES.PUMP_ON]: ACTIVITY_LOG_TYPES.DEVICE_UPDATED,
  [ACTIVITY_LOG_TYPES.PUMP_OFF]: ACTIVITY_LOG_TYPES.DEVICE_UPDATED,
  [ACTIVITY_LOG_TYPES.LED_ON]: ACTIVITY_LOG_TYPES.DEVICE_UPDATED,
  [ACTIVITY_LOG_TYPES.LED_OFF]: ACTIVITY_LOG_TYPES.DEVICE_UPDATED,
  [ACTIVITY_LOG_TYPES.SERVO_MOVE]: ACTIVITY_LOG_TYPES.DEVICE_UPDATED,
  [ACTIVITY_LOG_TYPES.TELEMETRY_UPDATE]: ACTIVITY_LOG_TYPES.DEVICE_UPDATED,
  [ACTIVITY_LOG_TYPES.SYSTEM_EVENT]: ACTIVITY_LOG_TYPES.DEVICE_UPDATED,
}

const normalizeActionTypeForBackend = (actionType = '') => {
  const normalizedActionType = String(actionType || '').trim().toLowerCase()

  if (BACKEND_ACTIVITY_LOG_TYPES.has(normalizedActionType)) {
    return normalizedActionType
  }

  return WIDGET_ACTION_TYPE_MAP[normalizedActionType] || ACTIVITY_LOG_TYPES.DEVICE_UPDATED
}

const getWidgetActivityDescription = ({
  actionType = '',
  deviceDescription = '',
  description = '',
  value = null,
} = {}) => {
  const cleanDescription = String(description || '').trim()
  const cleanDeviceDescription = String(deviceDescription || '').trim()

  if (cleanDescription) {
    return cleanDescription
  }

  if (cleanDeviceDescription) {
    return cleanDeviceDescription
  }

  switch (actionType) {
    case ACTIVITY_LOG_TYPES.PUMP_ON:
      return 'Pump was turned ON'
    case ACTIVITY_LOG_TYPES.PUMP_OFF:
      return 'Pump was turned OFF'
    case ACTIVITY_LOG_TYPES.LED_ON:
      return 'LED was turned ON'
    case ACTIVITY_LOG_TYPES.LED_OFF:
      return 'LED was turned OFF'
    case ACTIVITY_LOG_TYPES.SERVO_MOVE:
      return `Servo motor was moved${value !== null ? ` to ${value}°` : ''}`
    case ACTIVITY_LOG_TYPES.TELEMETRY_UPDATE:
      return 'Telemetry data was updated'
    case ACTIVITY_LOG_TYPES.SYSTEM_EVENT:
      return 'System event was recorded'
    default:
      return ''
  }
}

const buildAuthHeaders = () => {
  const token = getStoredAuthToken()

  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

const parseApiResponse = async (response, fallbackMessage) => {
  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(data.message || fallbackMessage)
  }

  return data
}

export const fetchActivityLogs = async ({
  page = 1,
  limit = 15,
  actionType = 'all',
  role = 'all',
  sortBy = 'newest',
  search = '',
} = {}) => {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
    actionType,
    role,
    sortBy,
    search,
  })

  const response = await fetch(`${API_URL}/logs?${params.toString()}`, {
    method: 'GET',
    headers: buildAuthHeaders(),
  })

  return parseApiResponse(response, 'Unable to load logs right now.')
}

export const createActivityLog = async ({
  actionType,
  deviceId = '',
  deviceDescription = '',
  description = '',
  value = null,
  metadata = {},
} = {}) => {
  const token = getStoredAuthToken()

  if (!token) {
    return null
  }

  const backendActionType = normalizeActionTypeForBackend(actionType)

  const finalDeviceDescription = getWidgetActivityDescription({
    actionType,
    deviceDescription,
    description,
    value,
  })

  const response = await fetch(`${API_URL}/logs`, {
    method: 'POST',
    headers: buildAuthHeaders(),
    body: JSON.stringify({
      actionType: backendActionType,
      deviceId,
      deviceDescription: finalDeviceDescription,
      value,
      metadata,
    }),
  })

  return parseApiResponse(response, 'Unable to save the activity log.')
}

export const clearActivityLogs = async () => {
  const response = await fetch(`${API_URL}/logs`, {
    method: 'DELETE',
    headers: buildAuthHeaders(),
  })

  return parseApiResponse(response, 'Unable to clear logs right now.')
}

export const getLocalActivityLogs = () => {
  try {
    const logs = localStorage.getItem('avinya_activity_logs');
    return logs ? JSON.parse(logs) : [];
  } catch (e) {
    console.error('Failed to load local activity logs:', e);
    return [];
  }
};

export const clearLocalActivityLogs = () => {
  try {
    localStorage.removeItem('avinya_activity_logs');
    console.log('Local activity logs cleared');
    return true;
  } catch (e) {
    console.error('Failed to clear local logs:', e);
    return false;
  }
};

export default {
  ACTIVITY_LOG_TYPES,
  fetchActivityLogs,
  createActivityLog,
  clearActivityLogs,
  getLocalActivityLogs,
  clearLocalActivityLogs,
}