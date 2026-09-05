import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import {
  getIncidentById,
  updateIncidentStatus,
  assignIncident,
  addIncidentNote,
  recordResponseAction,
  resolveIncident
} from '../api/incidents';
import { getUsers } from '../api/users';
import { IncidentStatusBadge } from '../components/incidents/IncidentStatusBadge';
import { IncidentSeverityBadge } from '../components/incidents/IncidentSeverityBadge';
import { SlaDeadlineBadge } from '../components/incidents/SlaDeadlineBadge';
import { IncidentTimelineView } from '../components/incidents/IncidentTimelineView';
import { IncidentNotesList } from '../components/incidents/IncidentNotesList';
import { ResponseActionModal } from '../components/incidents/ResponseActionModal';
import { ResolutionModal } from '../components/incidents/ResolutionModal';
import {
  ArrowLeft,
  AlertOctagon,
  Clock,
  Shield,
  ShieldAlert,
  Layers,
  User,
  FileText,
  Activity,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RotateCcw,
  FileCheck2,
  Cpu,
  ExternalLink,
  ChevronRight,
  MapPin,
  KeyRound,
  Lock
} from 'lucide-react';
import toast from 'react-hot-toast';

export const IncidentDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user: currentUser, hasRole } = useAuth();

  const [activeTab, setActiveTab] = useState('overview');
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);
  const [isResolveModalOpen, setIsResolveModalOpen] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const [isAddingNote, setIsAddingNote] = useState(false);

  // Fetch Incident Data
  const {
    data: incident,
    isLoading,
    refetch
  } = useQuery({
    queryKey: ['incident', id],
    queryFn: () => getIncidentById(id)
  });

  // Fetch Team Users for Assignee dropdown
  const { data: usersData } = useQuery({
    queryKey: ['users-list'],
    queryFn: () => getUsers({ limit: 100 }),
    enabled: hasRole('operator')
  });

  const users = usersData?.users || [];

  const handleStatusTransition = async (newStatus, note = null) => {
    setIsUpdatingStatus(true);
    try {
      await updateIncidentStatus(id, newStatus, note);
      toast.success(`Incident status transitioned to ${newStatus.replace('_', ' ')}`);
      refetch();
      queryClient.invalidateQueries(['incidents']);
      queryClient.invalidateQueries(['incident-stats']);
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to update status');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleAssign = async (userId) => {
    setIsAssigning(true);
    try {
      await assignIncident(id, userId || null);
      toast.success('Incident assignment updated');
      refetch();
      queryClient.invalidateQueries(['incidents']);
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to assign incident');
    } finally {
      setIsAssigning(false);
    }
  };

  const handleAddNote = async (content) => {
    setIsAddingNote(true);
    try {
      await addIncidentNote(id, content);
      refetch();
    } finally {
      setIsAddingNote(false);
    }
  };

  const handleRecordAction = async (action, details) => {
    await recordResponseAction(id, action, details);
    refetch();
    queryClient.invalidateQueries(['incidents']);
    queryClient.invalidateQueries(['device']);
  };

  const handleResolve = async (resolutionData) => {
    await resolveIncident(id, resolutionData);
    refetch();
    queryClient.invalidateQueries(['incidents']);
    queryClient.invalidateQueries(['incident-stats']);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-slate-500">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs font-semibold font-mono">Retrieving incident telemetry & correlation graphs...</p>
      </div>
    );
  }

  if (!incident) {
    return (
      <div className="text-center py-20">
        <h2 className="text-base font-bold text-white mb-2 font-mono">Incident Not Found</h2>
        <p className="text-xs text-slate-400 mb-6">The requested incident record does not exist or has been removed.</p>
        <button
          onClick={() => navigate('/incidents')}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl font-mono"
        >
          Return to Incidents
        </button>
      </div>
    );
  }

  const eventsList = incident.events || incident.securityEvents || [];
  const notesList = incident.notes || [];
  const timelineList = incident.timeline || [];
  const actionsList = incident.responseActions || [];

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Back Button */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/incidents')}
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition font-mono"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Incidents Pipeline
        </button>
      </div>

      {/* Incident Header Card */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="p-3.5 rounded-2xl bg-rose-600/10 border border-rose-500/30 text-rose-400 shrink-0">
              <AlertOctagon className="w-8 h-8" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-3 mb-1.5">
                <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-indigo-400">
                  {incident.incidentId || `#${incident._id.slice(-6)}`}
                </span>
                <h1 className="text-xl font-black text-white tracking-tight">{incident.title}</h1>
              </div>
              <p className="text-xs text-slate-400 flex flex-wrap items-center gap-2">
                <span>Correlation: <span className="font-mono text-slate-300 font-semibold">{incident.correlationStrategy || 'Direct Detection'}</span></span>
                <span>•</span>
                <span>Detected: <span className="font-mono text-slate-300">{new Date(incident.createdAt).toLocaleString()}</span></span>
              </p>
            </div>
          </div>

          {/* Badges & Top Actions */}
          <div className="flex flex-wrap items-center gap-3">
            <IncidentSeverityBadge severity={incident.severity} />
            <IncidentStatusBadge status={incident.status} />
            <SlaDeadlineBadge incident={incident} />

            {/* Assignee Selector */}
            {hasRole('operator') && (
              <div className="flex items-center gap-1.5 bg-slate-950/80 border border-slate-800 rounded-xl px-2.5 py-1 text-xs">
                <User className="w-3.5 h-3.5 text-indigo-400" />
                <select
                  value={incident.assignedTo?._id || incident.assignedTo || ''}
                  onChange={(e) => handleAssign(e.target.value)}
                  disabled={isAssigning}
                  className="bg-transparent text-xs text-slate-200 focus:outline-none cursor-pointer font-mono"
                >
                  <option value="" className="bg-slate-900 text-slate-400">Unassigned</option>
                  {users.map((u) => (
                    <option key={u._id} value={u._id} className="bg-slate-900 text-slate-200">
                      {u.displayName || u.email} ({u.role})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* State Machine Action Bar */}
        <div className="mt-6 pt-5 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
            <span>Lifecycle Workflow:</span>
            <span className="font-bold text-slate-200 uppercase">{incident.status}</span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Detected -> Triaged */}
            {incident.status === 'detected' && (
              <button
                onClick={() => handleStatusTransition('triaged', 'Incident triaged and verified')}
                disabled={isUpdatingStatus}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 font-mono shadow-md shadow-amber-600/20"
              >
                <Clock className="w-3.5 h-3.5" />
                Mark Triaged
              </button>
            )}

            {/* Triaged -> Investigating */}
            {incident.status === 'triaged' && (
              <button
                onClick={() => handleStatusTransition('investigating', 'Investigation started')}
                disabled={isUpdatingStatus}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 font-mono shadow-md shadow-indigo-600/20"
              >
                <Activity className="w-3.5 h-3.5" />
                Start Investigation
              </button>
            )}

            {/* Investigating -> Containment */}
            {incident.status === 'investigating' && (
              <button
                onClick={() => handleStatusTransition('containment', 'Containment phase initiated')}
                disabled={isUpdatingStatus}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 font-mono shadow-md shadow-purple-600/20"
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                Initiate Containment
              </button>
            )}

            {/* Containment / Investigating -> Response Actions Button */}
            {(incident.status === 'investigating' || incident.status === 'containment') && (
              <button
                onClick={() => setIsActionModalOpen(true)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-purple-300 border border-purple-500/30 rounded-xl text-xs font-bold transition flex items-center gap-1.5 font-mono"
              >
                <Shield className="w-3.5 h-3.5" />
                Record Response Action
              </button>
            )}

            {/* Containment / Investigating -> Resolve Incident */}
            {(incident.status === 'containment' || incident.status === 'investigating') && hasRole('security_analyst') && (
              <button
                onClick={() => setIsResolveModalOpen(true)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 font-mono shadow-md shadow-emerald-600/20"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Resolve Incident
              </button>
            )}

            {/* False Positive Transition */}
            {['detected', 'triaged', 'investigating'].includes(incident.status) && hasRole('security_analyst') && (
              <button
                onClick={() => handleStatusTransition('false_positive', 'Marked as false positive by analyst')}
                disabled={isUpdatingStatus}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 font-mono border border-slate-700"
              >
                <XCircle className="w-3.5 h-3.5 text-slate-400" />
                False Positive
              </button>
            )}

            {/* Resolved / False Positive -> Close Incident */}
            {['resolved', 'false_positive'].includes(incident.status) && hasRole('org_admin') && (
              <button
                onClick={() => handleStatusTransition('closed', 'Incident closed and archived by administrator')}
                disabled={isUpdatingStatus}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 font-mono"
              >
                <Lock className="w-3.5 h-3.5" />
                Close & Archive
              </button>
            )}

            {/* Reopen Incident */}
            {['resolved', 'false_positive', 'closed'].includes(incident.status) && hasRole('security_analyst') && (
              <button
                onClick={() => handleStatusTransition('investigating', 'Incident reopened for further investigation')}
                disabled={isUpdatingStatus}
                className="px-3.5 py-2 bg-amber-600/10 hover:bg-amber-600/20 text-amber-400 border border-amber-500/30 rounded-xl text-xs font-bold transition flex items-center gap-1.5 font-mono"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reopen Incident
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-slate-800">
        {[
          { id: 'overview', label: 'Overview & Correlation', icon: Layers },
          { id: 'events', label: `Correlated Events (${eventsList.length})`, icon: Activity },
          { id: 'timeline', label: `Audit Timeline (${timelineList.length})`, icon: Clock },
          { id: 'notes', label: `Investigation Notes (${notesList.length})`, icon: FileText },
          { id: 'actions', label: `Response Actions (${actionsList.length})`, icon: ShieldAlert },
          { id: 'resolution', label: 'Resolution & RCA', icon: FileCheck2 }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl transition whitespace-nowrap font-mono ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Panels */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Details (2 Cols) */}
          <div className="lg:col-span-2 space-y-6">
            {/* Correlation Details Card */}
            <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-6 space-y-4">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-400" />
                Correlation Intelligence & Rationale
              </h2>
              <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/60 p-4 rounded-2xl border border-slate-800/80">
                {incident.description || 'No detailed incident description provided.'}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3.5 bg-slate-950/40 rounded-xl border border-slate-800/80">
                  <span className="text-slate-500 block mb-1 font-mono text-[11px]">Correlation Engine Strategy</span>
                  <span className="font-semibold text-indigo-300 font-mono">
                    {incident.correlationStrategy || 'Standalone Detection'}
                  </span>
                </div>
                <div className="p-3.5 bg-slate-950/40 rounded-xl border border-slate-800/80">
                  <span className="text-slate-500 block mb-1 font-mono text-[11px]">Events Aggregated</span>
                  <span className="font-semibold text-slate-200 font-mono">
                    {eventsList.length} Security Event{eventsList.length === 1 ? '' : 's'}
                  </span>
                </div>
              </div>
            </div>

            {/* Target IoT Device Specification */}
            {incident.device && (
              <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-indigo-400" />
                    Target Hardware & Network Identity
                  </h2>
                  <Link
                    to={`/devices/${incident.device._id || incident.device}`}
                    className="text-xs text-indigo-400 hover:text-indigo-300 transition flex items-center gap-1 font-mono font-semibold"
                  >
                    <span>Full Device Forensics</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Link>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="p-3.5 bg-slate-950/40 rounded-xl border border-slate-800/80">
                    <span className="text-slate-500 block mb-1 font-mono text-[11px]">Device Name</span>
                    <span className="font-semibold text-slate-200">
                      {incident.device.name || 'IoT Device'}
                    </span>
                  </div>
                  <div className="p-3.5 bg-slate-950/40 rounded-xl border border-slate-800/80">
                    <span className="text-slate-500 block mb-1 font-mono text-[11px]">Hardware Model</span>
                    <span className="font-semibold text-slate-200">
                      {incident.device.manufacturer} — {incident.device.model}
                    </span>
                  </div>
                  <div className="p-3.5 bg-slate-950/40 rounded-xl border border-slate-800/80">
                    <span className="text-slate-500 block mb-1 font-mono text-[11px]">Operational Status</span>
                    <span className="font-semibold font-mono text-indigo-400 uppercase">
                      {incident.device.status || 'Active'}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* SLA Compliance & Deadlines (1 Col) */}
          <div className="space-y-6">
            <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-6 space-y-4">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-400" />
                SLA Compliance Metrics
              </h2>

              <div className="space-y-3 text-xs">
                <div className="p-3.5 bg-slate-950/60 rounded-xl border border-slate-800/80 space-y-1">
                  <span className="text-slate-500 font-mono text-[11px]">Triage SLA Deadline</span>
                  <div className="font-mono text-slate-200 font-semibold">
                    {incident.slaTriageDeadline ? new Date(incident.slaTriageDeadline).toLocaleString() : 'N/A'}
                  </div>
                  {incident.triagedAt && (
                    <div className="text-[10px] font-mono text-emerald-400 pt-0.5">
                      ✓ Triaged at {new Date(incident.triagedAt).toLocaleString()}
                    </div>
                  )}
                </div>

                <div className="p-3.5 bg-slate-950/60 rounded-xl border border-slate-800/80 space-y-1">
                  <span className="text-slate-500 font-mono text-[11px]">Resolution SLA Deadline</span>
                  <div className="font-mono text-slate-200 font-semibold">
                    {incident.slaResolveDeadline ? new Date(incident.slaResolveDeadline).toLocaleString() : 'N/A'}
                  </div>
                  {incident.resolvedAt && (
                    <div className="text-[10px] font-mono text-emerald-400 pt-0.5">
                      ✓ Resolved at {new Date(incident.resolvedAt).toLocaleString()}
                    </div>
                  )}
                </div>

                <div className="p-3.5 bg-slate-950/60 rounded-xl border border-slate-800/80 flex items-center justify-between">
                  <span className="text-slate-500 font-mono text-[11px]">Breach State</span>
                  <span className={`font-mono text-xs font-bold uppercase ${incident.slaBreached ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {incident.slaBreached ? 'SLA Breached' : 'Within Target SLA'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Correlated Events */}
      {activeTab === 'events' && (
        <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-6 space-y-4">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
            <Activity className="w-4 h-4 text-indigo-400" />
            Underlying Security Events & Detections
          </h2>

          {eventsList.length === 0 ? (
            <p className="text-xs text-slate-500 italic">No specific security events linked.</p>
          ) : (
            <div className="divide-y divide-slate-800/60">
              {eventsList.map((evt, idx) => (
                <div key={evt._id || idx} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-indigo-400 font-bold">{evt.eventId || `#${(evt._id || '').slice(-6)}`}</span>
                      <span className="font-semibold text-slate-100">{evt.rule?.name || evt.ruleName || evt.metric}</span>
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-[10px] font-mono uppercase text-slate-400">
                        {evt.severity || 'medium'}
                      </span>
                    </div>
                    <div className="text-slate-400 font-mono text-[11px]">
                      Value: <span className="text-slate-200">{evt.value}</span> | Threshold: <span className="text-slate-200">{evt.threshold}</span> | Occurrences: <span className="text-slate-200">{evt.occurrenceCount || 1}</span>
                    </div>
                  </div>
                  <div className="text-right font-mono text-[11px] text-slate-500">
                    {new Date(evt.timestamp || evt.createdAt).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Timeline */}
      {activeTab === 'timeline' && (
        <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-6">
          <IncidentTimelineView timeline={timelineList} />
        </div>
      )}

      {/* Tab: Investigation Notes */}
      {activeTab === 'notes' && (
        <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-6">
          <IncidentNotesList
            notes={notesList}
            onAddNote={handleAddNote}
            canAddNotes={hasRole('operator')}
            isSubmitting={isAddingNote}
          />
        </div>
      )}

      {/* Tab: Response Actions */}
      {activeTab === 'actions' && (
        <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-purple-400" />
              Containment & Response Log
            </h2>
            {hasRole('operator') && (
              <button
                onClick={() => setIsActionModalOpen(true)}
                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition font-mono"
              >
                + Record Action
              </button>
            )}
          </div>

          {actionsList.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500 bg-slate-950/40 rounded-2xl border border-slate-800/60 font-mono">
              No response actions executed for this incident yet.
            </div>
          ) : (
            <div className="space-y-3">
              {actionsList.map((action, idx) => (
                <div key={idx} className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono font-bold text-purple-400 uppercase tracking-wider">
                      {action.action?.replace(/_/g, ' ')}
                    </span>
                    <span className="text-[11px] font-mono text-slate-500">
                      {new Date(action.executedAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">{action.details}</p>
                  <div className="text-[10px] font-mono text-slate-500">
                    Executed by: <span className="text-slate-300">{action.executedBy || 'System'}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Resolution & RCA */}
      {activeTab === 'resolution' && (
        <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-6 space-y-4">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
            <FileCheck2 className="w-4 h-4 text-emerald-400" />
            Root Cause Analysis & Incident Resolution
          </h2>

          {incident.resolution?.summary ? (
            <div className="space-y-4 text-xs">
              <div className="p-4 bg-slate-950/60 rounded-2xl border border-slate-800/80 space-y-1">
                <span className="text-slate-500 font-mono uppercase text-[11px]">Resolution Summary</span>
                <p className="text-slate-200 leading-relaxed font-sans">{incident.resolution.summary}</p>
              </div>

              <div className="p-4 bg-slate-950/60 rounded-2xl border border-slate-800/80 space-y-1">
                <span className="text-slate-500 font-mono uppercase text-[11px]">Root Cause Analysis</span>
                <p className="text-slate-200 leading-relaxed font-sans">{incident.resolution.rootCause}</p>
              </div>

              {incident.resolution.preventiveMeasures && (
                <div className="p-4 bg-slate-950/60 rounded-2xl border border-slate-800/80 space-y-1">
                  <span className="text-slate-500 font-mono uppercase text-[11px]">Preventive Remediation</span>
                  <p className="text-slate-200 leading-relaxed font-sans">{incident.resolution.preventiveMeasures}</p>
                </div>
              )}

              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 font-mono text-[11px]">
                Incident resolved on {new Date(incident.resolvedAt || incident.updatedAt).toLocaleString()}
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-xs text-slate-500 bg-slate-950/40 rounded-2xl border border-slate-800/60 space-y-3 font-mono">
              <p>Incident is currently active ({incident.status.toUpperCase()}). Resolution documentation pending containment.</p>
              {hasRole('security_analyst') && ['investigating', 'containment'].includes(incident.status) && (
                <button
                  onClick={() => setIsResolveModalOpen(true)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition"
                >
                  Document RCA & Resolve
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      <ResponseActionModal
        isOpen={isActionModalOpen}
        onClose={() => setIsActionModalOpen(false)}
        onActionRecorded={handleRecordAction}
      />

      <ResolutionModal
        isOpen={isResolveModalOpen}
        onClose={() => setIsResolveModalOpen(false)}
        onResolve={handleResolve}
      />
    </div>
  );
};

export default IncidentDetailPage;
