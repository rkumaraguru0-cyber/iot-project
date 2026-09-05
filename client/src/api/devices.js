import apiClient from './client';

export const getDevices = async (params = {}) => {
  const { data } = await apiClient.get('/devices', { params });
  return data;
};

export const getDeviceStats = async () => {
  const { data } = await apiClient.get('/devices/stats');
  return data;
};

export const getDeviceById = async (id) => {
  const { data } = await apiClient.get(`/devices/${id}`);
  return data;
};

export const registerDevice = async (deviceData) => {
  const { data } = await apiClient.post('/devices', deviceData);
  return data;
};

export const updateDevice = async (id, updateData) => {
  const { data } = await apiClient.patch(`/devices/${id}`, updateData);
  return data;
};

export const regenerateDeviceApiKey = async (id) => {
  const { data } = await apiClient.post(`/devices/${id}/regenerate-key`);
  return data;
};

export const getDeviceRisk = async (id) => {
  const { data } = await apiClient.get(`/devices/${id}/risk`);
  return data;
};
