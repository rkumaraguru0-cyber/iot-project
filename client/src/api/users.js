import apiClient from './client';

export const getUsers = async (params = {}) => {
  const { data } = await apiClient.get('/users', { params });
  return data;
};

export const getUserById = async (id) => {
  const { data } = await apiClient.get(`/users/${id}`);
  return data;
};

export const inviteUser = async (userData) => {
  const { data } = await apiClient.post('/users/invite', userData);
  return data;
};

export const updateUser = async (id, updateData) => {
  const { data } = await apiClient.patch(`/users/${id}`, updateData);
  return data;
};

export const updateProfile = async (profileData) => {
  const { data } = await apiClient.patch('/users/me', profileData);
  return data;
};

export const changePassword = async (passwordData) => {
  const { data } = await apiClient.patch('/users/me/password', passwordData);
  return data;
};
