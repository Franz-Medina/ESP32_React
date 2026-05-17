import { API_URL } from '../Config/API';
import { getStoredAuthToken } from './authStorage';

const buildDevicesAuthHeaders = () => {
  const token = getStoredAuthToken();

  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

const parseDevicesApiResponse = async (response, fallbackMessage) => {
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || fallbackMessage);
  }

  return data;
};

export const fetchDevices = async () => {
  const response = await fetch(`${API_URL}/devices`, {
    method: 'GET',
    headers: buildDevicesAuthHeaders(),
  });

  return parseDevicesApiResponse(response, 'Unable to load devices right now.');
};

export const resolveThingsBoardDeviceByName = async (deviceName) => {
  const params = new URLSearchParams({
    deviceName,
  });

  const response = await fetch(`${API_URL}/thingsboard/devices/resolve?${params.toString()}`, {
    method: 'GET',
    headers: buildDevicesAuthHeaders(),
  });

  return parseDevicesApiResponse(response, 'Unable to connect this device right now.');
};

export const createDevice = async ({ deviceName }) => {
  const response = await fetch(`${API_URL}/devices`, {
    method: 'POST',
    headers: buildDevicesAuthHeaders(),
    body: JSON.stringify({
      deviceName,
    }),
  });

  return parseDevicesApiResponse(response, 'Unable to add device right now.');
};

export const updateDevice = async (deviceId, { deviceName }) => {
  const response = await fetch(`${API_URL}/devices/${deviceId}`, {
    method: 'PUT',
    headers: buildDevicesAuthHeaders(),
    body: JSON.stringify({
      deviceName,
    }),
  });

  return parseDevicesApiResponse(response, 'Unable to update device right now.');
};

export const fetchDeviceAccessToken = async (deviceId) => {
  const response = await fetch(`${API_URL}/devices/${deviceId}/access-token`, {
    method: 'GET',
    headers: buildDevicesAuthHeaders(),
  });

  return parseDevicesApiResponse(response, 'Unable to load access token right now.');
};

export const fetchDeviceLatestTelemetry = async (deviceId) => {
  const response = await fetch(`${API_URL}/devices/${deviceId}/latest-telemetry`, {
    method: 'GET',
    headers: buildDevicesAuthHeaders(),
  });

  return parseDevicesApiResponse(response, 'Unable to load latest telemetry right now.');
};

export const deleteDeviceById = async (deviceId) => {
  const response = await fetch(`${API_URL}/devices/${deviceId}`, {
    method: 'DELETE',
    headers: buildDevicesAuthHeaders(),
  });

  return parseDevicesApiResponse(response, 'Unable to delete device right now.');
};