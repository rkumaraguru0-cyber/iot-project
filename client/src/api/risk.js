import apiClient from './client';

export const getDeviceRisk = async (deviceId) => {
  const { data } = await apiClient.get(`/devices/${deviceId}/risk`);
  return data;
};

export const getFleetRiskSummary = async () => {
  const { data } = await apiClient.get('/risk/summary');
  return data.summary;
};
