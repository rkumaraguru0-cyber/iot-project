import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Layout } from './components/Layout';
import { SocketProvider } from './contexts/SocketContext';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { DeviceInventoryPage } from './pages/DeviceInventoryPage';
import { DeviceDetailPage } from './pages/DeviceDetailPage';
import { SecurityEventsPage } from './pages/SecurityEventsPage';
import { IncidentsPage } from './pages/IncidentsPage';
import { IncidentDetailPage } from './pages/IncidentDetailPage';
import { FirmwarePage } from './pages/FirmwarePage';
import { RulesPage } from './pages/RulesPage';
import { AuditLogPage } from './pages/AuditLogPage';
import { UserManagementPage } from './pages/UserManagementPage';
import { SettingsPage } from './pages/SettingsPage';

export const App = () => {
  return (
    <SocketProvider>
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
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="devices" element={<DeviceInventoryPage />} />
          <Route path="devices/:id" element={<DeviceDetailPage />} />
          <Route path="security-events" element={<SecurityEventsPage />} />
          <Route path="incidents" element={<IncidentsPage />} />
          <Route path="incidents/:id" element={<IncidentDetailPage />} />
          <Route path="firmware" element={<FirmwarePage />} />
          <Route path="rules" element={<RulesPage />} />
          <Route path="audit-logs" element={<AuditLogPage />} />
          <Route path="users" element={<UserManagementPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>

        {/* Fallback route */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </SocketProvider>
  );
};

export default App;
