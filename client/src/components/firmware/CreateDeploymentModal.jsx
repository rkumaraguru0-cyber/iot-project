import React, { useState, useEffect } from 'react';
import { X, Send, AlertTriangle, CheckSquare, Square, HardDrive, ShieldAlert, Cpu } from 'lucide-react';
import { createDeployments } from '../../api/firmware';
import { getDevices } from '../../api/devices';
import toast from 'react-hot-toast';

export const CreateDeploymentModal = ({
  isOpen,
  onClose,
  initialFirmware,
  firmwareVersions = [],
  onSuccess
}) => {
  const [selectedFirmwareId, setSelectedFirmwareId] = useState('');
  const [eligibleDevices, setEligibleDevices] = useState([]);
  const [selectedDeviceIds, setSelectedDeviceIds] = useState([]);
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const selectedFirmware =
    firmwareVersions.find((f) => f._id === selectedFirmwareId) || initialFirmware || null;

  useEffect(() => {
    if (initialFirmware) {
      setSelectedFirmwareId(initialFirmware._id);
    } else if (firmwareVersions.length > 0 && !selectedFirmwareId) {
      // Find first eligible firmware
      const firstEligible = firmwareVersions.find(
        (f) => !['vulnerable', 'recalled'].includes(f.securityStatus) && f.deploymentPolicy !== 'blocked'
      );
      if (firstEligible) setSelectedFirmwareId(firstEligible._id);
    }
  }, [initialFirmware, firmwareVersions]);

  useEffect(() => {
    if (isOpen && selectedFirmware) {
      fetchCompatibleDevices(selectedFirmware.deviceType);
    }
  }, [isOpen, selectedFirmwareId]);

  const fetchCompatibleDevices = async (deviceType) => {
    try {
      setLoadingDevices(true);
      // Fetch devices matching deviceType and not decommissioned
      const res = await getDevices({
        type: deviceType,
        limit: 100
      });

      const activeDevices = (res.devices || []).filter((d) => d.status !== 'decommissioned');
      setEligibleDevices(activeDevices);
      setSelectedDeviceIds([]);
    } catch (err) {
      toast.error('Failed to load compatible fleet devices');
    } finally {
      setLoadingDevices(false);
    }
  };

  if (!isOpen) return null;

  const handleToggleDevice = (id) => {
    if (selectedDeviceIds.includes(id)) {
      setSelectedDeviceIds(selectedDeviceIds.filter((dId) => dId !== id));
    } else {
      setSelectedDeviceIds([...selectedDeviceIds, id]);
    }
  };

  const handleSelectAll = () => {
    if (selectedDeviceIds.length === eligibleDevices.length) {
      setSelectedDeviceIds([]);
    } else {
      setSelectedDeviceIds(eligibleDevices.map((d) => d._id));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!selectedFirmwareId) {
      toast.error('Please select a target firmware version');
      return;
    }

    if (selectedDeviceIds.length === 0) {
      toast.error('Please select at least one target device for deployment');
      return;
    }

    try {
      setSubmitting(true);
      const res = await createDeployments({
        firmwareVersionId: selectedFirmwareId,
        deviceIds: selectedDeviceIds
      });

      const createdCount = res.deployments?.length || 0;
      toast.success(`Initiated ${createdCount} OTA deployment${createdCount === 1 ? '' : 's'}`);

      // Handle non-blocking critical incident warnings
      if (res.warnings && res.warnings.length > 0) {
        toast((t) => (
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-amber-200">Advisory: Active Critical Incident Warning</p>
              <p className="text-[11px] text-slate-300 mt-0.5">
                {res.warnings.length} target device(s) have active critical security incidents. Deployments were created as requested.
              </p>
            </div>
          </div>
        ), { duration: 6000 });
      }

      onSuccess?.();
      onClose();
    } catch (err) {
      const msg = err.response?.data?.error?.message || err.message || 'Failed to initiate OTA deployment';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Send className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Create OTA Fleet Deployment</h2>
              <p className="text-xs text-slate-400">Deploy verified firmware updates to target hardware fleet</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Target Firmware Version Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Target Firmware Release <span className="text-rose-400">*</span>
            </label>
            <select
              value={selectedFirmwareId}
              onChange={(e) => setSelectedFirmwareId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
            >
              {firmwareVersions.map((fw) => {
                const isBlocked =
                  ['vulnerable', 'recalled'].includes(fw.securityStatus) ||
                  fw.deploymentPolicy === 'blocked';
                return (
                  <option key={fw._id} value={fw._id} disabled={isBlocked}>
                    v{fw.version} — {fw.deviceType.replace('_', ' ')} [{fw.securityStatus}, {fw.deploymentPolicy}]
                    {isBlocked ? ' (BLOCKED)' : ''}
                  </option>
                );
              })}
            </select>
          </div>

          {selectedFirmware && (
            <div className="p-3 bg-slate-950/70 border border-slate-800/80 rounded-xl flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">Release Checksum</span>
                <p className="text-xs font-mono text-indigo-300 truncate max-w-sm">{selectedFirmware.checksum}</p>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">Target Hardware</span>
                <p className="text-xs font-semibold text-slate-200 capitalize">
                  {selectedFirmware.deviceType?.replace('_', ' ')}
                </p>
              </div>
            </div>
          )}

          {/* Target Device Selection */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-indigo-400" />
                Select Target Fleet Devices ({selectedDeviceIds.length} / {eligibleDevices.length} selected)
              </label>
              {eligibleDevices.length > 0 && (
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold transition"
                >
                  {selectedDeviceIds.length === eligibleDevices.length ? 'Deselect All' : 'Select All'}
                </button>
              )}
            </div>

            {loadingDevices ? (
              <div className="p-8 text-center text-xs text-slate-500 bg-slate-950/40 rounded-xl border border-slate-800">
                Loading compatible devices...
              </div>
            ) : eligibleDevices.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500 bg-slate-950/40 rounded-xl border border-slate-800">
                No compatible devices found matching architecture '{selectedFirmware?.deviceType}'.
              </div>
            ) : (
              <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                {eligibleDevices.map((device) => {
                  const isSelected = selectedDeviceIds.includes(device._id);
                  const isAlreadyOnVersion =
                    selectedFirmware && device.currentFirmwareVersion === selectedFirmware.version;

                  return (
                    <div
                      key={device._id}
                      onClick={() => handleToggleDevice(device._id)}
                      className={`p-3 rounded-xl border cursor-pointer transition flex items-center justify-between ${
                        isSelected
                          ? 'bg-indigo-600/10 border-indigo-500/40 text-white'
                          : 'bg-slate-950/50 border-slate-800/80 text-slate-300 hover:bg-slate-800/50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-indigo-400 shrink-0" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-600 shrink-0" />
                        )}
                        <div>
                          <div className="text-xs font-bold text-slate-200 flex items-center gap-2">
                            <span>{device.name || device.deviceId}</span>
                            <span className="text-[10px] font-mono text-slate-500">({device.deviceId})</span>
                          </div>
                          <p className="text-[11px] text-slate-400">
                            Current Version:{' '}
                            <span className="font-mono text-slate-300">
                              v{device.currentFirmwareVersion || 'unknown'}
                            </span>
                            {isAlreadyOnVersion && (
                              <span className="ml-2 text-[10px] text-amber-400 font-semibold">(Already on target version)</span>
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="text-right">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                            device.status === 'online'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {device.status}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || selectedDeviceIds.length === 0}
              className="px-5 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              {submitting
                ? 'Initiating...'
                : `Deploy to ${selectedDeviceIds.length} Device${selectedDeviceIds.length === 1 ? '' : 's'}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
