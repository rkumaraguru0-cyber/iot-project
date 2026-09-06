import React from 'react';
import { ShieldCheck, ShieldAlert, AlertTriangle } from 'lucide-react';

export const FleetPostureWidget = ({ data, isLoading }) => {
  if (isLoading) {
    return (
      <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 animate-pulse h-44">
        <div className="h-4 bg-slate-800 rounded w-1/3 mb-4"></div>
        <div className="h-8 bg-slate-800 rounded w-1/2 mb-3"></div>
        <div className="h-4 bg-slate-800 rounded w-2/3"></div>
      </div>
    );
  }

  const { totalDevices = 0, elevatedRiskCount = 0, averageRiskScore = 0 } = data || {};
  const elevatedPercentage = totalDevices > 0 ? ((elevatedRiskCount / totalDevices) * 100).toFixed(1) : 0;

  let postureStatus = 'NOMINAL';
  let badgeColor = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
  let Icon = ShieldCheck;

  if (averageRiskScore >= 75 || elevatedRiskCount > (totalDevices * 0.4)) {
    postureStatus = 'CRITICAL';
    badgeColor = 'bg-red-500/10 text-red-400 border-red-500/20';
    Icon = ShieldAlert;
  } else if (averageRiskScore >= 50 || elevatedRiskCount > 0) {
    postureStatus = 'ELEVATED';
    badgeColor = 'bg-amber-500/10 text-amber-400 border-amber-500/20';
    Icon = AlertTriangle;
  }

  return (
    <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition flex flex-col justify-between">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
          <Icon className="w-4 h-4 text-indigo-400" />
          Fleet Security Posture
        </span>
        <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${badgeColor}`}>
          {postureStatus}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 my-2">
        <div>
          <p className="text-[11px] text-slate-500 font-medium">Total Fleet</p>
          <p className="text-xl font-extrabold text-white">{totalDevices}</p>
        </div>
        <div>
          <p className="text-[11px] text-slate-500 font-medium" title="High (50-74) + Critical (75-89) + Severe (90-100)">
            Elevated Risk
          </p>
          <p className="text-xl font-extrabold text-amber-400">
            {elevatedRiskCount}
            <span className="text-[11px] text-slate-500 font-normal ml-1">({elevatedPercentage}%)</span>
          </p>
        </div>
        <div>
          <p className="text-[11px] text-slate-500 font-medium">Avg Fleet Risk</p>
          <p className="text-xl font-extrabold text-indigo-400">{averageRiskScore}</p>
        </div>
      </div>

      <div className="w-full bg-slate-800/80 rounded-full h-1.5 overflow-hidden mt-1">
        <div
          className={`h-full transition-all duration-500 ${
            averageRiskScore >= 75 ? 'bg-red-500' : averageRiskScore >= 50 ? 'bg-amber-500' : 'bg-emerald-500'
          }`}
          style={{ width: `${Math.min(100, averageRiskScore)}%` }}
        />
      </div>
    </div>
  );
};

export default FleetPostureWidget;
