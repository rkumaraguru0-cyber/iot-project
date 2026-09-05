import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getDevices, getDeviceStats } from '../api/devices';
import { StatusBadge, HealthBadge, RiskBadge } from '../components/devices/DeviceStatusBadge';
import { RegisterDeviceModal } from '../components/devices/RegisterDeviceModal';
import { StateChangeModal } from '../components/devices/StateChangeModal';
import { Pagination } from '../components/common/Pagination';
import {
  Cpu,
  Plus,
  Search,
  Filter,
  RefreshCw,
  Eye,
  SlidersHorizontal,
  Layers,
  ShieldCheck,
  AlertTriangle
} from 'lucide-react';

const DEVICE_TYPE_LABELS = {
  temperature_sensor: 'Temp Sensor',
  smart_camera: 'Smart Camera',
  industrial_gateway: 'Gateway',
  medical_monitor: 'Medical Mon',
  smart_lock: 'Smart Lock'
};

export const DeviceInventoryPage = () => {
  const { hasRole } = useAuth();
  const navigate = useNavigate();

  const [page, setPage] = useState(1);
  const [limit] = useState(15);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [healthFilter, setHealthFilter] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');

  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [stateModalDevice, setStateModalDevice] = useState(null);

  // Fetch Device Stats
  const { data: stats, refetch: refetchStats } = useQuery({
    queryKey: ['device-stats'],
    queryFn: getDeviceStats
  });

  // Fetch Devices with filters
  const {
    data: deviceData,
    isLoading,
    isFetching,
    refetch: refetchDevices
  } = useQuery({
    queryKey: ['devices', { page, limit, search, typeFilter, statusFilter, healthFilter, sortBy, sortOrder }],
    queryFn: () =>
      getDevices({
        page,
        limit,
        search: search || undefined,
        type: typeFilter || undefined,
        status: statusFilter || undefined,
        healthStatus: healthFilter || undefined,
        sortBy,
        sortOrder
      })
  });

  const handleRefresh = () => {
    refetchStats();
    refetchDevices();
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-white tracking-tight flex items-center gap-2.5">
            <Cpu className="w-6 h-6 text-indigo-400" />
            Device Fleet Inventory
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Monitor, provision, and control IoT hardware lifecycle states
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleRefresh}
            disabled={isFetching}
            className="p-2.5 bg-slate-900 border border-slate-800 text-slate-300 hover:text-white rounded-xl text-xs font-semibold transition disabled:opacity-50"
            title="Refresh Fleet"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
          </button>

          {hasRole('security_analyst') && (
            <button
              onClick={() => setIsRegisterOpen(true)}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-indigo-600/20 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Register Device
            </button>
          )}
        </div>
      </div>

      {/* Stats Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Total Fleet</span>
            <Layers className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-black text-white">{stats?.total ?? 0}</div>
          <div className="text-[11px] text-slate-500 mt-1">
            {stats?.byStatus?.active ?? 0} Active • {stats?.byStatus?.registered ?? 0} Pending
          </div>
        </div>

        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Healthy Status</span>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-emerald-400">{stats?.byHealth?.healthy ?? 0}</div>
          <div className="text-[11px] text-slate-500 mt-1">
            {stats?.byHealth?.degraded ?? 0} Degraded • {stats?.byHealth?.offline ?? 0} Offline
          </div>
        </div>

        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Quarantined</span>
            <AlertTriangle className="w-4 h-4 text-red-400" />
          </div>
          <div className="text-2xl font-black text-red-400">{stats?.byStatus?.quarantined ?? 0}</div>
          <div className="text-[11px] text-slate-500 mt-1">
            {stats?.byStatus?.maintenance ?? 0} In Maintenance
          </div>
        </div>

        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Elevated Risk</span>
            <AlertTriangle className="w-4 h-4 text-orange-400" />
          </div>
          <div className="text-2xl font-black text-orange-400">
            {(stats?.byRisk?.critical ?? 0) + (stats?.byRisk?.severe ?? 0) + (stats?.byRisk?.high ?? 0)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {stats?.byRisk?.low ?? 0} Secure • {stats?.byRisk?.medium ?? 0} Caution
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
          {/* Search */}
          <div className="relative md:col-span-2">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search by device name..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value);
              setPage(1);
            }}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:border-indigo-500 focus:outline-none"
          >
            <option value="">All Device Types</option>
            <option value="temperature_sensor">Temperature Sensor</option>
            <option value="smart_camera">Smart Camera</option>
            <option value="industrial_gateway">Industrial Gateway</option>
            <option value="medical_monitor">Medical Monitor</option>
            <option value="smart_lock">Smart Lock</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:border-indigo-500 focus:outline-none"
          >
            <option value="">All Lifecycle States</option>
            <option value="registered">Registered</option>
            <option value="active">Active</option>
            <option value="maintenance">Maintenance</option>
            <option value="quarantined">Quarantined</option>
            <option value="decommissioned">Decommissioned</option>
          </select>

          {/* Health Filter */}
          <select
            value={healthFilter}
            onChange={(e) => {
              setHealthFilter(e.target.value);
              setPage(1);
            }}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:border-indigo-500 focus:outline-none"
          >
            <option value="">All Health Statuses</option>
            <option value="healthy">Healthy</option>
            <option value="degraded">Degraded</option>
            <option value="offline">Offline</option>
            <option value="unknown">Unknown</option>
          </select>
        </div>
      </div>

      {/* Main Device Table */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800 text-[11px]">
              <tr>
                <th className="px-6 py-3.5">Device Identity</th>
                <th className="px-6 py-3.5">Type & Model</th>
                <th className="px-6 py-3.5">State</th>
                <th className="px-6 py-3.5">Health</th>
                <th className="px-6 py-3.5">Risk Posture</th>
                <th className="px-6 py-3.5">Firmware</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {isLoading ? (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                      <span>Loading fleet hardware records...</span>
                    </div>
                  </td>
                </tr>
              ) : !deviceData?.devices || deviceData.devices.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-16 text-center text-slate-500">
                    <Cpu className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p className="font-semibold text-slate-300">No devices registered</p>
                    <p className="text-xs text-slate-500 mt-1">
                      Register your first IoT hardware device to begin monitoring.
                    </p>
                  </td>
                </tr>
              ) : (
                deviceData.devices.map((device) => (
                  <tr key={device._id || device.id} className="hover:bg-slate-800/40 transition">
                    <td className="px-6 py-4">
                      <div className="font-bold text-white hover:text-indigo-400 cursor-pointer transition"
                        onClick={() => navigate(`/devices/${device._id || device.id}`)}
                      >
                        {device.name}
                      </div>
                      <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                        {device.deviceId}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-slate-200 font-medium">
                        {DEVICE_TYPE_LABELS[device.type] || device.type}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {device.manufacturer} • {device.model}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={device.status} />
                    </td>
                    <td className="px-6 py-4">
                      <HealthBadge healthStatus={device.healthStatus} />
                    </td>
                    <td className="px-6 py-4">
                      <RiskBadge riskScore={device.riskScore} riskSeverity={device.riskSeverity} />
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-slate-300">
                      {device.currentFirmwareVersion || '—'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => navigate(`/devices/${device._id || device.id}`)}
                          className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {hasRole('operator') && device.status !== 'decommissioned' && (
                          <button
                            onClick={() => setStateModalDevice(device)}
                            className="p-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 rounded-lg transition border border-indigo-500/30 text-xs font-semibold"
                            title="Change State"
                          >
                            <SlidersHorizontal className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Component */}
        <Pagination
          page={deviceData?.page || 1}
          limit={deviceData?.limit || limit}
          total={deviceData?.total || 0}
          onPageChange={(newPage) => setPage(newPage)}
        />
      </div>

      {/* Registration Modal */}
      <RegisterDeviceModal
        isOpen={isRegisterOpen}
        onClose={() => setIsRegisterOpen(false)}
        onSuccess={() => handleRefresh()}
      />

      {/* Lifecycle Transition Modal */}
      <StateChangeModal
        isOpen={!!stateModalDevice}
        device={stateModalDevice}
        onClose={() => setStateModalDevice(null)}
        onSuccess={() => handleRefresh()}
      />
    </div>
  );
};

export default DeviceInventoryPage;
