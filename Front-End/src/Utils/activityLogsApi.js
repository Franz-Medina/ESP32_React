import { API_URL } from '../Config/API'
import { getStoredAuthToken } from './authStorage'

export const ACTIVITY_LOG_TYPES = {
  LOGIN: 'login',
  LOGOUT: 'logout',
  DEVICE_ADDED: 'device_added',
  DEVICE_REMOVED: 'device_removed',
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
} = {}) => {
  const token = getStoredAuthToken()

  if (!token) {
    return null
  }

  const response = await fetch(`${API_URL}/logs`, {
    method: 'POST',
    headers: buildAuthHeaders(),
    body: JSON.stringify({
      actionType,
      deviceId,
      deviceDescription,
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