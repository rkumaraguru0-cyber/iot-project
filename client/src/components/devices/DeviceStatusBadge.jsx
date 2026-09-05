import React from 'react';

export const StatusBadge = ({ status }) => {
  const configs = {
    registered: {
      bg: 'bg-slate-500/10',
      text: 'text-slate-400',
      border: 'border-slate-500/30',
      dot: 'bg-slate-400',
      label: 'Registered'
    },
    active: {
      bg: 'bg-emerald-500/10',
      text: 'text-emerald-400',
      border: 'border-emerald-500/30',
      dot: 'bg-emerald-400',
      label: 'Active'
    },
    maintenance: {
      bg: 'bg-amber-500/10',
      text: 'text-amber-400',
      border: 'border-amber-500/30',
      dot: 'bg-amber-400',
      label: 'Maintenance'
    },
    quarantined: {
      bg: 'bg-red-500/10',
      text: 'text-red-400',
      border: 'border-red-500/30',
      dot: 'bg-red-400 animate-pulse',
      label: 'Quarantined'
    },
    decommissioned: {
      bg: 'bg-zinc-800/80',
      text: 'text-zinc-400',
      border: 'border-zinc-700/50',
      dot: 'bg-zinc-500',
      label: 'Decommissioned'
    }
  };

  const config = configs[status] || configs.registered;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${config.bg} ${config.text} ${config.border}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  );
};

export const HealthBadge = ({ healthStatus }) => {
  const configs = {
    healthy: {
      bg: 'bg-emerald-500/10',
      text: 'text-emerald-400',
      border: 'border-emerald-500/20',
      label: 'Healthy'
    },
    degraded: {
      bg: 'bg-amber-500/10',
      text: 'text-amber-400',
      border: 'border-amber-500/20',
      label: 'Degraded'
    },
    offline: {
      bg: 'bg-red-500/10',
      text: 'text-red-400',
      border: 'border-red-500/20',
      label: 'Offline'
    },
    unknown: {
      bg: 'bg-slate-500/10',
      text: 'text-slate-400',
      border: 'border-slate-500/20',
      label: 'Unknown'
    }
  };

  const config = configs[healthStatus] || configs.unknown;

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border ${config.bg} ${config.text} ${config.border}`}
    >
      {config.label}
    </span>
  );
};

export const RiskBadge = ({ riskScore = 0, riskSeverity = 'low' }) => {
  const configs = {
    low: {
      bg: 'bg-emerald-500/10',
      text: 'text-emerald-400',
      border: 'border-emerald-500/30',
      label: 'Secure'
    },
    medium: {
      bg: 'bg-yellow-500/10',
      text: 'text-yellow-400',
      border: 'border-yellow-500/30',
      label: 'Caution'
    },
    high: {
      bg: 'bg-orange-500/10',
      text: 'text-orange-400',
      border: 'border-orange-500/30',
      label: 'At Risk'
    },
    critical: {
      bg: 'bg-red-500/15',
      text: 'text-red-400',
      border: 'border-red-500/40',
      label: 'Critical'
    },
    severe: {
      bg: 'bg-purple-500/20',
      text: 'text-purple-300',
      border: 'border-purple-500/50',
      label: 'Compromised'
    }
  };

  const config = configs[riskSeverity] || configs.low;

  return (
    <div className="inline-flex items-center gap-2">
      <span className="text-xs font-mono font-bold text-white bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
        {riskScore}/100
      </span>
      <span
        className={`px-2 py-0.5 rounded text-[11px] font-bold border uppercase tracking-wider ${config.bg} ${config.text} ${config.border}`}
      >
        {config.label}
      </span>
    </div>
  );
};
