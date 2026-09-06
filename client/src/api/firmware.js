import apiClient from './client';

export const getFirmwareVersions = async (params = {}) => {
  const { data } = await apiClient.get('/firmware/versions', { params });
  return data;
};

export const getFirmwareVersionById = async (id) => {
  const { data } = await apiClient.get(`/firmware/versions/${id}`);
  return data;
};

export const createFirmwareVersion = async (formData) => {
  const { data } = await apiClient.post('/firmware/versions', formData);
  return data;
};

export const updateFirmwareVersion = async (id, updateData) => {
  const { data } = await apiClient.patch(`/firmware/versions/${id}`, updateData);
  return data;
};

export const getDeployments = async (params = {}) => {
  const { data } = await apiClient.get('/firmware/deployments', { params });
  return data;
};

export const getDeploymentById = async (id) => {
  const { data } = await apiClient.get(`/firmware/deployments/${id}`);
  return data;
};

export const createDeployments = async (deploymentData) => {
  const { data } = await apiClient.post('/firmware/deployments', deploymentData);
  return data;
};

export const updateDeploymentStatus = async (id, statusData) => {
  const { data } = await apiClient.patch(`/firmware/deployments/${id}/status`, statusData);
  return data;
};
