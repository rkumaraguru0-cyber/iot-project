import React from 'react';
import { HardDrive, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';

export const FirmwareExposureWidget = ({ data, isLoading }) => {
  if (isLoading) {
    return (
      <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 animate-pulse h-44">
        <div className="h-4 bg-slate-800 rounded w-1/3 mb-4"></div>
        <div className="h-8 bg-slate-800 rounded w-1/2 mb-3"></div>
      </div>
    );
  }

  const {
    vulnerableDeviceCount = 0,
    recalledDeviceCount = 0,
    totalDevices = 0,
    exposedPercentage = 0
  } = data || {};

  const totalExposed = vulnerableDeviceCount + recalledDeviceCount;
  const isExposed = totalExposed > 0;

  return (
    <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition flex flex-col justify-between">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
          <HardDrive className="w-4 h-4 text-amber-400" />
          Firmware Vulnerability Exposure
        </span>
        <span
          className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
            isExposed
              ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
              : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
          }`}
        >
          {exposedPercentage}% Exposed
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 my-2 text-center">
        <div className="p-2 rounded-xl bg-slate-950/60 border border-slate-800">
          <p className="text-[10px] uppercase font-bold text-slate-400">Total Active</p>
          <p className="text-lg font-extrabold text-white">{totalDevices}</p>
        </div>
        <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
          <p className="text-[10px] uppercase font-bold text-amber-400">Vulnerable FW</p>
          <p className="text-lg font-extrabold text-amber-400">{vulnerableDeviceCount}</p>
        </div>
        <div className="p-2 rounded-xl bg-red-500/10 border border-red-500/20">
          <p className="text-[10px] uppercase font-bold text-red-400">Recalled FW</p>
          <p className="text-lg font-extrabold text-red-400">{recalledDeviceCount}</p>
        </div>
      </div>

      <div className="text-[11px] text-slate-400 flex justify-between items-center mt-1">
        <span>Running vulnerable/recalled versions</span>
        <Link to="/firmware" className="text-indigo-400 hover:text-indigo-300 font-semibold">
          Manage OTA
        </Link>
      </div>
    </div>
  );
};

export default FirmwareExposureWidget;
