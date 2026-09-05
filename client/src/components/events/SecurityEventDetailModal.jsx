import React, { useState } from 'react';
import {
  X,
  ShieldAlert,
  AlertTriangle,
  CheckCircle,
  Clock,
  Cpu,
  Layers,
  Repeat,
  Info,
  User,
  FileText,
  RotateCcw,
  Check,
  Ban
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { updateSecurityEventStatus } from '../../api/securityEvents';
import toast from 'react-hot-toast';

const SEVERITY_STYLES = {
  critical: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  high: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  medium: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  low: 'bg-blue-500/10 text-blue-400 border-blue-500/20'
};

const STATUS_STYLES = {
  open: 'bg-rose-500/10 text-rose-300 border-rose-500/20',
  acknowledged: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
  resolved: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
  false_positive: 'bg-slate-800 text-slate-400 border-slate-700'
};

export const SecurityEventDetailModal = ({ event, isOpen, onClose, onStatusUpdated }) => {
  const { user } = useAuth();
  const [resolutionNote, setResolutionNote] = useState('');
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [targetAction, setTargetAction] = useState(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen || !event) return null;

  const role = user?.role || 'viewer';
  const canAcknowledge = ['operator', 'security_analyst', 'org_admin', 'super_admin'].includes(role);
  const canResolve = ['security_analyst', 'org_admin', 'super_admin'].includes(role);

  const handleQuickStatus = async (status, note = null) => {
    setLoading(true);
    try {
      const res = await updateSecurityEventStatus(event._id, status, note);
      toast.success(`Event ${event.eventId} marked as ${status.replace('_', ' ')}`);
      setShowNoteInput(false);
      setResolutionNote('');
      setTargetAction(null);
      if (onStatusUpdated) onStatusUpdated(res.event);
    } catch (err) {
      const msg = err.response?.data?.error?.message || err.message || 'Failed to update event status';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleActionClick = (action) => {
    if (action === 'acknowledged') {
      handleQuickStatus('acknowledged');
    } else {
      setTargetAction(action);
      setShowNoteInput(true);
    }
  };

  const handleConfirmActionWithNote = (e) => {
    e.preventDefault();
    if (!targetAction) return;
    handleQuickStatus(targetAction, resolutionNote.trim() || undefined);
  };

  const severityStyle = SEVERITY_STYLES[event.severity] || SEVERITY_STYLES.medium;
  const statusStyle = STATUS_STYLES[event.status] || STATUS_STYLES.open;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-bold text-white">{event.eventId}</span>
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${severityStyle}`}>
                  {event.severity}
                </span>
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${statusStyle}`}>
                  {event.status}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">Security Event Triage & Details</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Explanation Section */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4">
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
              {event.ruleName || event.ruleId}
            </h4>
            <p className="text-sm font-medium text-slate-200">{event.explanation}</p>
          </div>

          {/* Device & Forensic Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Device Info */}
            <div className="bg-slate-950/40 border border-slate-800/80 rounded-xl p-4 space-y-3">
              <h5 className="text-xs font-semibold text-indigo-400 flex items-center gap-1.5 uppercase tracking-wider">
                <Cpu className="w-3.5 h-3.5" /> Target Device
              </h5>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Device ID</span>
                  <span className="font-mono font-bold text-slate-200">
                    {event.deviceId?.deviceId || (typeof event.deviceId === 'string' ? event.deviceId : 'N/A')}
                  </span>
                </div>
                {event.deviceId?.name && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Name</span>
                    <span className="text-slate-300">{event.deviceId.name}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-400">Type</span>
                  <span className="font-mono text-slate-300">{event.deviceId?.type || 'IoT'}</span>
                </div>
                {event.deviceId?.location && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Location</span>
                    <span className="text-slate-300">{event.deviceId.location}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Forensic Anomaly Data */}
            <div className="bg-slate-950/40 border border-slate-800/80 rounded-xl p-4 space-y-3">
              <h5 className="text-xs font-semibold text-indigo-400 flex items-center gap-1.5 uppercase tracking-wider">
                <Layers className="w-3.5 h-3.5" /> Breach Forensics
              </h5>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Rule ID</span>
                  <span className="font-mono text-slate-200">{event.ruleId}</span>
                </div>
                {event.metric && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Breached Metric</span>
                    <span className="font-mono text-slate-200">{event.metric}</span>
                  </div>
                )}
                {event.observedValue !== undefined && event.observedValue !== null && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Observed Value</span>
                    <span className="font-mono font-bold text-rose-400">{String(event.observedValue)}</span>
                  </div>
                )}
                {event.thresholdValue !== undefined && event.thresholdValue !== null && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Threshold</span>
                    <span className="font-mono text-slate-300">{String(event.thresholdValue)}</span>
                  </div>
                )}
                {event.anomalyId && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Anomaly Ref</span>
                    <span className="font-mono text-[11px] text-slate-400">{String(event.anomalyId)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Occurrence & Timing Timeline */}
          <div className="bg-slate-950/40 border border-slate-800/80 rounded-xl p-4 space-y-3">
            <h5 className="text-xs font-semibold text-indigo-400 flex items-center gap-1.5 uppercase tracking-wider">
              <Clock className="w-3.5 h-3.5" /> Occurrence & Aggregation Timeline
            </h5>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800">
                <span className="text-slate-400 block text-[11px] mb-1">Occurrences</span>
                <span className="font-mono font-bold text-base text-white flex items-center gap-1.5">
                  <Repeat className="w-4 h-4 text-indigo-400" /> {event.occurrenceCount || 1}x
                </span>
              </div>
              <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800">
                <span className="text-slate-400 block text-[11px] mb-1">First Detected</span>
                <span className="font-mono text-slate-200">
                  {new Date(event.firstOccurrence || event.createdAt).toLocaleString()}
                </span>
              </div>
              <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800">
                <span className="text-slate-400 block text-[11px] mb-1">Last Detected</span>
                <span className="font-mono text-slate-200">
                  {new Date(event.lastOccurrence || event.createdAt).toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* Resolution Metadata (if present) */}
          {(event.status === 'resolved' || event.status === 'false_positive' || event.resolutionNote) && (
            <div className="bg-slate-950/60 border border-emerald-900/30 rounded-xl p-4 space-y-2 text-xs">
              <h5 className="font-semibold text-emerald-400 flex items-center gap-1.5 uppercase tracking-wider">
                <CheckCircle className="w-3.5 h-3.5" /> Resolution Record
              </h5>
              {event.resolutionNote && (
                <p className="text-slate-300 italic bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                  "{event.resolutionNote}"
                </p>
              )}
              <div className="flex flex-wrap items-center justify-between text-slate-400 pt-1 text-[11px]">
                {event.resolvedBy && (
                  <span>
                    Resolved by: <span className="text-slate-200 font-medium">{event.resolvedBy.name || event.resolvedBy.email || String(event.resolvedBy)}</span>
                  </span>
                )}
                {event.resolvedAt && (
                  <span>Resolved at: {new Date(event.resolvedAt).toLocaleString()}</span>
                )}
              </div>
            </div>
          )}

          {/* Inline Note & Confirmation Form */}
          {showNoteInput && (
            <form onSubmit={handleConfirmActionWithNote} className="bg-indigo-950/20 border border-indigo-500/30 rounded-xl p-4 space-y-3">
              <label className="block text-xs font-semibold text-indigo-300 uppercase tracking-wider">
                Resolution / Triage Note (Optional for Resolve, Recommended for FP)
              </label>
              <textarea
                value={resolutionNote}
                onChange={(e) => setResolutionNote(e.target.value)}
                placeholder="Provide triage context, root cause, or rationale..."
                rows={3}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 placeholder-slate-600"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowNoteInput(false);
                    setTargetAction(null);
                  }}
                  className="px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-white rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-1.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition disabled:opacity-50"
                >
                  {loading ? 'Submitting...' : `Confirm ${targetAction?.replace('_', ' ')}`}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Modal Footer / Action Bar */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/60 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-500">
            Role: <span className="font-semibold text-slate-400 capitalize">{role}</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Operator / Analyst / Admin: Acknowledge */}
            {canAcknowledge && event.status === 'open' && !showNoteInput && (
              <button
                type="button"
                onClick={() => handleActionClick('acknowledged')}
                disabled={loading}
                className="px-3.5 py-1.5 bg-amber-500/20 border border-amber-500/30 hover:bg-amber-500/30 text-amber-300 text-xs font-bold rounded-xl transition flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" /> Acknowledge
              </button>
            )}

            {/* Analyst / Admin: Resolve */}
            {canResolve && event.status !== 'resolved' && !showNoteInput && (
              <button
                type="button"
                onClick={() => handleActionClick('resolved')}
                disabled={loading}
                className="px-3.5 py-1.5 bg-emerald-500/20 border border-emerald-500/30 hover:bg-emerald-500/30 text-emerald-300 text-xs font-bold rounded-xl transition flex items-center gap-1.5"
              >
                <CheckCircle className="w-3.5 h-3.5" /> Resolve
              </button>
            )}

            {/* Analyst / Admin: False Positive */}
            {canResolve && event.status !== 'false_positive' && !showNoteInput && (
              <button
                type="button"
                onClick={() => handleActionClick('false_positive')}
                disabled={loading}
                className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-bold rounded-xl transition flex items-center gap-1.5"
              >
                <Ban className="w-3.5 h-3.5" /> False Positive
              </button>
            )}

            {/* Analyst / Admin: Reopen */}
            {canResolve && event.status !== 'open' && !showNoteInput && (
              <button
                type="button"
                onClick={() => handleActionClick('open')}
                disabled={loading}
                className="px-3.5 py-1.5 bg-rose-500/20 border border-rose-500/30 hover:bg-rose-500/30 text-rose-300 text-xs font-bold rounded-xl transition flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Reopen
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SecurityEventDetailModal;
