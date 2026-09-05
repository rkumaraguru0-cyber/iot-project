import React, { useState } from 'react';
import { ShieldAlert, X, AlertTriangle, KeyRound, ArrowUpRight, RotateCcw, HelpCircle } from 'lucide-react';
import toast from 'react-hot-toast';

const ACTIONS = [
  {
    id: 'quarantine_device',
    label: 'Quarantine Device',
    icon: ShieldAlert,
    color: 'text-amber-400',
    description: 'Transitions target device to quarantined status and restricts operational traffic.'
  },
  {
    id: 'revoke_key',
    label: 'Revoke Device API Key',
    icon: KeyRound,
    color: 'text-rose-400',
    description: 'Immediately nullifies device API key, blocking all authentication attempts.'
  },
  {
    id: 'escalate',
    label: 'Escalate Incident Severity',
    icon: ArrowUpRight,
    color: 'text-orange-400',
    description: 'Increases incident severity level by one step in the operational hierarchy.'
  },
  {
    id: 'rollback_firmware',
    label: 'Request Firmware Rollback',
    icon: RotateCcw,
    color: 'text-purple-400',
    description: 'Records intent for firmware rollback (pending Phase 10 deployment execution).'
  },
  {
    id: 'other',
    label: 'Other Containment Action',
    icon: HelpCircle,
    color: 'text-slate-400',
    description: 'Custom operator containment action documented with justification.'
  }
];

export const ResponseActionModal = ({ isOpen, onClose, onActionRecorded, isSubmitting = false }) => {
  const [selectedAction, setSelectedAction] = useState('quarantine_device');
  const [details, setDetails] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await onActionRecorded(selectedAction, details.trim());
      setDetails('');
      toast.success('Response action recorded');
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to record response action');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/80 bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                Record Response Action
              </h3>
              <p className="text-[11px] text-slate-400">Execute and document containment procedures</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Action Select Grid */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider font-mono">
              Select Containment Action
            </label>
            <div className="grid grid-cols-1 gap-2.5">
              {ACTIONS.map((action) => {
                const Icon = action.icon;
                const isSelected = selectedAction === action.id;
                return (
                  <button
                    key={action.id}
                    type="button"
                    onClick={() => setSelectedAction(action.id)}
                    className={`flex items-start gap-3 p-3 rounded-2xl border text-left transition-all ${
                      isSelected
                        ? 'bg-indigo-600/15 border-indigo-500/50 shadow-sm'
                        : 'bg-slate-950/40 border-slate-800/80 hover:border-slate-700'
                    }`}
                  >
                    <div className={`p-1.5 rounded-lg bg-slate-900 border border-slate-800 mt-0.5 ${action.color}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-200 font-mono">{action.label}</div>
                      <div className="text-[11px] text-slate-400 leading-snug">{action.description}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Details / Justification */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider font-mono">
              Action Justification & Details
            </label>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Provide technical rationale, observed indicators, or escalation context..."
              rows={3}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-none font-sans"
            />
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition-all font-mono"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition-all shadow-md shadow-indigo-600/20 font-mono"
            >
              {isSubmitting ? 'Executing...' : 'Confirm Action'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
