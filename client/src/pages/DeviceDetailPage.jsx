import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { getDeviceById, regenerateDeviceApiKey, updateDevice } from '../api/devices';
import { StatusBadge, HealthBadge, RiskBadge } from '../components/devices/DeviceStatusBadge';
import { StateChangeModal } from '../components/devices/StateChangeModal';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import {
  Cpu,
  ArrowLeft,
  Key,
  SlidersHorizontal,
  Clock,
  Shield,
  Tag,
  MapPin,
  Calendar,
  Activity,
  AlertOctagon,
  Copy,
  Check,
  Edit2
} from 'lucide-react';
import toast from 'react-hot-toast';

export const DeviceDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { hasRole } = useAuth();

  const [isStateModalOpen, setIsStateModalOpen] = useState(false);
  const [isRegenConfirmOpen, setIsRegenConfirmOpen] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [newApiKey, setNewApiKey] = useState(null);
  const [copiedKey, setCopiedKey] = useState(false);

  const {
    data: device,
    isLoading,
    refetch
  } = useQuery({
    queryKey: ['device', id],
    queryFn: () => getDeviceById(id)
  });

  const handleRegenerateKey = async () => {
    setIsRegenerating(true);
    try {
      const result = await regenerateDeviceApiKey(device._id || device.id);
      setNewApiKey(result.apiKey);
      setIsRegenConfirmOpen(false);
      toast.success('Device API key regenerated successfully');
      refetch();
    } catch (error) {
      const message = error.response?.data?.error?.message || 'Failed to regenerate API key';
      toast.error(message);
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleCopyNewKey = () => {
    if (newApiKey) {
      navigator.clipboard.writeText(newApiKey);
      setCopiedKey(true);
      toast.success('New API Key copied');
      setTimeout(() => setCopiedKey(false), 2000);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-slate-500">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs font-semibold">Retrieving hardware forensics & metadata...</p>
      </div>
    );
  }

  if (!device) {
    return (
      <div className="text-center py-20">
        <h2 className="text-base font-bold text-white mb-2">Device Not Found</h2>
        <p className="text-xs text-slate-400 mb-6">The requested IoT device does not exist or has been removed.</p>
        <button
          onClick={() => navigate('/devices')}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl"
        >
          Return to Inventory
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Back Button & Top Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/devices')}
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Device Fleet
        </button>
      </div>

      {/* Main Header Card */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="p-3.5 rounded-2xl bg-indigo-600/10 border border-indigo-500/30 text-indigo-400 shrink-0">
              <Cpu className="w-8 h-8" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-3 mb-1">
                <h1 className="text-xl font-black text-white tracking-tight">{device.name}</h1>
                <span className="text-xs font-mono bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800 text-slate-400 font-bold">
                  {device.deviceId}
                </span>
              </div>
              <p className="text-xs text-slate-400 flex items-center gap-2">
                <span>{device.manufacturer} • {device.model}</span>
                <span>•</span>
                <span className="capitalize">{device.type?.replace('_', ' ')}</span>
              </p>
            </div>
          </div>

          {/* Status Indicators & Actions */}
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge status={device.status} />
            <HealthBadge healthStatus={device.healthStatus} />
            <RiskBadge riskScore={device.riskScore} riskSeverity={device.riskSeverity} />

            {hasRole('operator') && device.status !== 'decommissioned' && (
              <button
                onClick={() => setIsStateModalOpen(true)}
                className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-lg shadow-indigo-600/20"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                Change State
              </button>
            )}

            {hasRole('security_analyst') && (
              <button
                onClick={() => setIsRegenConfirmOpen(true)}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
              >
                <Key className="w-3.5 h-3.5" />
                Regenerate API Key
              </button>
            )}
          </div>
        </div>

        {/* Newly Regenerated API Key Alert Banner */}
        {newApiKey && (
          <div className="mt-6 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/40 space-y-2 animate-fadeIn">
            <div className="flex items-center justify-between text-xs font-bold text-amber-300">
              <span className="flex items-center gap-1.5">
                <Key className="w-4 h-4" />
                New Device API Key Issued (256-bit Secret)
              </span>
              <span className="text-[11px] text-amber-400">Copy immediately — will not be shown again</span>
            </div>
            <div className="relative">
              <input
                type="text"
                readOnly
                value={newApiKey}
                className="w-full bg-slate-950 border border-amber-500/40 rounded-xl px-4 py-2.5 text-xs font-mono text-amber-300 pr-24 select-all focus:outline-none"
              />
              <button
                type="button"
                onClick={handleCopyNewKey}
                className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg transition flex items-center gap-1.5"
              >
                {copiedKey ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedKey ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Grid: Details & Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Metadata & Risk Breakdown */}
        <div className="lg:col-span-2 space-y-6">
          {/* Metadata Grid */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-6">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
              <Cpu className="w-4 h-4 text-indigo-400" />
              Hardware Specification & Provisioning
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-3.5 bg-slate-950/60 rounded-xl border border-slate-800/80">
                <span className="text-slate-500 block mb-1">Manufacturer / Model</span>
                <span className="font-semibold text-slate-200">
                  {device.manufacturer} — {device.model}
                </span>
              </div>

              <div className="p-3.5 bg-slate-950/60 rounded-xl border border-slate-800/80">
                <span className="text-slate-500 block mb-1">Physical Location</span>
                <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-indigo-400" />
                  {device.location || 'Not Specified'}
                </span>
              </div>

              <div className="p-3.5 bg-slate-950/60 rounded-xl border border-slate-800/80">
                <span className="text-slate-500 block mb-1">Installed Firmware Version</span>
                <span className="font-semibold font-mono text-slate-200">
                  {device.currentFirmwareVersion || 'No firmware recorded'}
                </span>
              </div>

              <div className="p-3.5 bg-slate-950/60 rounded-xl border border-slate-800/80">
                <span className="text-slate-500 block mb-1">Expected Reporting Interval</span>
                <span className="font-semibold text-slate-200">
                  {device.expectedReportingInterval} seconds
                </span>
              </div>
            </div>

            {/* Tags */}
            <div className="mt-4 pt-4 border-t border-slate-800/60">
              <span className="text-slate-500 text-xs block mb-2 font-medium flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-indigo-400" />
                Asset Tags
              </span>
              <div className="flex flex-wrap gap-2">
                {device.tags && device.tags.length > 0 ? (
                  device.tags.map((tag, idx) => (
                    <span
                      key={idx}
                      className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-300"
                    >
                      <span className="text-slate-500">{tag.key}:</span> {tag.value}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-slate-500 italic">No tags assigned</span>
                )}
              </div>
            </div>
          </div>

          {/* Risk Factors Posture */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-6">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
              <Shield className="w-4 h-4 text-indigo-400" />
              Risk Posture & Factor Breakdown
            </h2>

            <div className="flex items-center justify-between p-4 bg-slate-950/70 rounded-2xl border border-slate-800/80 mb-4">
              <div>
                <span className="text-xs text-slate-400 block font-medium">Deterministic Fleet Risk Score</span>
                <span className="text-2xl font-black text-white">
                  {device.riskScore} <span className="text-xs text-slate-500 font-normal">/ 100</span>
                </span>
              </div>
              <RiskBadge riskScore={device.riskScore} riskSeverity={device.riskSeverity} />
            </div>

            <p className="text-xs text-slate-400 leading-relaxed mb-4">
              Risk score is calculated deterministically across 7 weighted security factors linking directly to
              active security events, firmware vulnerability posture, and reporting anomalies.
            </p>

            <div className="space-y-2">
              {device.riskFactors && device.riskFactors.length > 0 ? (
                device.riskFactors.map((factor, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-slate-950/40 rounded-xl border border-slate-800/60 flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-semibold text-slate-200">{factor.name}</div>
                      <div className="text-[11px] text-slate-500">{factor.detail || 'Normal'}</div>
                    </div>
                    <div className="font-mono font-bold text-slate-300">
                      +{factor.value} / {factor.maxValue}
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-3 bg-slate-950/40 rounded-xl border border-slate-800/60 text-xs text-slate-500 text-center">
                  No active risk factors recorded (Baseline 0 / 100)
                </div>
              )}
            </div>
          </div>

          {/* Future Phase Placeholders (Explicitly Labelled per Contract) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-5 bg-slate-900/40 border border-slate-800/60 border-dashed rounded-3xl text-center space-y-2">
              <Activity className="w-6 h-6 text-slate-600 mx-auto" />
              <div className="text-xs font-bold text-slate-300">Telemetry Ingestion & Charts</div>
              <p className="text-[11px] text-slate-500">
                Live metrics & time-series streaming will become available after Phase 6 (MQTT + Telemetry Ingestion).
              </p>
            </div>

            <div className="p-5 bg-slate-900/40 border border-slate-800/60 border-dashed rounded-3xl text-center space-y-2">
              <AlertOctagon className="w-6 h-6 text-slate-600 mx-auto" />
              <div className="text-xs font-bold text-slate-300">Security Event Forensics</div>
              <p className="text-[11px] text-slate-500">
                Rule-triggered security detections will become available after Phase 8 (Detection & Security Events).
              </p>
            </div>
          </div>
        </div>

        {/* Right 1 Col: Device Timeline */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-6 flex flex-col h-fit">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
            <Clock className="w-4 h-4 text-indigo-400" />
            Device Audit Timeline
          </h2>

          <div className="space-y-4">
            {!device.timeline || device.timeline.length === 0 ? (
              <p className="text-xs text-slate-500 italic">No timeline entries recorded.</p>
            ) : (
              [...device.timeline].reverse().map((entry, idx) => (
                <div key={idx} className="relative pl-6 pb-2 border-l border-slate-800 last:border-transparent">
                  <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 absolute -left-[5px] top-1" />
                  <div className="text-xs font-bold text-slate-200 capitalize">
                    {entry.action?.replace('.', ' ')}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">{entry.details}</div>
                  <div className="text-[10px] font-mono text-slate-500 mt-1 flex items-center gap-2">
                    <span>by {entry.actor}</span>
                    <span>•</span>
                    <span>{new Date(entry.timestamp).toLocaleString()}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* State Change Modal */}
      <StateChangeModal
        isOpen={isStateModalOpen}
        device={device}
        onClose={() => setIsStateModalOpen(false)}
        onSuccess={() => refetch()}
      />

      {/* API Key Regeneration Confirm Dialog */}
      <ConfirmDialog
        isOpen={isRegenConfirmOpen}
        title="Regenerate Device API Key"
        message="Are you sure you want to regenerate the API key for this device? The existing API key will be immediately invalidated and any connected simulator or device will lose authentication until updated with the new key."
        confirmLabel="Regenerate & Invalidate Old Key"
        isDestructive={true}
        isLoading={isRegenerating}
        onConfirm={handleRegenerateKey}
        onCancel={() => setIsRegenConfirmOpen(false)}
      />
    </div>
  );
};

export default DeviceDetailPage;
