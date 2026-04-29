export const DEVICES_WIDGET_STORAGE_KEY = 'avinya_devices';

export const syncDevicesForDashboardWidgets = (devices = []) => {
  const widgetDevices = devices.map((device) => ({
    id: device.thingsboardDeviceId || device.deviceUid,
    label: device.deviceUid,
    description: device.description || '',
  }));

  const payload = {
    devices: widgetDevices,
    defaultId: widgetDevices[0]?.id || null,
  };

  try {
    localStorage.setItem(DEVICES_WIDGET_STORAGE_KEY, JSON.stringify(payload));
  } catch {
  }

  return payload;
};