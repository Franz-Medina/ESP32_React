import { API_URL } from '../Config/API'
import { getStoredAuthToken } from './authStorage'

const buildThingsBoardHeaders = () => {
  const token = getStoredAuthToken()

  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

const parseThingsBoardResponse = async (response, fallbackMessage) => {
  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(data.message || fallbackMessage)
  }

  return data
}

const normalizeKeys = (keys) =>
  Array.isArray(keys) ? keys.join(',') : String(keys || '').trim()

export const fetchLatestTelemetry = async ({ deviceId, keys }) => {
  const params = new URLSearchParams({
    deviceId,
    keys: normalizeKeys(keys),
  })

  const response = await fetch(`${API_URL}/thingsboard/telemetry/latest?${params.toString()}`, {
    method: 'GET',
    headers: buildThingsBoardHeaders(),
  })

  return parseThingsBoardResponse(response, 'Unable to load telemetry.')
}

export const fetchTelemetryHistory = async ({
  deviceId,
  keys,
  startTs,
  endTs,
  limit = 50,
}) => {
  const params = new URLSearchParams({
    deviceId,
    keys: normalizeKeys(keys),
    startTs: String(startTs),
    endTs: String(endTs),
    limit: String(limit),
  })

  const response = await fetch(`${API_URL}/thingsboard/telemetry/history?${params.toString()}`, {
    method: 'GET',
    headers: buildThingsBoardHeaders(),
  })

  return parseThingsBoardResponse(response, 'Unable to load telemetry history.')
}

export const sendOneWayRpc = async ({ deviceId, method, params }) => {
  const response = await fetch(`${API_URL}/thingsboard/rpc`, {
    method: 'POST',
    headers: buildThingsBoardHeaders(),
    body: JSON.stringify({
      deviceId,
      method,
      params,
    }),
  })

  return parseThingsBoardResponse(response, 'Unable to send command.')
}

export const fetchThingsBoardCounts = async () => {
  const response = await fetch(`${API_URL}/thingsboard/counts`, {
    method: 'GET',
    headers: buildThingsBoardHeaders(),
  })

  return parseThingsBoardResponse(response, 'Unable to load counts.')
}

export const fetchThingsBoardEntities = async () => {
  const response = await fetch(`${API_URL}/thingsboard/entities`, {
    method: 'GET',
    headers: buildThingsBoardHeaders(),
  })

  return parseThingsBoardResponse(response, 'Unable to load entities.')
}