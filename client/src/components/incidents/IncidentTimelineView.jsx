import React from 'react';
import { Clock, Shield, User, ArrowRight, CheckCircle2, AlertTriangle, FileText } from 'lucide-react';

const getActionIcon = (action) => {
  switch (action) {
    case 'incident_created':
      return <Shield className="w-4 h-4 text-rose-400" />;
    case 'status_transition':
      return <ArrowRight className="w-4 h-4 text-indigo-400" />;
    case 'assignment_updated':
      return <User className="w-4 h-4 text-cyan-400" />;
    case 'note_added':
      return <FileText className="w-4 h-4 text-amber-400" />;
    case 'severity_escalated':
      return <AlertTriangle className="w-4 h-4 text-orange-400" />;
    case 'incident_resolved':
      return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
    default:
      return <Clock className="w-4 h-4 text-slate-400" />;
  }
};

export const IncidentTimelineView = ({ timeline = [] }) => {
  if (!timeline || timeline.length === 0) {
    return (
      <div className="p-8 text-center text-xs text-slate-500 bg-slate-950/40 rounded-2xl border border-slate-800/60 font-mono">
        No timeline events recorded yet.
      </div>
    );
  }

  // Display timeline entries in chronological order
  const sorted = [...timeline].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  return (
    <div className="space-y-4">
      <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800">
        {sorted.map((item, idx) => (
          <div key={idx} className="relative flex items-start gap-4">
            <div className="absolute -left-6 top-1 w-5 h-5 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center shadow-md">
              {getActionIcon(item.action)}
            </div>
            <div className="flex-1 bg-slate-900/60 border border-slate-800/80 rounded-xl p-3.5 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-200 uppercase tracking-wider font-mono">
                  {item.action?.replace(/_/g, ' ')}
                </span>
                <span className="text-[11px] font-mono text-slate-500">
                  {new Date(item.timestamp).toLocaleString()}
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">{item.details}</p>
              <div className="text-[10px] font-mono text-slate-500 flex items-center gap-1.5 pt-1">
                <span>By:</span>
                <span className="text-indigo-400 font-semibold">{item.actor || 'system'}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
