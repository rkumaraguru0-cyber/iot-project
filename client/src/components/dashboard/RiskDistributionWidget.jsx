import React from 'react';
import { BarChart3 } from 'lucide-react';

export const RiskDistributionWidget = ({ data, isLoading }) => {
  if (isLoading) {
    return (
      <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 animate-pulse h-44">
        <div className="h-4 bg-slate-800 rounded w-1/3 mb-4"></div>
        <div className="h-8 bg-slate-800 rounded w-1/2 mb-3"></div>
      </div>
    );
  }

  const { low = 0, medium = 0, high = 0, critical = 0, severe = 0 } = data || {};
  const total = low + medium + high + critical + severe;

  const brackets = [
    { label: 'Low', range: '0–19', count: low, color: 'bg-emerald-500', text: 'text-emerald-400', border: 'border-emerald-500/20' },
    { label: 'Med', range: '20–49', count: medium, color: 'bg-blue-500', text: 'text-blue-400', border: 'border-blue-500/20' },
    { label: 'High', range: '50–74', count: high, color: 'bg-amber-500', text: 'text-amber-400', border: 'border-amber-500/20' },
    { label: 'Crit', range: '75–89', count: critical, color: 'bg-orange-500', text: 'text-orange-400', border: 'border-orange-500/20' },
    { label: 'Severe', range: '90–100', count: severe, color: 'bg-red-500', text: 'text-red-400', border: 'border-red-500/20' }
  ];

  return (
    <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition flex flex-col justify-between">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-indigo-400" />
          Fleet Risk Distribution
        </span>
        <span className="text-[10px] font-mono text-slate-400 font-semibold">{total} Devices</span>
      </div>

      <div className="grid grid-cols-5 gap-1.5 my-2 text-center">
        {brackets.map((b) => (
          <div key={b.label} className={`p-2 rounded-xl bg-slate-950/60 border ${b.border}`}>
            <p className={`text-[10px] font-bold ${b.text}`}>{b.label}</p>
            <p className="text-[9px] font-mono text-slate-500">{b.range}</p>
            <p className="text-base font-extrabold text-white mt-0.5">{b.count}</p>
          </div>
        ))}
      </div>

      <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden flex mt-1">
        {brackets.map((b) => {
          const pct = total > 0 ? (b.count / total) * 100 : 0;
          return (
            <div
              key={b.label}
              className={`${b.color} h-full transition-all duration-500`}
              style={{ width: `${pct}%` }}
              title={`${b.label} (${b.range}): ${b.count}`}
            />
          );
        })}
      </div>
    </div>
  );
};

export default RiskDistributionWidget;
