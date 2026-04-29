import { API_URL } from '../Config/API';
import { getStoredAuthToken } from './authStorage';
import { getCurrentUserProfile } from './getCurrentUserProfile';

export const ACTIVITY_LOG_TYPES = {
  LOGIN: 'login',
  LOGOUT: 'logout',
  DEVICE_ADDED: 'device_added',
  DEVICE_REMOVED: 'device_removed',
  PUMP_ON: 'pump_on',
  PUMP_OFF: 'pump_off',
  LED_ON: 'led_on',
  LED_OFF: 'led_off',
  SERVO_MOVE: 'servo_move',
  TELEMETRY_UPDATE: 'telemetry_update',
  SYSTEM_EVENT: 'system_event',
};

const buildAuthHeaders = () => {
  const token = getStoredAuthToken();

  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

const parseApiResponse = async (response, fallbackMessage) => {
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || fallbackMessage);
  }

  return data;
};

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
  });

  const response = await fetch(`${API_URL}/logs?${params.toString()}`, {
    method: 'GET',
    headers: buildAuthHeaders(),
  });

  return parseApiResponse(response, 'Unable to load logs right now.');
};

export const clearActivityLogs = async () => {
  const response = await fetch(`${API_URL}/logs`, {
    method: 'DELETE',
    headers: buildAuthHeaders(),
  });

  return parseApiResponse(response, 'Unable to clear logs right now.');
};

export const createActivityLog = async ({
  actionType,
  deviceId = '',
  deviceDescription = '',
  value = null,
  description = '',
  metadata = {},
} = {}) => {
  const token = getStoredAuthToken();
  const user = getCurrentUserProfile();

  const logPayload = {
    actionType,
    deviceId,
    deviceDescription,
    value,
    description: description || `${actionType.replace('_', ' ')}`,
    userName: user?.fullName || 'Unknown User',
    userRole: user?.roleLabel || '',
    timestamp: new Date().toISOString(),
    metadata,
  };

  try {
    if (token && API_URL) {
      const response = await fetch(`${API_URL}/logs`, {
        method: 'POST',
        headers: buildAuthHeaders(),
        body: JSON.stringify(logPayload),
      });

      if (response.ok) {
        console.log(`Activity logged to backend: ${actionType}`);
        return await parseApiResponse(response, 'Log saved');
      }
    }
  } catch (backendError) {
    console.warn('Backend logging failed, falling back to localStorage:', backendError);
  }

  try {
    const existingLogs = JSON.parse(localStorage.getItem('avinya_activity_logs') || '[]');
    
    const localLog = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
      timestamp: new Date().toISOString(),
      ...logPayload,
    };

    const updatedLogs = [localLog, ...existingLogs].slice(0, 1000);
    localStorage.setItem('avinya_activity_logs', JSON.stringify(updatedLogs));

    console.log(`📝 Activity logged locally: ${actionType}`);
    return localLog;
  } catch (localError) {
    console.error('Failed to save activity log locally:', localError);
    return null;
  }
};

export const getLocalActivityLogs = () => {
  try {
    const logs = localStorage.getItem('avinya_activity_logs');
    return logs ? JSON.parse(logs) : [];
  } catch (e) {
    console.error('Failed to load local logs:', e);
    return [];
  }
};

export const clearLocalActivityLogs = () => {
  try {
    localStorage.removeItem('avinya_activity_logs');
    console.log('🗑️ Local activity logs cleared');
    return true;
  } catch (e) {
    console.error('Failed to clear local logs:', e);
    return false;
  }
};

export default {
  ACTIVITY_LOG_TYPES,
  createActivityLog,
  fetchActivityLogs,
  clearActivityLogs,
  getLocalActivityLogs,
  clearLocalActivityLogs,
};