import React from 'react';
import { AlertTriangle, Flame, AlertCircle, Info } from 'lucide-react';

const SEVERITY_CONFIG = {
  critical: {
    label: 'Critical',
    icon: Flame,
    color: 'bg-rose-500/10 text-rose-400 border-rose-500/30'
  },
  high: {
    label: 'High',
    icon: AlertTriangle,
    color: 'bg-orange-500/10 text-orange-400 border-orange-500/30'
  },
  medium: {
    label: 'Medium',
    icon: AlertCircle,
    color: 'bg-amber-500/10 text-amber-400 border-amber-500/30'
  },
  low: {
    label: 'Low',
    icon: Info,
    color: 'bg-blue-500/10 text-blue-400 border-blue-500/30'
  }
};

export const IncidentSeverityBadge = ({ severity, className = '' }) => {
  const config = SEVERITY_CONFIG[severity?.toLowerCase()] || SEVERITY_CONFIG.medium;
  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-semibold tracking-wider uppercase font-mono border ${config.color} ${className}`}
    >
      <Icon className="w-3.5 h-3.5" />
      {config.label}
    </span>
  );
};
