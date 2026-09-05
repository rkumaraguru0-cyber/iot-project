import React, { useState } from 'react';
import { X, Activity, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { updateDevice } from '../../api/devices';
import { useAuth } from '../../contexts/AuthContext';

const VALID_TRANSITIONS = {
  registered: ['active'],
  active: ['maintenance', 'quarantined', 'decommissioned'],
  maintenance: ['active', 'decommissioned'],
  quarantined: ['active', 'decommissioned'],
  decommissioned: []
};

const STATUS_LABELS = {
  active: 'Active (Operational)',
  maintenance: 'Maintenance (Offline for Servicing)',
  quarantined: 'Quarantined (Security Isolation)',
  decommissioned: 'Decommissioned (Permanent Retirement)'
};

export const StateChangeModal = ({ isOpen, device, onClose, onSuccess }) => {
  const { hasRole } = require('../../contexts/AuthContext').useAuth();
  const [targetStatus, setTargetStatus] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen || !device) return null;

  const allowedTransitions = VALID_TRANSITIONS[device.status] || [];

  const handleTransition = async (e) => {
    e.preventDefault();
    if (!targetStatus) return;

    if (targetStatus === 'decommissioned' && !hasRole('security_analyst')) {
      toast.error('Decommissioning a device requires at least Security Analyst role');
      return;
    }

    setIsLoading(true);
    try {
      const updated = await updateDevice(device._id || device.id, { status: targetStatus });
      toast.success(`Device transitioned to ${targetStatus}`);
      if (onSuccess) onSuccess(updated);
      onClose();
    } catch (error) {
      const message = error.response?.data?.error?.message || 'Failed to update device state';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-fadeIn">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Transition Device State</h3>
              <p className="text-xs text-slate-400">
                {device.name} ({device.deviceId})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleTransition} className="p-6 space-y-4">
          <div>
            <span className="block text-xs font-semibold text-slate-400 mb-1">Current Lifecycle State</span>
            <div className="px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-white uppercase tracking-wider">
              {device.status}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Select Target State <span className="text-red-400">*</span>
            </label>
            {allowedTransitions.length === 0 ? (
              <div className="p-3 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-zinc-400">
                This device is in terminal state <span className="font-bold text-zinc-200">{device.status}</span>. No
                further state transitions are permitted.
              </div>
            ) : (
              <select
                value={targetStatus}
                onChange={(e) => setTargetStatus(e.target.value)}
                required
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:border-indigo-500 focus:outline-none"
              >
                <option value="">-- Choose New State --</option>
                {allowedTransitions.map((status) => (
                  <option key={status} value={status}>
                    {STATUS_LABELS[status] || status}
                  </option>
                ))}
              </select>
            )}
          </div>

          {targetStatus === 'quarantined' && (
            <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Quarantine Isolation:</span> Device will be marked as isolated in the SOC
                command center. Telemetry will still be logged for forensics.
              </div>
            </div>
          )}

          {targetStatus === 'decommissioned' && (
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Permanent Retirement:</span> Decommissioning is a terminal transition. The
                device cannot be re-activated. (Requires Security Analyst role)
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white bg-slate-800 rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || !targetStatus || allowedTransitions.length === 0}
              className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition disabled:opacity-50 flex items-center gap-2"
            >
              {isLoading && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              Apply Transition
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default StateChangeModal;
