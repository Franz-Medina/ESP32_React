import { API_URL } from '../Config/API'
import { getStoredAuthToken } from './authStorage'

const buildDashboardAuthHeaders = () => {
  const token = getStoredAuthToken()

  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

const parseDashboardApiResponse = async (response, fallbackMessage) => {
  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(data.message || fallbackMessage)
  }

  return data
}

const getDashboardListQueryParams = ({
  search = '',
  assignedUserId = 'all',
  deviceId = 'all',
  sortBy = 'newest',
} = {}) => {
  const params = new URLSearchParams()

  const normalizedSearch = String(search || '').trim()
  const normalizedAssignedUserId = String(assignedUserId || 'all').trim()
  const normalizedDeviceId = String(deviceId || 'all').trim()
  const normalizedSortBy = String(sortBy || 'newest').trim()

  if (normalizedSearch) params.set('search', normalizedSearch)
  if (normalizedAssignedUserId !== 'all') params.set('assignedUserId', normalizedAssignedUserId)
  if (normalizedDeviceId !== 'all') params.set('deviceId', normalizedDeviceId)
  if (normalizedSortBy) params.set('sortBy', normalizedSortBy)

  return params
}

export const fetchDashboards = async (filters = {}) => {
  const params = getDashboardListQueryParams(filters)
  const queryString = params.toString()

  const response = await fetch(
    `${API_URL}/dashboards${queryString ? `?${queryString}` : ''}`,
    {
      method: 'GET',
      headers: buildDashboardAuthHeaders(),
    }
  )

  return parseDashboardApiResponse(response, 'Unable to load dashboards right now.')
}

export const fetchDashboardOptions = async () => {
  const response = await fetch(`${API_URL}/dashboards/options`, {
    method: 'GET',
    headers: buildDashboardAuthHeaders(),
  })

  return parseDashboardApiResponse(response, 'Unable to load dashboard options right now.')
}

export const createDashboard = async ({
  dashboardName,
  assignedUserId,
  deviceId,
}) => {
  const response = await fetch(`${API_URL}/dashboards`, {
    method: 'POST',
    headers: buildDashboardAuthHeaders(),
    body: JSON.stringify({
      dashboardName,
      assignedUserId,
      deviceId,
    }),
  })

  return parseDashboardApiResponse(response, 'Unable to add dashboard right now.')
}

export const updateDashboard = async (
  dashboardId,
  {
    dashboardName,
    assignedUserId,
    deviceId,
  }
) => {
  const response = await fetch(`${API_URL}/dashboards/${dashboardId}`, {
    method: 'PUT',
    headers: buildDashboardAuthHeaders(),
    body: JSON.stringify({
      dashboardName,
      assignedUserId,
      deviceId,
    }),
  })

  return parseDashboardApiResponse(response, 'Unable to update dashboard right now.')
}

export const deleteDashboardById = async (dashboardId) => {
  const response = await fetch(`${API_URL}/dashboards/${dashboardId}`, {
    method: 'DELETE',
    headers: buildDashboardAuthHeaders(),
  })

  return parseDashboardApiResponse(response, 'Unable to delete dashboard right now.')
}

export const fetchCurrentDashboard = async (deviceId = '') => {
  const params = new URLSearchParams()
  const normalizedDeviceId = String(deviceId || '').trim()

  if (normalizedDeviceId) {
    params.set('deviceId', normalizedDeviceId)
  }

  const queryString = params.toString()

  const response = await fetch(
    `${API_URL}/dashboards/current${queryString ? `?${queryString}` : ''}`,
    {
      method: 'GET',
      headers: buildDashboardAuthHeaders(),
    }
  )

  return parseDashboardApiResponse(response, 'Unable to load current dashboard right now.')
}

export const fetchDashboardWidgets = async (dashboardId) => {
  const response = await fetch(`${API_URL}/dashboards/${dashboardId}/widgets`, {
    method: 'GET',
    headers: buildDashboardAuthHeaders(),
  })

  return parseDashboardApiResponse(response, 'Unable to load dashboard widgets right now.')
}

export const validateDashboardWidget = async (
  dashboardId,
  {
    widgetKey,
    widgetName,
    dataKey,
    inoFileName,
    inoFileContent,
  }
) => {
  const response = await fetch(`${API_URL}/dashboards/${dashboardId}/widgets/validate`, {
    method: 'POST',
    headers: buildDashboardAuthHeaders(),
    body: JSON.stringify({
      widgetKey,
      widgetName,
      dataKey,
      inoFileName,
      inoFileContent,
    }),
  })

  return parseDashboardApiResponse(response, 'Unable to validate widget right now.')
}

export const saveDashboardWidgets = async (dashboardId, widgets = []) => {
  const response = await fetch(`${API_URL}/dashboards/${dashboardId}/widgets`, {
    method: 'PUT',
    headers: buildDashboardAuthHeaders(),
    body: JSON.stringify({ widgets }),
  })

  return parseDashboardApiResponse(response, 'Unable to save dashboard widgets right now.')
}