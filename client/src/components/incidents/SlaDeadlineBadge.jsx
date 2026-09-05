import React from 'react';
import { Clock, AlertOctagon, CheckCircle2 } from 'lucide-react';

export const SlaDeadlineBadge = ({ incident, className = '' }) => {
  if (!incident) return null;

  if (incident.slaBreached) {
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-bold font-mono bg-rose-500/15 text-rose-400 border border-rose-500/30 uppercase ${className}`}>
        <AlertOctagon className="w-3.5 h-3.5" />
        SLA Breached
      </span>
    );
  }

  const isClosedOrResolved = incident.status === 'resolved' || incident.status === 'false_positive' || incident.status === 'closed';
  if (isClosedOrResolved) {
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-semibold font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 ${className}`}>
        <CheckCircle2 className="w-3.5 h-3.5" />
        SLA Met
      </span>
    );
  }

  const isPendingTriage = incident.status === 'detected';
  const targetDeadline = isPendingTriage ? incident.slaTriageDeadline : incident.slaResolveDeadline;
  const label = isPendingTriage ? 'Triage Due' : 'Resolve Due';

  if (!targetDeadline) return null;

  const deadlineDate = new Date(targetDeadline);
  const now = new Date();
  const diffMs = deadlineDate.getTime() - now.getTime();
  const isOverdue = diffMs < 0;

  const formatRemaining = (ms) => {
    const absMs = Math.abs(ms);
    const mins = Math.floor(absMs / (1000 * 60));
    const hours = Math.floor(mins / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${mins % 60}m`;
    return `${mins}m`;
  };

  const timeStr = formatRemaining(diffMs);

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-mono font-medium border ${
        isOverdue
          ? 'bg-rose-500/10 text-rose-400 border-rose-500/30 font-bold'
          : 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20'
      } ${className}`}
      title={`Deadline: ${deadlineDate.toLocaleString()}`}
    >
      <Clock className="w-3.5 h-3.5" />
      {label}: {isOverdue ? `${timeStr} OVERDUE` : `${timeStr} left`}
    </span>
  );
};
