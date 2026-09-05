import apiClient from './client';

export const getRules = async (params = {}) => {
  const { data } = await apiClient.get('/rules', { params });
  return data;
};

export const getRuleById = async (id) => {
  const { data } = await apiClient.get(`/rules/${id}`);
  return data;
};

export const createRule = async (ruleData) => {
  const { data } = await apiClient.post('/rules', ruleData);
  return data;
};

export const updateRule = async (id, updateData) => {
  const { data } = await apiClient.patch(`/rules/${id}`, updateData);
  return data;
};

export const deleteRule = async (id) => {
  const { data } = await apiClient.delete(`/rules/${id}`);
  return data;
};

export const testRule = async (testPayload) => {
  const { data } = await apiClient.post('/rules/test', testPayload);
  return data;
};
