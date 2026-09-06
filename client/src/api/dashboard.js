import apiClient from './client';

export const getDashboardSummary = async () => {
  const { data } = await apiClient.get('/dashboard/summary');
  return data;
};

export const getDashboardTrends = async (params = { days: 7 }) => {
  const { data } = await apiClient.get('/dashboard/trends', { params });
  return data;
};
