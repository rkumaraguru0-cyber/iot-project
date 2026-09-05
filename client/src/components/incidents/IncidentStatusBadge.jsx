import React from 'react';
import { 
  AlertCircle, 
  Search, 
  ShieldAlert, 
  CheckCircle2, 
  XCircle, 
  Archive,
  Clock
} from 'lucide-react';

const STATUS_CONFIG = {
  detected: {
    label: 'Detected',
    icon: AlertCircle,
    color: 'bg-rose-500/10 text-rose-400 border-rose-500/20'
  },
  triaged: {
    label: 'Triaged',
    icon: Clock,
    color: 'bg-amber-500/10 text-amber-400 border-amber-500/20'
  },
  investigating: {
    label: 'Investigating',
    icon: Search,
    color: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
  },
  containment: {
    label: 'Containment',
    icon: ShieldAlert,
    color: 'bg-purple-500/10 text-purple-400 border-purple-500/20'
  },
  resolved: {
    label: 'Resolved',
    icon: CheckCircle2,
    color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
  },
  false_positive: {
    label: 'False Positive',
    icon: XCircle,
    color: 'bg-slate-500/10 text-slate-400 border-slate-500/20'
  },
  closed: {
    label: 'Closed',
    icon: Archive,
    color: 'bg-slate-700/20 text-slate-400 border-slate-700/30'
  }
};

export const IncidentStatusBadge = ({ status, className = '' }) => {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.detected;
  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold tracking-wide border uppercase font-mono ${config.color} ${className}`}
    >
      <Icon className="w-3.5 h-3.5" />
      {config.label}
    </span>
  );
};
