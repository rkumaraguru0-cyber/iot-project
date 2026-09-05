import React, { useState } from 'react';
import { X, Key, Copy, Check, ShieldAlert, Cpu } from 'lucide-react';
import toast from 'react-hot-toast';
import { registerDevice } from '../../api/devices';

const DEVICE_TYPES = [
  { value: 'temperature_sensor', label: 'Temperature Sensor (TS)' },
  { value: 'smart_camera', label: 'Smart Camera (SC)' },
  { value: 'industrial_gateway', label: 'Industrial Gateway (IG)' },
  { value: 'medical_monitor', label: 'Medical Monitor (MM)' },
  { value: 'smart_lock', label: 'Smart Lock (SL)' }
];

export const RegisterDeviceModal = ({ isOpen, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    name: '',
    type: 'temperature_sensor',
    manufacturer: '',
    model: '',
    location: '',
    firmwareVersion: '',
    tagsText: ''
  });

  const [isLoading, setIsLoading] = useState(false);
  const [createdResult, setCreatedResult] = useState(null);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Parse tags (key:value format separated by commas or newlines)
      const tags = [];
      if (formData.tagsText.trim()) {
        const rawTags = formData.tagsText.split(/[,\n]/);
        for (const raw of rawTags) {
          const parts = raw.split(':');
          if (parts.length === 2 && parts[0].trim() && parts[1].trim()) {
            tags.push({ key: parts[0].trim(), value: parts[1].trim() });
          }
        }
      }

      const payload = {
        name: formData.name,
        type: formData.type,
        manufacturer: formData.manufacturer,
        model: formData.model,
        location: formData.location || undefined,
        firmwareVersion: formData.firmwareVersion || undefined,
        tags: tags.length > 0 ? tags : undefined
      };

      const result = await registerDevice(payload);
      setCreatedResult(result);
      toast.success('Device registered successfully');
      if (onSuccess) onSuccess(result.device);
    } catch (error) {
      const message = error.response?.data?.error?.message || 'Failed to register device';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyKey = () => {
    if (createdResult?.apiKey) {
      navigator.clipboard.writeText(createdResult.apiKey);
      setCopied(true);
      toast.success('API Key copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClose = () => {
    setCreatedResult(null);
    setFormData({
      name: '',
      type: 'temperature_sensor',
      manufacturer: '',
      model: '',
      location: '',
      firmwareVersion: '',
      tagsText: ''
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-fadeIn">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                {createdResult ? 'Device Credentials Issued' : 'Register New IoT Device'}
              </h3>
              <p className="text-xs text-slate-400">
                {createdResult ? 'Store your API key securely' : 'Provision hardware into your fleet inventory'}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        {createdResult ? (
          <div className="p-6 space-y-6">
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-start gap-3">
              <Check className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Registration Successful:</span> Device{' '}
                <span className="font-mono font-bold text-white">{createdResult.device.deviceId}</span> (
                {createdResult.device.name}) has been created in status{' '}
                <span className="font-bold text-white">registered</span>.
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-amber-400" />
                Device API Key (256-bit Secret)
              </label>
              <div className="relative">
                <input
                  type="text"
                  readOnly
                  value={createdResult.apiKey}
                  className="w-full bg-slate-950 border border-amber-500/40 rounded-xl px-4 py-3 text-xs font-mono text-amber-300 pr-24 select-all focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleCopyKey}
                  className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg transition flex items-center gap-1.5"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <span className="font-bold">Security Notice:</span> This API key will{' '}
                <span className="font-bold underline">NEVER</span> be shown again. Securely transfer it to your physical
                device or simulator configuration immediately.
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={handleClose}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition shadow-lg shadow-indigo-600/20"
              >
                Done & Return to Fleet
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Device Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                name="name"
                required
                value={formData.name}
                onChange={handleChange}
                placeholder="e.g., Server Room Temperature Sensor #1"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Device Type <span className="text-red-400">*</span>
                </label>
                <select
                  name="type"
                  value={formData.type}
                  onChange={handleChange}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                >
                  {DEVICE_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Firmware Version
                </label>
                <input
                  type="text"
                  name="firmwareVersion"
                  value={formData.firmwareVersion}
                  onChange={handleChange}
                  placeholder="e.g., v1.0.4"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Manufacturer <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  name="manufacturer"
                  required
                  value={formData.manufacturer}
                  onChange={handleChange}
                  placeholder="e.g., Siemens, Bosch"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Model <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  name="model"
                  required
                  value={formData.model}
                  onChange={handleChange}
                  placeholder="e.g., ST-9000-X"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Physical Location</label>
              <input
                type="text"
                name="location"
                value={formData.location}
                onChange={handleChange}
                placeholder="e.g., Building B, 3rd Floor, Data Center North"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Tags <span className="text-[10px] text-slate-500">(key:value format, comma-separated)</span>
              </label>
              <input
                type="text"
                name="tagsText"
                value={formData.tagsText}
                onChange={handleChange}
                placeholder="e.g., environment:prod, zone:tier-1, floor:3"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none font-mono"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={handleClose}
                disabled={isLoading}
                className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white bg-slate-800 rounded-xl transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition shadow-lg shadow-indigo-600/20 disabled:opacity-50 flex items-center gap-2"
              >
                {isLoading && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                Provision Device & Generate Key
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default RegisterDeviceModal;
