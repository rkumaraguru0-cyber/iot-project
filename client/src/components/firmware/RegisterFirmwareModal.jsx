import React, { useState } from 'react';
import { X, Plus, Trash2, Shield, HardDrive, AlertTriangle } from 'lucide-react';
import { createFirmwareVersion } from '../../api/firmware';
import toast from 'react-hot-toast';

const DEVICE_TYPES = [
  { value: 'temperature_sensor', label: 'Temperature Sensor' },
  { value: 'smart_camera', label: 'Smart Camera' },
  { value: 'industrial_gateway', label: 'Industrial Gateway' },
  { value: 'medical_monitor', label: 'Medical Monitor' },
  { value: 'smart_lock', label: 'Smart Lock' }
];

export const RegisterFirmwareModal = ({ isOpen, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    version: '',
    deviceType: 'temperature_sensor',
    checksum: '',
    fileSize: 1048576,
    releaseDate: new Date().toISOString().slice(0, 10),
    securityStatus: 'under_review',
    deploymentPolicy: 'restricted',
    changelog: ''
  });

  const [vulnerabilities, setVulnerabilities] = useState([]);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleAddVulnerability = () => {
    setVulnerabilities([
      ...vulnerabilities,
      {
        cveId: '',
        severity: 'medium',
        cvssScore: 5.0,
        description: ''
      }
    ]);
  };

  const handleRemoveVulnerability = (index) => {
    setVulnerabilities(vulnerabilities.filter((_, i) => i !== index));
  };

  const handleVulnChange = (index, field, value) => {
    const updated = [...vulnerabilities];
    updated[index][field] = value;
    setVulnerabilities(updated);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Checksum validation: 64 hex characters
    const cleanChecksum = formData.checksum.trim().toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(cleanChecksum)) {
      toast.error('Checksum must be exactly 64 hexadecimal characters (SHA-256)');
      return;
    }

    // Vulnerability validation
    for (const v of vulnerabilities) {
      if (!v.cveId.trim()) {
        toast.error('CVE ID is required for all added vulnerability entries');
        return;
      }
    }

    try {
      setLoading(true);
      await createFirmwareVersion({
        ...formData,
        checksum: cleanChecksum,
        fileSize: Number(formData.fileSize) || 0,
        releaseDate: new Date(formData.releaseDate).toISOString(),
        vulnerabilities: vulnerabilities.map((v) => ({
          ...v,
          cveId: v.cveId.trim().toUpperCase(),
          cvssScore: Number(v.cvssScore) || 0
        }))
      });

      toast.success(`Firmware v${formData.version} registered successfully`);
      onSuccess?.();
      onClose();
    } catch (err) {
      const msg = err.response?.data?.error?.message || err.message || 'Failed to register firmware version';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Register Firmware Version</h2>
              <p className="text-xs text-slate-400">Register verified firmware release metadata and SHA-256 checksum</p>
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Version */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Version Tag <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. 1.4.2"
                value={formData.version}
                onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Device Type */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Target Device Architecture <span className="text-rose-400">*</span>
              </label>
              <select
                value={formData.deviceType}
                onChange={(e) => setFormData({ ...formData, deviceType: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
              >
                {DEVICE_TYPES.map((dt) => (
                  <option key={dt.value} value={dt.value}>
                    {dt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* SHA-256 Checksum */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Binary SHA-256 Checksum <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              maxLength={64}
              placeholder="64-character SHA-256 hex string"
              value={formData.checksum}
              onChange={(e) => setFormData({ ...formData, checksum: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 font-mono text-xs text-indigo-300 focus:outline-none focus:border-indigo-500"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Exact binary verification checksum enforced during hardware OTA verification.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* File Size */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">File Size (bytes)</label>
              <input
                type="number"
                min="0"
                value={formData.fileSize}
                onChange={(e) => setFormData({ ...formData, fileSize: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Release Date */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Release Date <span className="text-rose-400">*</span>
              </label>
              <input
                type="date"
                required
                value={formData.releaseDate}
                onChange={(e) => setFormData({ ...formData, releaseDate: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Initial Security Status */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Initial Security Posture</label>
              <select
                value={formData.securityStatus}
                onChange={(e) => setFormData({ ...formData, securityStatus: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="under_review">Under Review</option>
                <option value="secure">Secure / Verified</option>
                <option value="vulnerable">Vulnerable</option>
                <option value="recalled">Recalled</option>
              </select>
            </div>

            {/* Initial Deployment Policy */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Deployment Policy</label>
              <select
                value={formData.deploymentPolicy}
                onChange={(e) => setFormData({ ...formData, deploymentPolicy: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="restricted">Restricted (Analyst approval required)</option>
                <option value="allowed">Allowed (Fleet-wide deployment)</option>
                <option value="blocked">Blocked (Deployment disabled)</option>
              </select>
            </div>
          </div>

          {/* Changelog */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Changelog / Release Notes</label>
            <textarea
              rows={3}
              placeholder="Release notes, security patches, hardware compatibility notes..."
              value={formData.changelog}
              onChange={(e) => setFormData({ ...formData, changelog: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 resize-none"
            />
          </div>

          {/* Vulnerabilities Section */}
          <div className="border-t border-slate-800/80 pt-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-indigo-400" />
                  Associated CVE Vulnerabilities ({vulnerabilities.length})
                </h3>
                <p className="text-[11px] text-slate-500">Track known CVE advisories against this firmware version</p>
              </div>
              <button
                type="button"
                onClick={handleAddVulnerability}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/20 transition"
              >
                <Plus className="w-3.5 h-3.5" />
                Add CVE
              </button>
            </div>

            {vulnerabilities.length > 0 && (
              <div className="space-y-3">
                {vulnerabilities.map((vuln, idx) => (
                  <div key={idx} className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="CVE-2026-XXXX"
                        value={vuln.cveId}
                        onChange={(e) => handleVulnChange(idx, 'cveId', e.target.value)}
                        className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                      />
                      <select
                        value={vuln.severity}
                        onChange={(e) => handleVulnChange(idx, 'severity', e.target.value)}
                        className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="critical">Critical</option>
                      </select>
                      <input
                        type="number"
                        min="0"
                        max="10"
                        step="0.1"
                        placeholder="CVSS (0-10)"
                        value={vuln.cvssScore}
                        onChange={(e) => handleVulnChange(idx, 'cvssScore', e.target.value)}
                        className="w-24 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveVulnerability(idx)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <input
                      type="text"
                      placeholder="Brief vulnerability summary / impact..."
                      value={vuln.description}
                      onChange={(e) => handleVulnChange(idx, 'description', e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                ))}
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
              disabled={loading}
              className="px-5 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20 disabled:opacity-50 transition"
            >
              {loading ? 'Registering...' : 'Register Version'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
