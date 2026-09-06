import React, { useState, useEffect, useCallback } from 'react';
import { getDashboardSummary, getDashboardTrends } from '../api/dashboard';
import { useSocket } from '../hooks/useSocket';
import { RefreshCw, LayoutDashboard, Shield, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

// 10 Dashboard Widgets (W1–W10)
import FleetPostureWidget from '../components/dashboard/FleetPostureWidget';
import ActiveIncidentsWidget from '../components/dashboard/ActiveIncidentsWidget';
import SlaComplianceWidget from '../components/dashboard/SlaComplianceWidget';
import CriticalEventsWidget from '../components/dashboard/CriticalEventsWidget';
import DeviceHealthWidget from '../components/dashboard/DeviceHealthWidget';
import RiskDistributionWidget from '../components/dashboard/RiskDistributionWidget';
import AnomalyTrendWidget from '../components/dashboard/AnomalyTrendWidget';
import FirmwareExposureWidget from '../components/dashboard/FirmwareExposureWidget';
import TopRiskDevicesWidget from '../components/dashboard/TopRiskDevicesWidget';
import LiveEventsWidget from '../components/dashboard/LiveEventsWidget';

export const DashboardPage = () => {
  const [summary, setSummary] = useState(null);
  const [trends, setTrends] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState(new Date());

  const { subscribe } = useSocket();

  const fetchDashboardData = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setIsRefreshing(true);
      const [summaryRes, trendsRes] = await Promise.all([
        getDashboardSummary(),
        getDashboardTrends({ days: 7 })
      ]);
      setSummary(summaryRes);
      setTrends(trendsRes);
      setLastRefreshed(new Date());
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
      if (!isSilent) {
        toast.error('Failed to update dashboard metrics');
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // Initial load and 60-second polling interval
  useEffect(() => {
    fetchDashboardData();

    const intervalId = setInterval(() => {
      fetchDashboardData(true);
    }, 60000); // Exact 60-second polling contract

    return () => clearInterval(intervalId);
  }, [fetchDashboardData]);

  // Real-time invalidation via Socket.IO domain events
  useEffect(() => {
    const unsub1 = subscribe('incident:new', () => fetchDashboardData(true));
    const unsub2 = subscribe('incident:updated', () => fetchDashboardData(true));
    const unsub3 = subscribe('device:status-changed', () => fetchDashboardData(true));
    const unsub4 = subscribe('device:risk-escalated', () => fetchDashboardData(true));

    return () => {
      unsub1();
      unsub2();
      unsub3();
      unsub4();
    };
  }, [subscribe, fetchDashboardData]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Header & Refresh Control */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800/80">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-white flex items-center gap-2.5">
            <LayoutDashboard className="w-5 h-5 text-indigo-400" />
            Security Posture & Operations Dashboard
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-time IoT fleet security overview, threat posture, and incident telemetry.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-[11px] font-mono text-slate-500">
            Updated: {lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </div>
          <button
            onClick={() => fetchDashboardData(false)}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 hover:border-slate-600 text-xs font-semibold text-slate-200 transition disabled:opacity-50"
            title="Refresh dashboard metrics"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-indigo-400 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Row 1: High-level KPI Cards (W1, W2, W3, W5) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <FleetPostureWidget data={summary?.fleetPosture} isLoading={isLoading} />
        <ActiveIncidentsWidget data={summary?.activeIncidents} isLoading={isLoading} />
        <SlaComplianceWidget data={summary?.slaCompliance} isLoading={isLoading} />
        <DeviceHealthWidget data={summary?.deviceHealth} isLoading={isLoading} />
      </div>

      {/* Row 2: Fleet Risk & Vulnerability Exposure (W6, W8) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <RiskDistributionWidget data={summary?.riskDistribution} isLoading={isLoading} />
        <FirmwareExposureWidget data={summary?.firmwareExposure} isLoading={isLoading} />
      </div>

      {/* Row 3: Events & Threat Trends (W4, W7) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CriticalEventsWidget data={summary?.criticalEvents} isLoading={isLoading} />
        <AnomalyTrendWidget data={trends} isLoading={isLoading} />
      </div>

      {/* Row 4: Fleet Prioritization & Real-Time Stream (W9, W10) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TopRiskDevicesWidget data={summary?.topRiskDevices} isLoading={isLoading} />
        <LiveEventsWidget />
      </div>
    </div>
  );
};

export default DashboardPage;
