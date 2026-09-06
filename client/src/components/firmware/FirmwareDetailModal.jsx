import React, { useState } from 'react';
import { X, Copy, Check, HardDrive, Shield, Calendar, Server, Activity, Edit3, Send, AlertOctagon } from 'lucide-react';
import { FirmwareSecurityBadge, DeploymentPolicyBadge } from './FirmwareStatusBadge';
import toast from 'react-hot-toast';

export const FirmwareDetailModal = ({
  isOpen,
  onClose,
  firmware,
  onOpenEditModal,
  onOpenDeployModal,
  canManageFirmware
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !firmware) return null;

  const handleCopyChecksum = () => {
    navigator.clipboard.writeText(firmware.checksum);
    setCopied(true);
    toast.success('SHA-256 checksum copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const isEligibleForDeployment =
    !['vulnerable', 'recalled'].includes(firmware.securityStatus) &&
    firmware.deploymentPolicy !== 'blocked';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white">Firmware v{firmware.version}</h2>
                <FirmwareSecurityBadge status={firmware.securityStatus} />
                <DeploymentPolicyBadge policy={firmware.deploymentPolicy} />
              </div>
              <p className="text-xs text-slate-400">
                Architecture: <span className="text-indigo-300 font-medium capitalize">{firmware.deviceType?.replace('_', ' ')}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Metadata Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-xl">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                <Calendar className="w-3 h-3" /> Released
              </span>
              <p className="text-xs font-semibold text-slate-200 mt-1">
                {firmware.releaseDate ? new Date(firmware.releaseDate).toLocaleDateString() : 'N/A'}
              </p>
            </div>

            <div className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-xl">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                <HardDrive className="w-3 h-3" /> Size
              </span>
              <p className="text-xs font-semibold text-slate-200 mt-1">
                {firmware.fileSize ? `${(firmware.fileSize / (1024 * 1024)).toFixed(2)} MB` : 'N/A'}
              </p>
            </div>

            <div className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-xl">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                <Server className="w-3 h-3" /> Active Fleet
              </span>
              <p className="text-xs font-semibold text-emerald-400 mt-1">
                {firmware.deviceCount || 0} Devices
              </p>
            </div>

            <div className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-xl">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                <Activity className="w-3 h-3" /> Deployments
              </span>
              <p className="text-xs font-semibold text-indigo-400 mt-1">
                {firmware.deploymentCount || 0} Runs
              </p>
            </div>
          </div>

          {/* SHA-256 Checksum Card */}
          <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-xl space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-indigo-400" />
                Verified Binary SHA-256 Checksum
              </span>
              <button
                onClick={handleCopyChecksum}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 transition"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <div className="font-mono text-xs text-indigo-300 break-all bg-slate-900/90 p-2.5 rounded-lg border border-slate-800">
              {firmware.checksum}
            </div>
          </div>

          {/* Changelog */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Changelog & Notes</h3>
            <div className="p-3 bg-slate-950/50 border border-slate-800/80 rounded-xl text-xs text-slate-300 whitespace-pre-wrap leading-relaxed">
              {firmware.changelog || 'No changelog provided for this version.'}
            </div>
          </div>

          {/* CVE Vulnerabilities */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <AlertOctagon className="w-3.5 h-3.5 text-rose-400" />
                Tracked CVE Advisories ({firmware.vulnerabilities?.length || 0})
              </h3>
            </div>

            {firmware.vulnerabilities && firmware.vulnerabilities.length > 0 ? (
              <div className="space-y-2.5">
                {firmware.vulnerabilities.map((cve, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-3"
                  >
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-rose-400">{cve.cveId}</span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                            cve.severity === 'critical'
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                              : cve.severity === 'high'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : 'bg-slate-800 text-slate-300'
                          }`}
                        >
                          {cve.severity}
                        </span>
                        {cve.cvssScore !== undefined && (
                          <span className="text-[10px] font-mono font-semibold text-slate-400">
                            CVSS: {cve.cvssScore.toFixed(1)}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-300">{cve.description || 'No description recorded.'}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 bg-slate-950/40 border border-slate-800/60 rounded-xl text-center text-xs text-slate-500">
                No active CVE vulnerabilities reported for this release.
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-800 flex items-center justify-between bg-slate-950/40">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            Close
          </button>

          {canManageFirmware && (
            <div className="flex items-center gap-2.5">
              <button
                onClick={() => {
                  onClose();
                  onOpenEditModal(firmware);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
              >
                <Edit3 className="w-3.5 h-3.5 text-indigo-400" />
                Edit Metadata & CVEs
              </button>

              <button
                onClick={() => {
                  onClose();
                  onOpenDeployModal(firmware);
                }}
                disabled={!isEligibleForDeployment}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                <Send className="w-3.5 h-3.5" />
                Deploy to Fleet
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
