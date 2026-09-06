import apiClient from './client';

export const getAuditLogs = async (params = {}) => {
  const { data } = await apiClient.get('/audit-logs', { params });
  return data;
};
