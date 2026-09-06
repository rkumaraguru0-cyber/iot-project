import React from 'react';
import { Flame, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export const CriticalEventsWidget = ({ data, isLoading }) => {
  if (isLoading) {
    return (
      <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 animate-pulse h-64">
        <div className="h-4 bg-slate-800 rounded w-1/3 mb-4"></div>
        <div className="h-8 bg-slate-800 rounded w-1/2 mb-3"></div>
      </div>
    );
  }

  const { unacknowledgedCount = 0, topEvents = [] } = data || {};

  return (
    <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
            <Flame className="w-4 h-4 text-red-500 animate-pulse" />
            Critical Unacknowledged Events
          </span>
          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">
            {unacknowledgedCount} Pending
          </span>
        </div>

        {topEvents.length === 0 ? (
          <div className="py-6 text-center text-slate-500 text-xs">
            No unacknowledged critical security events.
          </div>
        ) : (
          <div className="space-y-2">
            {topEvents.map((evt) => (
              <div
                key={evt._id || evt.eventId}
                className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-red-500/30 transition flex items-center justify-between"
              >
                <div className="overflow-hidden pr-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-red-400 font-bold">{evt.eventId}</span>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">{evt.category}</span>
                  </div>
                  <p className="text-xs font-medium text-slate-200 truncate mt-0.5">
                    {evt.deviceName} — {evt.explanation || 'Anomaly pattern triggered'}
                  </p>
                </div>
                <span className="text-[9px] font-mono text-slate-500 shrink-0">
                  {evt.firstOccurrence ? new Date(evt.firstOccurrence).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recent'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="pt-3 border-t border-slate-800/60 mt-3 flex justify-between items-center text-xs">
        <span className="text-slate-500 text-[11px]">Severity: Critical • Status: Open</span>
        <Link
          to="/security-events?severity=critical&status=open"
          className="text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1 text-[11px]"
        >
          View Triage <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
    </div>
  );
};

export default CriticalEventsWidget;
