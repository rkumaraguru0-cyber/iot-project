import apiClient, { setAccessToken } from './client';

export const login = async (email, password) => {
  const { data } = await apiClient.post('/auth/login', { email, password });
  setAccessToken(data.accessToken);
  return data;
};

export const logout = async () => {
  try {
    await apiClient.post('/auth/logout');
  } finally {
    setAccessToken(null);
  }
};

export const refreshSession = async () => {
  const { data } = await apiClient.post('/auth/refresh');
  setAccessToken(data.accessToken);
  return data;
};

export const getMe = async () => {
  const { data } = await apiClient.get('/auth/me');
  return data.user;
};
