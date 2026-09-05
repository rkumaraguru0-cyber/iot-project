import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { DeviceInventoryPage } from './pages/DeviceInventoryPage';
import { DeviceDetailPage } from './pages/DeviceDetailPage';
import { UserManagementPage } from './pages/UserManagementPage';
import { SettingsPage } from './pages/SettingsPage';
import { RulesPage } from './pages/RulesPage';

export const App = () => {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/login" element={<LoginPage />} />

      {/* Protected SOC Application Shell */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/devices" replace />} />
        <Route path="devices" element={<DeviceInventoryPage />} />
        <Route path="devices/:id" element={<DeviceDetailPage />} />
        <Route path="rules" element={<RulesPage />} />
        <Route path="users" element={<UserManagementPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>

      {/* Fallback route */}
      <Route path="*" element={<Navigate to="/devices" replace />} />
    </Routes>
  );
};

export default App;
