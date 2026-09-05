import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  AlertOctagon,
  Search,
  RefreshCw,
  Flame,
  Clock,
  ShieldCheck,
  AlertTriangle,
  ArrowUpRight,
  Filter,
  Layers,
  User
} from 'lucide-react';
import { getIncidents, getIncidentStats } from '../api/incidents';
import { IncidentStatusBadge } from '../components/incidents/IncidentStatusBadge';
import { IncidentSeverityBadge } from '../components/incidents/IncidentSeverityBadge';
import { SlaDeadlineBadge } from '../components/incidents/SlaDeadlineBadge';
import { Pagination } from '../components/common/Pagination';

const STATUS_TABS = [
  { id: '', label: 'All Incidents' },
  { id: 'detected', label: 'Detected' },
  { id: 'triaged', label: 'Triaged' },
  { id: 'investigating', label: 'Investigating' },
  { id: 'containment', label: 'Containment' },
  { id: 'resolved', label: 'Resolved' },
  { id: 'false_positive', label: 'False Positive' },
  { id: 'closed', label: 'Closed' }
];

export const IncidentsPage = () => {
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [statusFilter, setStatusFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [slaBreachedOnly, setSlaBreachedOnly] = useState(false);
  const [search, setSearch] = useState('');

  // Fetch Incident Stats
  const {
    data: statsData,
    isLoading: isStatsLoading,
    refetch: refetchStats
  } = useQuery({
    queryKey: ['incident-stats'],
    queryFn: getIncidentStats,
    refetchInterval: 15000
  });

  // Fetch Incidents List
  const {
    data: incidentsData,
    isLoading: isIncidentsLoading,
    isFetching,
    refetch: refetchIncidents
  } = useQuery({
    queryKey: ['incidents', { page, limit, status: statusFilter, severity: severityFilter, slaBreached: slaBreachedOnly, search }],
    queryFn: () =>
      getIncidents({
        page,
        limit,
        status: statusFilter || undefined,
        severity: severityFilter || undefined,
        slaBreached: slaBreachedOnly ? true : undefined,
        search: search || undefined
      }),
    keepPreviousData: true
  });

  const handleRefresh = () => {
    refetchStats();
    refetchIncidents();
  };

  const incidents = incidentsData?.incidents || [];
  const pagination = incidentsData?.pagination || { total: 0, page: 1, limit };
  const stats = statsData?.stats || {};

  // Compute quick counts
  const activeCount =
    (stats.byStatus?.detected || 0) +
    (stats.byStatus?.triaged || 0) +
    (stats.byStatus?.investigating || 0) +
    (stats.byStatus?.containment || 0);
  const criticalCount = stats.bySeverity?.critical || 0;
  const slaBreachedCount = stats.slaBreachedCount || 0;
  const resolvedCount = (stats.byStatus?.resolved || 0) + (stats.byStatus?.closed || 0);

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
            <AlertOctagon className="w-7 h-7 text-rose-500" />
            Security Incidents & SLA Management
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Correlated multi-event incident orchestration, deterministic response workflows, and SLA compliance
          </p>
        </div>

        <button
          onClick={handleRefresh}
          disabled={isFetching || isStatsLoading}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition self-start sm:self-auto border border-slate-700 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching || isStatsLoading ? 'animate-spin' : ''}`} />
          Refresh Pipeline
        </button>
      </div>

      {/* Aggregate KPI Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-mono text-slate-400 uppercase tracking-wider font-semibold">Active Incidents</p>
            <h3 className="text-2xl font-black text-white mt-1">{isStatsLoading ? '...' : activeCount}</h3>
            <p className="text-[10px] text-slate-500 mt-0.5">Detected, Triaged, Investigating</p>
          </div>
          <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-2xl">
            <Layers className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-mono text-rose-400 uppercase tracking-wider font-semibold">Critical Threats</p>
            <h3 className="text-2xl font-black text-rose-400 mt-1">{isStatsLoading ? '...' : criticalCount}</h3>
            <p className="text-[10px] text-slate-500 mt-0.5">Immediate triage required</p>
          </div>
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-2xl">
            <Flame className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-mono text-amber-400 uppercase tracking-wider font-semibold">SLA Breached</p>
            <h3 className="text-2xl font-black text-amber-400 mt-1">{isStatsLoading ? '...' : slaBreachedCount}</h3>
            <p className="text-[10px] text-slate-500 mt-0.5">Exceeded target deadline</p>
          </div>
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-2xl">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-mono text-emerald-400 uppercase tracking-wider font-semibold">Resolved / Closed</p>
            <h3 className="text-2xl font-black text-emerald-400 mt-1">{isStatsLoading ? '...' : resolvedCount}</h3>
            <p className="text-[10px] text-slate-500 mt-0.5">Containment & RCA completed</p>
          </div>
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-2xl">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter Tabs & Search Controls */}
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
              placeholder="Search by incident title, ID, or description..."
              className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-sans"
            />
          </div>

          {/* Severity Dropdown */}
          <div className="w-full sm:w-44">
            <select
              value={severityFilter}
              onChange={(e) => {
                setSeverityFilter(e.target.value);
                setPage(1);
              }}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-indigo-500 font-mono"
            >
              <option value="">All Severities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>

          {/* SLA Breached Toggle Checkbox */}
          <label className="flex items-center gap-2 px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-300 cursor-pointer select-none hover:border-slate-700 transition shrink-0">
            <input
              type="checkbox"
              checked={slaBreachedOnly}
              onChange={(e) => {
                setSlaBreachedOnly(e.target.checked);
                setPage(1);
              }}
              className="rounded bg-slate-800 border-slate-700 text-indigo-600 focus:ring-0 w-3.5 h-3.5"
            />
            <span className="font-mono text-[11px] text-rose-400 font-semibold">SLA Breached Only</span>
          </label>
        </div>
      </div>

      {/* Incidents Data Table */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl overflow-hidden">
        {isIncidentsLoading ? (
          <div className="p-8 space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-slate-900/40 border border-slate-800 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : incidents.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 bg-slate-800/60 rounded-2xl flex items-center justify-center mx-auto mb-3 text-slate-500">
              <AlertOctagon className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-white mb-1">No Incidents Found</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              {statusFilter || severityFilter || slaBreachedOnly || search
                ? 'No incidents match the selected filter criteria. Try adjusting search queries or clearing filters.'
                : 'No correlated security incidents have been generated. The fleet is operating within normal parameters.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/40 text-[11px] font-mono uppercase tracking-wider text-slate-400">
                  <th className="py-3 px-4">Incident</th>
                  <th className="py-3 px-4">Primary Device</th>
                  <th className="py-3 px-4">Severity</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">SLA Compliance</th>
                  <th className="py-3 px-4">Assignee</th>
                  <th className="py-3 px-4">Created</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-xs text-slate-300">
                {incidents.map((inc) => (
                  <tr key={inc._id} className="hover:bg-slate-800/30 transition-colors group">
                    <td className="py-3.5 px-4">
                      <Link to={`/incidents/${inc._id}`} className="block group-hover:text-indigo-300 transition">
                        <div className="font-bold text-slate-100 flex items-center gap-2">
                          <span className="font-mono text-indigo-400">{inc.incidentId || `#${inc._id.slice(-6)}`}</span>
                          <span className="truncate max-w-xs">{inc.title}</span>
                        </div>
                        {inc.correlationStrategy && (
                          <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                            Strategy: {inc.correlationStrategy}
                          </div>
                        )}
                      </Link>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs">
                      {inc.device ? (
                        <Link
                          to={`/devices/${inc.device._id || inc.device}`}
                          className="text-slate-300 hover:text-indigo-400 transition"
                        >
                          {inc.device.name || inc.device.macAddress || 'Device Details'}
                        </Link>
                      ) : (
                        <span className="text-slate-500">Fleet Wide</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <IncidentSeverityBadge severity={inc.severity} />
                    </td>
                    <td className="py-3.5 px-4">
                      <IncidentStatusBadge status={inc.status} />
                    </td>
                    <td className="py-3.5 px-4">
                      <SlaDeadlineBadge incident={inc} />
                    </td>
                    <td className="py-3.5 px-4">
                      {inc.assignedTo ? (
                        <div className="flex items-center gap-1.5 text-xs text-slate-200">
                          <div className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-[10px] font-bold">
                            <User className="w-3 h-3" />
                          </div>
                          <span className="truncate max-w-[120px]">
                            {inc.assignedTo.displayName || inc.assignedTo.name || inc.assignedTo.email}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-500 italic text-[11px]">Unassigned</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                      {new Date(inc.createdAt).toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <Link
                        to={`/incidents/${inc._id}`}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-indigo-600 hover:text-white text-slate-300 text-xs font-semibold rounded-lg transition"
                      >
                        <span>View</span>
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Table Pagination */}
        {pagination.total > 0 && (
          <Pagination
            page={page}
            limit={limit}
            total={pagination.total}
            onPageChange={setPage}
          />
        )}
      </div>
    </div>
  );
};

export default IncidentsPage;
