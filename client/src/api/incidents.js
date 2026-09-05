import apiClient from './client';

export const getIncidents = async (params = {}) => {
  const { data } = await apiClient.get('/incidents', { params });
  return data;
};

export const getIncidentStats = async () => {
  const { data } = await apiClient.get('/incidents/stats');
  return data;
};

export const getIncidentById = async (id) => {
  const { data } = await apiClient.get(`/incidents/${id}`);
  return data;
};

export const updateIncidentStatus = async (id, status, note = null) => {
  const { data } = await apiClient.patch(`/incidents/${id}/status`, { status, note });
  return data;
};

export const assignIncident = async (id, assignedTo) => {
  const { data } = await apiClient.patch(`/incidents/${id}/assign`, { assignedTo });
  return data;
};

export const addIncidentNote = async (id, content) => {
  const { data } = await apiClient.post(`/incidents/${id}/notes`, { content });
  return data;
};

export const recordResponseAction = async (id, action, details) => {
  const { data } = await apiClient.post(`/incidents/${id}/actions`, { action, details });
  return data;
};

export const addIncidentEvidence = async (id, evidenceData) => {
  const { data } = await apiClient.post(`/incidents/${id}/evidence`, evidenceData);
  return data;
};

export const resolveIncident = async (id, resolutionData) => {
  const { data } = await apiClient.post(`/incidents/${id}/resolve`, resolutionData);
  return data;
};

export const getDeviceIncidents = async (deviceId, params = {}) => {
  const { data } = await apiClient.get(`/devices/${deviceId}/incidents`, { params });
  return data;
};
