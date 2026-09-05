import React from 'react';
import { ShieldAlert, AlertTriangle, Activity, TrendingUp, CheckCircle, Cpu } from 'lucide-react';
import { Link } from 'react-router-dom';

const SEVERITY_COLORS = {
  severe: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  critical: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
  high: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  medium: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  low: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
};

export const FleetRiskSummaryCard = ({ summary, loading = false }) => {
  if (loading || !summary) {
    return (
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 animate-pulse flex items-center justify-between">
        <div className="h-10 bg-slate-800 rounded w-1/3" />
        <div className="h-10 bg-slate-800 rounded w-1/4" />
      </div>
    );
  }

  const avgScore = summary.averageRiskScore || 0;
  const highRiskCount = summary.highRiskDeviceCount || 0;
  const bySeverity = summary.devicesByRiskSeverity || {};

  return (
    <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-5 shadow-sm space-y-4">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
        <div className="flex items-center gap-3">
          <div className={`p-3 rounded-xl border ${
            avgScore >= 75 ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
            avgScore >= 50 ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
            avgScore >= 20 ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' :
            'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
          }`}>
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              Fleet Risk Posture
            </h2>
            <p className="text-xs text-slate-400">Deterministic security intelligence across active devices</p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="text-right">
            <span className="text-[10px] uppercase font-mono tracking-wider text-slate-500 block">Fleet Avg Score</span>
            <span className={`text-xl font-black font-mono ${
              avgScore >= 75 ? 'text-rose-400' :
              avgScore >= 50 ? 'text-amber-400' :
              avgScore >= 20 ? 'text-yellow-400' :
              'text-emerald-400'
            }`}>
              {avgScore} <span className="text-xs text-slate-500 font-normal">/ 100</span>
            </span>
          </div>

          <div className="text-right pl-6 border-l border-slate-800">
            <span className="text-[10px] uppercase font-mono tracking-wider text-slate-500 block">Elevated Risk</span>
            <span className="text-xl font-black font-mono text-rose-400">
              {highRiskCount} <span className="text-xs text-slate-500 font-normal">devices</span>
            </span>
          </div>
        </div>
      </div>

      {/* Severity Breakdown Bar */}
      <div className="grid grid-cols-5 gap-2 text-center text-xs">
        <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
          <span className="text-[10px] font-bold uppercase text-emerald-400 block mb-0.5">Low</span>
          <span className="font-mono font-bold text-slate-200">{bySeverity.low || 0}</span>
        </div>
        <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
          <span className="text-[10px] font-bold uppercase text-yellow-400 block mb-0.5">Medium</span>
          <span className="font-mono font-bold text-slate-200">{bySeverity.medium || 0}</span>
        </div>
        <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
          <span className="text-[10px] font-bold uppercase text-amber-400 block mb-0.5">High</span>
          <span className="font-mono font-bold text-slate-200">{bySeverity.high || 0}</span>
        </div>
        <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
          <span className="text-[10px] font-bold uppercase text-rose-400 block mb-0.5">Critical</span>
          <span className="font-mono font-bold text-slate-200">{bySeverity.critical || 0}</span>
        </div>
        <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
          <span className="text-[10px] font-bold uppercase text-purple-400 block mb-0.5">Severe</span>
          <span className="font-mono font-bold text-slate-200">{bySeverity.severe || 0}</span>
        </div>
      </div>

      {/* Top At-Risk Devices */}
      {summary.topAtRiskDevices && summary.topAtRiskDevices.length > 0 && (
        <div className="pt-2 border-t border-slate-800/60">
          <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5 mb-2">
            <TrendingUp className="w-3.5 h-3.5 text-rose-400" /> Top Devices Requiring SOC Attention
          </span>
          <div className="flex flex-wrap gap-2">
            {summary.topAtRiskDevices.map((dev) => (
              <Link
                key={dev._id}
                to={`/devices/${dev._id}`}
                className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-indigo-500/50 transition text-xs flex items-center gap-2 group"
              >
                <Cpu className="w-3.5 h-3.5 text-slate-500 group-hover:text-indigo-400" />
                <span className="font-mono font-bold text-slate-200">{dev.deviceId}</span>
                <span className={`text-[10px] font-bold font-mono px-1.5 py-0.2 rounded border ${SEVERITY_COLORS[dev.riskSeverity] || SEVERITY_COLORS.low}`}>
                  {dev.riskScore}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default FleetRiskSummaryCard;
