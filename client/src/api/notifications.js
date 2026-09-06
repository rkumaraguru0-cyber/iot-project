import apiClient from './client';

export const getNotifications = async (params = {}) => {
  const { data } = await apiClient.get('/notifications', { params });
  return data;
};

export const getUnreadCount = async () => {
  const { data } = await apiClient.get('/notifications/unread-count');
  return data;
};

export const markNotificationRead = async (id) => {
  const { data } = await apiClient.patch(`/notifications/${id}/read`);
  return data;
};

export const markAllNotificationsRead = async () => {
  const { data } = await apiClient.patch('/notifications/read-all');
  return data;
};
