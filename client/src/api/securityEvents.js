import apiClient from './client';

export const getSecurityEvents = async (params = {}) => {
  const { data } = await apiClient.get('/security-events', { params });
  return data;
};

export const getSecurityEventById = async (id) => {
  const { data } = await apiClient.get(`/security-events/${id}`);
  return data;
};

export const updateSecurityEventStatus = async (id, status, resolutionNote = null) => {
  const { data } = await apiClient.patch(`/security-events/${id}/status`, {
    status,
    resolutionNote
  });
  return data;
};

export const getDeviceSecurityEvents = async (deviceId, params = {}) => {
  const { data } = await apiClient.get(`/devices/${deviceId}/security-events`, { params });
  return data;
};
