import React, { useState } from 'react';
import { CheckCircle2, X, FileCheck2 } from 'lucide-react';
import toast from 'react-hot-toast';

export const ResolutionModal = ({ isOpen, onClose, onResolve, isSubmitting = false }) => {
  const [summary, setSummary] = useState('');
  const [rootCause, setRootCause] = useState('');
  const [preventiveMeasures, setPreventiveMeasures] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!summary.trim() || !rootCause.trim()) {
      toast.error('Summary and root cause are required');
      return;
    }

    try {
      await onResolve({
        summary: summary.trim(),
        rootCause: rootCause.trim(),
        preventiveMeasures: preventiveMeasures.trim()
      });
      toast.success('Incident resolved successfully');
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to resolve incident');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/80 bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                Submit Incident Resolution
              </h3>
              <p className="text-[11px] text-slate-400">Document root cause and preventive remediation</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Resolution Summary */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider font-mono">
              Resolution Summary <span className="text-rose-400">*</span>
            </label>
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Describe containment actions taken, device restoration, and threat eradication..."
              rows={2}
              required
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-none font-sans"
            />
          </div>

          {/* Root Cause */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider font-mono">
              Root Cause Analysis <span className="text-rose-400">*</span>
            </label>
            <textarea
              value={rootCause}
              onChange={(e) => setRootCause(e.target.value)}
              placeholder="Explain underlying vulnerability, network exposure, or authentication failure..."
              rows={2}
              required
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-none font-sans"
            />
          </div>

          {/* Preventive Measures */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider font-mono">
              Preventive Measures (Optional)
            </label>
            <textarea
              value={preventiveMeasures}
              onChange={(e) => setPreventiveMeasures(e.target.value)}
              placeholder="Detail policy updates, detection rule tuning, or firewall restrictions implemented..."
              rows={2}
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
              disabled={isSubmitting || !summary.trim() || !rootCause.trim()}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition-all shadow-md shadow-emerald-600/20 font-mono flex items-center gap-2"
            >
              <FileCheck2 className="w-4 h-4" />
              {isSubmitting ? 'Resolving...' : 'Resolve Incident'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
