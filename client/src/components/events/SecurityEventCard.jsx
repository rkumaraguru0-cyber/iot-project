import React from 'react';
import { ShieldAlert, AlertTriangle, CheckCircle, Clock, Cpu, Layers, Repeat } from 'lucide-react';
import { Link } from 'react-router-dom';

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

export const SecurityEventCard = ({ event, onClick }) => {
  const severityStyle = SEVERITY_STYLES[event.severity] || SEVERITY_STYLES.medium;
  const statusStyle = STATUS_STYLES[event.status] || STATUS_STYLES.open;

  return (
    <div
      onClick={() => onClick(event)}
      className="bg-slate-900/80 border border-slate-800 hover:border-slate-700/80 rounded-2xl p-5 transition cursor-pointer flex flex-col justify-between shadow-sm group hover:shadow-indigo-500/5"
    >
      <div>
        {/* Header Badges */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs font-bold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-1 rounded-lg">
              {event.eventId}
            </span>
            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${severityStyle}`}>
              {event.severity}
            </span>
            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${statusStyle}`}>
              {event.status}
            </span>
          </div>

          {event.occurrenceCount > 1 && (
            <span className="text-[10px] font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 px-2 py-0.5 rounded-md flex items-center gap-1">
              <Repeat className="w-3 h-3" /> {event.occurrenceCount}x
            </span>
          )}
        </div>

        {/* Title & Rule */}
        <h3 className="text-sm font-bold text-white mb-1 group-hover:text-indigo-300 transition">
          {event.ruleName || event.ruleId}
        </h3>
        <p className="text-xs text-slate-400 mb-4 line-clamp-2">{event.explanation}</p>

        {/* Device & Metric Details */}
        <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3 mb-4 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 flex items-center gap-1.5 font-medium">
              <Cpu className="w-3.5 h-3.5 text-indigo-400" /> Device
            </span>
            <span className="font-mono font-bold text-slate-200">
              {event.deviceId?.deviceId || 'DEV-N/A'} ({event.deviceId?.type || 'IoT'})
            </span>
          </div>

          {event.metric && (
            <div className="flex items-center justify-between border-t border-slate-800/60 pt-2">
              <span className="text-slate-400 flex items-center gap-1.5 font-medium">
                <Layers className="w-3.5 h-3.5 text-indigo-400" /> Metric Breach
              </span>
              <span className="font-mono text-slate-300">
                {event.metric}: <span className="text-rose-400 font-bold">{String(event.observedValue)}</span> / {String(event.thresholdValue)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Footer Timestamps */}
      <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
        <span className="flex items-center gap-1 font-mono">
          <Clock className="w-3 h-3 text-slate-500" />
          {new Date(event.lastOccurrence || event.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </span>
        <span className="text-indigo-400 font-semibold group-hover:underline">
          View Triage &rarr;
        </span>
      </div>
    </div>
  );
};

export default SecurityEventCard;
