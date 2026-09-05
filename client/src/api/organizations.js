import apiClient from './client';

export const getCurrentOrganization = async () => {
  const { data } = await apiClient.get('/organizations/current');
  return data;
};

export const updateCurrentOrganization = async (orgData) => {
  const { data } = await apiClient.patch('/organizations/current', orgData);
  return data;
};

export const createOrganization = async (orgData) => {
  const { data } = await apiClient.post('/organizations', orgData);
  return data;
};
