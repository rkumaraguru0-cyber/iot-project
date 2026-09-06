import React from 'react';
import { ShieldAlert, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export const TopRiskDevicesWidget = ({ data, isLoading }) => {
  if (isLoading) {
    return (
      <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 animate-pulse h-64">
        <div className="h-4 bg-slate-800 rounded w-1/3 mb-4"></div>
        <div className="h-8 bg-slate-800 rounded w-1/2 mb-3"></div>
      </div>
    );
  }

  const devices = data || [];

  const getSeverityBadge = (severity) => {
    switch (severity) {
      case 'severe':
        return 'bg-red-500/10 text-red-400 border-red-500/20';
      case 'critical':
        return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
      case 'high':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'medium':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      default:
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    }
  };

  return (
    <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-orange-400" />
            Top 5 Highest-Risk Devices
          </span>
          <Link to="/devices?sort=-riskScore" className="text-[11px] font-semibold text-indigo-400 hover:text-indigo-300">
            Fleet View
          </Link>
        </div>

        {devices.length === 0 ? (
          <div className="py-6 text-center text-slate-500 text-xs">
            No high-risk devices in fleet.
          </div>
        ) : (
          <div className="space-y-2">
            {devices.slice(0, 5).map((dev) => (
              <Link
                key={dev._id || dev.deviceId}
                to={`/devices/${dev._id || dev.deviceId}`}
                className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-indigo-500/40 transition flex items-center justify-between group"
              >
                <div className="overflow-hidden pr-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-200 group-hover:text-indigo-400 transition truncate">
                      {dev.name || dev.deviceId}
                    </span>
                    <span className="text-[10px] font-mono text-slate-500 uppercase">{dev.type}</span>
                  </div>
                  <p className="text-[10px] font-mono text-slate-400 truncate">
                    ID: {dev.deviceId} • FW: {dev.currentFirmwareVersion || 'v1.0.0'}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <div className="text-right">
                    <span className="text-sm font-extrabold text-white font-mono">{dev.riskScore}</span>
                    <span className="text-[9px] text-slate-500 block">Score</span>
                  </div>
                  <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border uppercase ${getSeverityBadge(dev.riskSeverity)}`}>
                    {dev.riskSeverity}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="pt-3 border-t border-slate-800/60 mt-3 flex justify-between items-center text-xs">
        <span className="text-slate-500 text-[11px]">Ranked by deterministic risk score</span>
        <Link
          to="/devices"
          className="text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1 text-[11px]"
        >
          View All Devices <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
    </div>
  );
};

export default TopRiskDevicesWidget;
