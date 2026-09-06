import React from 'react';
import { Timer, CheckCircle, AlertCircle } from 'lucide-react';

export const SlaComplianceWidget = ({ data, isLoading }) => {
  if (isLoading) {
    return (
      <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 animate-pulse h-44">
        <div className="h-4 bg-slate-800 rounded w-1/3 mb-4"></div>
        <div className="h-8 bg-slate-800 rounded w-1/2 mb-3"></div>
      </div>
    );
  }

  const { openIncidents = 0, slaBreachedCount = 0, complianceRate = 100 } = data || {};
  const inComplianceCount = Math.max(0, openIncidents - slaBreachedCount);

  const isHealthy = complianceRate >= 90;
  const isWarning = complianceRate >= 75 && complianceRate < 90;

  return (
    <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition flex flex-col justify-between">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
          <Timer className="w-4 h-4 text-cyan-400" />
          SLA Compliance
        </span>
        <span
          className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
            isHealthy
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
              : isWarning
              ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
              : 'bg-red-500/10 text-red-400 border-red-500/20'
          }`}
        >
          {complianceRate}%
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 my-2">
        <div>
          <p className="text-[11px] text-slate-500 font-medium">Open Incidents</p>
          <p className="text-xl font-extrabold text-white">{openIncidents}</p>
        </div>
        <div>
          <p className="text-[11px] text-slate-500 font-medium">Within SLA</p>
          <p className="text-xl font-extrabold text-emerald-400">{inComplianceCount}</p>
        </div>
        <div>
          <p className="text-[11px] text-slate-500 font-medium">SLA Breached</p>
          <p className="text-xl font-extrabold text-red-400">{slaBreachedCount}</p>
        </div>
      </div>

      <div className="w-full bg-slate-800/80 rounded-full h-1.5 overflow-hidden mt-1">
        <div
          className={`h-full transition-all duration-500 ${
            isHealthy ? 'bg-emerald-500' : isWarning ? 'bg-amber-500' : 'bg-red-500'
          }`}
          style={{ width: `${complianceRate}%` }}
        />
      </div>
    </div>
  );
};

export default SlaComplianceWidget;
