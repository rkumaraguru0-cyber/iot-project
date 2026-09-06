import React from 'react';
import { TrendingUp } from 'lucide-react';

export const AnomalyTrendWidget = ({ data, isLoading }) => {
  if (isLoading) {
    return (
      <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 animate-pulse h-64">
        <div className="h-4 bg-slate-800 rounded w-1/3 mb-4"></div>
        <div className="h-32 bg-slate-800 rounded w-full"></div>
      </div>
    );
  }

  const trendData = data?.anomalyTrend || [];
  const maxCount = Math.max(...trendData.map((d) => d.count), 5);
  const total7d = trendData.reduce((acc, curr) => acc + (curr.count || 0), 0);

  return (
    <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition flex flex-col justify-between">
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-indigo-400" />
          Anomaly & Security Trend (7 Days UTC)
        </span>
        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
          {total7d} Total Events
        </span>
      </div>

      {/* SVG Bar Chart with 7 contiguous days */}
      <div className="h-32 flex items-end justify-between gap-2 pt-4 px-2">
        {trendData.map((point) => {
          const heightPct = Math.max(8, (point.count / maxCount) * 100);
          const dayLabel = point.date ? point.date.slice(5) : '';

          return (
            <div key={point.date} className="flex-1 flex flex-col items-center gap-2 group relative">
              {/* Tooltip on hover */}
              <div className="absolute -top-7 opacity-0 group-hover:opacity-100 transition duration-150 pointer-events-none bg-slate-900 border border-slate-700 text-[10px] font-mono text-white px-1.5 py-0.5 rounded shadow z-10 whitespace-nowrap">
                {point.date}: {point.count} events
              </div>

              <div className="w-full bg-slate-800/40 rounded-t-md flex items-end h-24 overflow-hidden">
                <div
                  className="w-full bg-gradient-to-t from-indigo-600 to-indigo-400 group-hover:from-indigo-500 group-hover:to-cyan-400 rounded-t-md transition-all duration-300"
                  style={{ height: `${heightPct}%` }}
                />
              </div>

              <div className="text-center">
                <p className="text-[10px] font-mono font-bold text-slate-200">{point.count}</p>
                <p className="text-[9px] font-mono text-slate-500">{dayLabel}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="text-[10px] text-slate-500 font-mono text-right mt-2">
        Grouped by UTC Date • 7 Continuous Points
      </div>
    </div>
  );
};

export default AnomalyTrendWidget;
