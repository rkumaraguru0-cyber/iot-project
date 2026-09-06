import React from 'react';
import { AlertOctagon } from 'lucide-react';
import { Link } from 'react-router-dom';

export const ActiveIncidentsWidget = ({ data, isLoading }) => {
  if (isLoading) {
    return (
      <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 animate-pulse h-44">
        <div className="h-4 bg-slate-800 rounded w-1/3 mb-4"></div>
        <div className="h-8 bg-slate-800 rounded w-1/2 mb-3"></div>
      </div>
    );
  }

  const { critical = 0, high = 0, medium = 0, low = 0, total = 0 } = data || {};

  return (
    <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition flex flex-col justify-between">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
          <AlertOctagon className="w-4 h-4 text-red-400" />
          Active Incidents
        </span>
        <Link to="/incidents" className="text-[11px] font-semibold text-indigo-400 hover:text-indigo-300">
          View All ({total})
        </Link>
      </div>

      <div className="grid grid-cols-4 gap-2 my-2 text-center">
        <div className="p-2 rounded-xl bg-red-500/10 border border-red-500/20">
          <p className="text-[10px] uppercase font-bold text-red-400">Critical</p>
          <p className="text-lg font-extrabold text-red-400">{critical}</p>
        </div>
        <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
          <p className="text-[10px] uppercase font-bold text-amber-400">High</p>
          <p className="text-lg font-extrabold text-amber-400">{high}</p>
        </div>
        <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20">
          <p className="text-[10px] uppercase font-bold text-blue-400">Med</p>
          <p className="text-lg font-extrabold text-blue-400">{medium}</p>
        </div>
        <div className="p-2 rounded-xl bg-slate-800/80 border border-slate-700">
          <p className="text-[10px] uppercase font-bold text-slate-400">Low</p>
          <p className="text-lg font-extrabold text-slate-300">{low}</p>
        </div>
      </div>

      <div className="text-[11px] text-slate-400 flex justify-between items-center mt-1">
        <span>Excludes closed & false positives</span>
        <span className="font-mono text-slate-300 font-semibold">{total} Open</span>
      </div>
    </div>
  );
};

export default ActiveIncidentsWidget;
