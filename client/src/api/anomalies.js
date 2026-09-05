import apiClient from './client';

export const getAnomalies = async (params = {}) => {
  const { data } = await apiClient.get('/anomalies', { params });
  return data;
};

export const getDeviceAnomalies = async (deviceId, params = {}) => {
  const { data } = await apiClient.get(`/devices/${deviceId}/anomalies`, { params });
  return data;
};
