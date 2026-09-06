import React from 'react';
import { HeartPulse } from 'lucide-react';

export const DeviceHealthWidget = ({ data, isLoading }) => {
  if (isLoading) {
    return (
      <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 animate-pulse h-44">
        <div className="h-4 bg-slate-800 rounded w-1/3 mb-4"></div>
        <div className="h-8 bg-slate-800 rounded w-1/2 mb-3"></div>
      </div>
    );
  }

  const { healthy = 0, degraded = 0, offline = 0, unknown = 0 } = data || {};
  const total = healthy + degraded + offline + unknown;

  const healthyPct = total > 0 ? (healthy / total) * 100 : 0;
  const degradedPct = total > 0 ? (degraded / total) * 100 : 0;
  const offlinePct = total > 0 ? (offline / total) * 100 : 0;
  const unknownPct = total > 0 ? (unknown / total) * 100 : 0;

  return (
    <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition flex flex-col justify-between">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
          <HeartPulse className="w-4 h-4 text-emerald-400" />
          Device Health Status
        </span>
        <span className="text-[10px] font-mono text-slate-400 font-semibold">{total} Monitored</span>
      </div>

      <div className="grid grid-cols-4 gap-2 my-2 text-center">
        <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
          <p className="text-[10px] uppercase font-bold text-emerald-400">Healthy</p>
          <p className="text-lg font-extrabold text-emerald-400">{healthy}</p>
        </div>
        <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
          <p className="text-[10px] uppercase font-bold text-amber-400">Degraded</p>
          <p className="text-lg font-extrabold text-amber-400">{degraded}</p>
        </div>
        <div className="p-2 rounded-xl bg-red-500/10 border border-red-500/20">
          <p className="text-[10px] uppercase font-bold text-red-400">Offline</p>
          <p className="text-lg font-extrabold text-red-400">{offline}</p>
        </div>
        <div className="p-2 rounded-xl bg-slate-800/80 border border-slate-700">
          <p className="text-[10px] uppercase font-bold text-slate-400">Unknown</p>
          <p className="text-lg font-extrabold text-slate-300">{unknown}</p>
        </div>
      </div>

      <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden flex mt-1">
        <div className="bg-emerald-500 h-full transition-all duration-500" style={{ width: `${healthyPct}%` }} title={`Healthy: ${healthy}`} />
        <div className="bg-amber-500 h-full transition-all duration-500" style={{ width: `${degradedPct}%` }} title={`Degraded: ${degraded}`} />
        <div className="bg-red-500 h-full transition-all duration-500" style={{ width: `${offlinePct}%` }} title={`Offline: ${offline}`} />
        <div className="bg-slate-600 h-full transition-all duration-500" style={{ width: `${unknownPct}%` }} title={`Unknown: ${unknown}`} />
      </div>
    </div>
  );
};

export default DeviceHealthWidget;
