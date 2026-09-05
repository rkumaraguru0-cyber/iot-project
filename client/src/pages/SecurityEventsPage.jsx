import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ShieldAlert,
  Search,
  Filter,
  RefreshCw,
  SlidersHorizontal,
  CheckCircle,
  AlertTriangle,
  Clock
} from 'lucide-react';
import { getSecurityEvents } from '../api/securityEvents';
import { getFleetRiskSummary } from '../api/risk';
import { SecurityEventCard } from '../components/events/SecurityEventCard';
import { SecurityEventDetailModal } from '../components/events/SecurityEventDetailModal';
import { FleetRiskSummaryCard } from '../components/risk/FleetRiskSummaryCard';
import { Pagination } from '../components/common/Pagination';

const STATUS_TABS = [
  { id: '', label: 'All Events' },
  { id: 'open', label: 'Open' },
  { id: 'acknowledged', label: 'Acknowledged' },
  { id: 'resolved', label: 'Resolved' },
  { id: 'false_positive', label: 'False Positive' }
];

export const SecurityEventsPage = () => {
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [limit] = useState(12);
  const [statusFilter, setStatusFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [search, setSearch] = useState('');
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // Fetch Fleet Risk Summary
  const {
    data: riskSummaryData,
    isLoading: isRiskLoading,
    refetch: refetchRisk
  } = useQuery({
    queryKey: ['fleet-risk-summary'],
    queryFn: getFleetRiskSummary,
    refetchInterval: 15000 // Refresh risk every 15s
  });

  // Fetch Security Events with filters
  const {
    data: eventsData,
    isLoading: isEventsLoading,
    isFetching,
    refetch: refetchEvents
  } = useQuery({
    queryKey: ['security-events', { page, limit, status: statusFilter, severity: severityFilter, search }],
    queryFn: () =>
      getSecurityEvents({
        page,
        limit,
        status: statusFilter || undefined,
        severity: severityFilter || undefined,
        search: search || undefined
      }),
    keepPreviousData: true
  });

  const handleEventClick = (event) => {
    setSelectedEvent(event);
    setIsDetailModalOpen(true);
  };

  const handleStatusUpdated = () => {
    queryClient.invalidateQueries(['security-events']);
    queryClient.invalidateQueries(['fleet-risk-summary']);
    queryClient.invalidateQueries(['devices']);
    setIsDetailModalOpen(false);
    setSelectedEvent(null);
  };

  const handleRefreshAll = () => {
    refetchEvents();
    refetchRisk();
  };

  const events = eventsData?.events || [];
  const pagination = eventsData?.pagination || { total: 0, page: 1, limit };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
            <ShieldAlert className="w-7 h-7 text-indigo-400" />
            Security Events & Risk
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-time security event telemetry, triage workflows, and deterministic risk intelligence
          </p>
        </div>

        <button
          onClick={handleRefreshAll}
          disabled={isFetching || isRiskLoading}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition self-start sm:self-auto border border-slate-700 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching || isRiskLoading ? 'animate-spin' : ''}`} />
          Refresh Data
        </button>
      </div>

      {/* Fleet Risk Summary Card */}
      <FleetRiskSummaryCard
        summary={riskSummaryData?.summary}
        loading={isRiskLoading}
      />

      {/* Filter Tabs & Search Bar */}
      <div className="space-y-4">
        {/* Status Filter Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-slate-800">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setStatusFilter(tab.id);
                setPage(1);
              }}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition whitespace-nowrap ${
                statusFilter === tab.id
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Filter Controls Row */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          {/* Search Input */}
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search by event ID, rule name, or metric..."
              className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Severity Dropdown */}
          <div className="w-full sm:w-48">
            <select
              value={severityFilter}
              onChange={(e) => {
                setSeverityFilter(e.target.value);
                setPage(1);
              }}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
            >
              <option value="">All Severities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
        </div>
      </div>

      {/* Events Grid */}
      {isEventsLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-56 bg-slate-900/40 border border-slate-800 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : events.length === 0 ? (
        <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-12 text-center">
          <div className="w-12 h-12 bg-slate-800/60 rounded-2xl flex items-center justify-center mx-auto mb-3 text-slate-500">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-white mb-1">No Security Events Found</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {statusFilter || severityFilter || search
              ? 'No events match the current filter criteria. Try adjusting your search or filters.'
              : 'Zero security events detected in the fleet. All anomaly and security telemetry indicators are nominal.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {events.map((event) => (
            <SecurityEventCard
              key={event._id}
              event={event}
              onClick={handleEventClick}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination.total > 0 && (
        <Pagination
          page={page}
          limit={limit}
          total={pagination.total}
          onPageChange={setPage}
        />
      )}

      {/* Security Event Detail & Triage Modal */}
      <SecurityEventDetailModal
        event={selectedEvent}
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false);
          setSelectedEvent(null);
        }}
        onStatusUpdated={handleStatusUpdated}
      />
    </div>
  );
};

export default SecurityEventsPage;
