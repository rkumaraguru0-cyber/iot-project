import React, { useState, useEffect } from 'react';
import {
  HardDrive,
  Shield,
  Plus,
  Search,
  Filter,
  RefreshCw,
  Send,
  Eye,
  Edit3,
  RotateCcw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Server,
  Activity,
  Layers,
  ArrowRight
} from 'lucide-react';
import { getFirmwareVersions, getDeployments, updateDeploymentStatus } from '../api/firmware';
import { useAuth } from '../contexts/AuthContext';
import { FirmwareSecurityBadge, DeploymentPolicyBadge } from '../components/firmware/FirmwareStatusBadge';
import { DeploymentStatusBadge } from '../components/firmware/DeploymentStatusBadge';
import { RegisterFirmwareModal } from '../components/firmware/RegisterFirmwareModal';
import { FirmwareDetailModal } from '../components/firmware/FirmwareDetailModal';
import { UpdateSecurityMetadataModal } from '../components/firmware/UpdateSecurityMetadataModal';
import { CreateDeploymentModal } from '../components/firmware/CreateDeploymentModal';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import toast from 'react-hot-toast';

export const FirmwarePage = () => {
  const { hasRole, user } = useAuth();
  const canManageFirmware = hasRole('security_analyst');
  const canUpdateDeployment = hasRole('operator');

  const [activeTab, setActiveTab] = useState('versions'); // 'versions' | 'deployments'

  // Firmware Versions State
  const [versions, setVersions] = useState([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [versionFilters, setVersionFilters] = useState({
    deviceType: '',
    securityStatus: '',
    deploymentPolicy: '',
    search: ''
  });

  // Deployments State
  const [deployments, setDeployments] = useState([]);
  const [loadingDeployments, setLoadingDeployments] = useState(false);
  const [deploymentFilters, setDeploymentFilters] = useState({
    status: ''
  });

  // Modals
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeployOpen, setIsDeployOpen] = useState(false);
  const [selectedFirmware, setSelectedFirmware] = useState(null);

  // Rollback Confirmation State
  const [rollbackTarget, setRollbackTarget] = useState(null);
  const [rollbackLoading, setRollbackLoading] = useState(false);

  // Status Advance State (for simulation/operator management)
  const [statusActionTarget, setStatusActionTarget] = useState(null);
  const [statusActionLoading, setStatusActionLoading] = useState(false);

  useEffect(() => {
    if (activeTab === 'versions') {
      fetchVersions();
    } else {
      fetchDeployments();
    }
  }, [activeTab, versionFilters, deploymentFilters]);

  const fetchVersions = async () => {
    try {
      setLoadingVersions(true);
      const params = {};
      if (versionFilters.deviceType) params.deviceType = versionFilters.deviceType;
      if (versionFilters.securityStatus) params.securityStatus = versionFilters.securityStatus;
      if (versionFilters.deploymentPolicy) params.deploymentPolicy = versionFilters.deploymentPolicy;
      if (versionFilters.search) params.search = versionFilters.search;

      const res = await getFirmwareVersions(params);
      setVersions(res.versions || []);
    } catch (err) {
      toast.error('Failed to load firmware releases');
    } finally {
      setLoadingVersions(false);
    }
  };

  const fetchDeployments = async () => {
    try {
      setLoadingDeployments(true);
      const params = {};
      if (deploymentFilters.status) params.status = deploymentFilters.status;

      const res = await getDeployments(params);
      setDeployments(res.deployments || []);
    } catch (err) {
      toast.error('Failed to load deployment records');
    } finally {
      setLoadingDeployments(false);
    }
  };

  const handleRollbackConfirm = async () => {
    if (!rollbackTarget) return;

    try {
      setRollbackLoading(true);
      await updateDeploymentStatus(rollbackTarget._id, {
        status: 'rolled_back',
        result: {
          message: `Manual rollback triggered by ${user?.displayName || user?.email || 'security analyst'}`
        }
      });

      toast.success(`Deployment ${rollbackTarget.deploymentId} rolled back successfully`);
      setRollbackTarget(null);
      fetchDeployments();
    } catch (err) {
      const msg = err.response?.data?.error?.message || err.message || 'Rollback failed';
      toast.error(msg);
    } finally {
      setRollbackLoading(false);
    }
  };

  const handleAdvanceStatus = async (deployment, nextStatus) => {
    try {
      setStatusActionLoading(true);
      const payload = { status: nextStatus };
      if (nextStatus === 'success') {
        payload.result = {
          verificationChecksum: deployment.firmwareVersionId?.checksum || '',
          message: 'Hardware verification successful'
        };
      } else if (nextStatus === 'failed') {
        payload.result = {
          message: 'Hardware installation failed signature verification'
        };
      }

      await updateDeploymentStatus(deployment._id, payload);
      toast.success(`Deployment updated to '${nextStatus}'`);
      fetchDeployments();
    } catch (err) {
      const msg = err.response?.data?.error?.message || err.message || 'Status transition failed';
      toast.error(msg);
    } finally {
      setStatusActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/60 p-6 rounded-2xl border border-slate-800/80 backdrop-blur-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-white shadow-lg shadow-indigo-500/20">
              <HardDrive className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-white tracking-tight">Firmware Security & OTA Operations</h1>
              <p className="text-xs text-slate-400">
                Manage hardware firmware integrity, track CVE advisories, and orchestrate verified fleet updates
              </p>
            </div>
          </div>
        </div>

        {/* Global Header Actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => (activeTab === 'versions' ? fetchVersions() : fetchDeployments())}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          {canManageFirmware && (
            <>
              <button
                onClick={() => setIsRegisterOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 shadow-md transition"
              >
                <Plus className="w-4 h-4 text-indigo-400" />
                Register Version
              </button>

              <button
                onClick={() => {
                  setSelectedFirmware(null);
                  setIsDeployOpen(true);
                }}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20 transition"
              >
                <Send className="w-4 h-4" />
                New OTA Deployment
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="flex items-center gap-2 border-b border-slate-800/80 pb-px">
        <button
          onClick={() => setActiveTab('versions')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition ${
            activeTab === 'versions'
              ? 'border-indigo-500 text-white bg-slate-900/40 rounded-t-xl'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Layers className="w-4 h-4" />
          Firmware Releases & CVEs
          <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-800 text-slate-300">
            {versions.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('deployments')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition ${
            activeTab === 'deployments'
              ? 'border-indigo-500 text-white bg-slate-900/40 rounded-t-xl'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Activity className="w-4 h-4" />
          OTA Deployments & Rollbacks
          <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-800 text-slate-300">
            {deployments.length}
          </span>
        </button>
      </div>

      {/* ========================================================= */}
      {/* TAB 1: FIRMWARE VERSIONS & CVEs */}
      {/* ========================================================= */}
      {activeTab === 'versions' && (
        <div className="space-y-4">
          {/* Search & Filters Bar */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-slate-900/40 p-3.5 rounded-xl border border-slate-800/60">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search version or changelog..."
                value={versionFilters.search}
                onChange={(e) => setVersionFilters({ ...versionFilters, search: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <select
              value={versionFilters.deviceType}
              onChange={(e) => setVersionFilters({ ...versionFilters, deviceType: e.target.value })}
              className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="">All Device Types</option>
              <option value="temperature_sensor">Temperature Sensor</option>
              <option value="smart_camera">Smart Camera</option>
              <option value="industrial_gateway">Industrial Gateway</option>
              <option value="medical_monitor">Medical Monitor</option>
              <option value="smart_lock">Smart Lock</option>
            </select>

            <select
              value={versionFilters.securityStatus}
              onChange={(e) => setVersionFilters({ ...versionFilters, securityStatus: e.target.value })}
              className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="">All Security Statuses</option>
              <option value="secure">Secure / Verified</option>
              <option value="under_review">Under Review</option>
              <option value="vulnerable">Vulnerable</option>
              <option value="recalled">Recalled</option>
            </select>

            <select
              value={versionFilters.deploymentPolicy}
              onChange={(e) => setVersionFilters({ ...versionFilters, deploymentPolicy: e.target.value })}
              className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="">All Policies</option>
              <option value="allowed">Allowed</option>
              <option value="restricted">Restricted (Analyst+)</option>
              <option value="blocked">Blocked</option>
            </select>
          </div>

          {/* Versions Table */}
          {loadingVersions ? (
            <div className="p-12 text-center text-xs text-slate-500 bg-slate-900/40 rounded-2xl border border-slate-800">
              Loading firmware release registry...
            </div>
          ) : versions.length === 0 ? (
            <div className="p-12 text-center space-y-2 bg-slate-900/40 rounded-2xl border border-slate-800">
              <HardDrive className="w-8 h-8 text-slate-600 mx-auto" />
              <p className="text-sm font-semibold text-slate-300">No firmware versions found</p>
              <p className="text-xs text-slate-500">Register new firmware releases to manage OTA deployments</p>
            </div>
          ) : (
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/60 border-b border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    <tr>
                      <th className="px-5 py-3.5">Version & Architecture</th>
                      <th className="px-5 py-3.5">Security Posture</th>
                      <th className="px-5 py-3.5">Deployment Policy</th>
                      <th className="px-5 py-3.5">CVE Vulnerabilities</th>
                      <th className="px-5 py-3.5">Fleet Adoption</th>
                      <th className="px-5 py-3.5">Release Date</th>
                      <th className="px-5 py-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {versions.map((fw) => {
                      const isDeployable =
                        !['vulnerable', 'recalled'].includes(fw.securityStatus) &&
                        fw.deploymentPolicy !== 'blocked';

                      return (
                        <tr key={fw._id} className="hover:bg-slate-800/30 transition">
                          <td className="px-5 py-4">
                            <div className="font-bold text-white flex items-center gap-2">
                              <span>v{fw.version}</span>
                            </div>
                            <span className="text-[11px] text-slate-400 capitalize">
                              {fw.deviceType?.replace('_', ' ')}
                            </span>
                            <div className="font-mono text-[10px] text-indigo-400 truncate max-w-[200px] mt-0.5">
                              {fw.checksum}
                            </div>
                          </td>

                          <td className="px-5 py-4">
                            <FirmwareSecurityBadge status={fw.securityStatus} />
                          </td>

                          <td className="px-5 py-4">
                            <DeploymentPolicyBadge policy={fw.deploymentPolicy} />
                          </td>

                          <td className="px-5 py-4">
                            {fw.vulnerabilities && fw.vulnerabilities.length > 0 ? (
                              <div className="flex flex-wrap gap-1 max-w-xs">
                                {fw.vulnerabilities.slice(0, 2).map((vuln, i) => (
                                  <span
                                    key={i}
                                    className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-rose-500/10 text-rose-400 border border-rose-500/20"
                                  >
                                    {vuln.cveId}
                                  </span>
                                ))}
                                {fw.vulnerabilities.length > 2 && (
                                  <span className="text-[10px] text-slate-500">
                                    +{fw.vulnerabilities.length - 2} more
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-500 text-[11px]">0 reported</span>
                            )}
                          </td>

                          <td className="px-5 py-4">
                            <div className="text-slate-200 font-semibold">{fw.deviceCount || 0} devices</div>
                            <span className="text-[10px] text-slate-500">{fw.deploymentCount || 0} deployments</span>
                          </td>

                          <td className="px-5 py-4 text-slate-400">
                            {fw.releaseDate ? new Date(fw.releaseDate).toLocaleDateString() : 'N/A'}
                          </td>

                          <td className="px-5 py-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => {
                                  setSelectedFirmware(fw);
                                  setIsDetailOpen(true);
                                }}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                                title="View Release Details"
                              >
                                <Eye className="w-4 h-4" />
                              </button>

                              {canManageFirmware && (
                                <>
                                  <button
                                    onClick={() => {
                                      setSelectedFirmware(fw);
                                      setIsEditOpen(true);
                                    }}
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-400 hover:bg-slate-800 transition"
                                    title="Edit Metadata & CVEs"
                                  >
                                    <Edit3 className="w-4 h-4" />
                                  </button>

                                  <button
                                    onClick={() => {
                                      setSelectedFirmware(fw);
                                      setIsDeployOpen(true);
                                    }}
                                    disabled={!isDeployable}
                                    className="p-1.5 rounded-lg text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 disabled:opacity-30 disabled:cursor-not-allowed transition"
                                    title={isDeployable ? 'Deploy to Fleet' : 'Deployment blocked by security policy'}
                                  >
                                    <Send className="w-4 h-4" />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2: OTA DEPLOYMENTS & ROLLBACKS */}
      {/* ========================================================= */}
      {activeTab === 'deployments' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="flex items-center justify-between bg-slate-900/40 p-3.5 rounded-xl border border-slate-800/60">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5" />
                Filter by Stage:
              </span>
              <select
                value={deploymentFilters.status}
                onChange={(e) => setDeploymentFilters({ ...deploymentFilters, status: e.target.value })}
                className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="">All Lifecycle Stages</option>
                <option value="pending">Pending</option>
                <option value="downloading">Downloading</option>
                <option value="installing">Installing</option>
                <option value="verifying">Verifying</option>
                <option value="success">Success</option>
                <option value="failed">Failed</option>
                <option value="rolled_back">Rolled Back</option>
              </select>
            </div>
          </div>

          {/* Deployments Table */}
          {loadingDeployments ? (
            <div className="p-12 text-center text-xs text-slate-500 bg-slate-900/40 rounded-2xl border border-slate-800">
              Loading OTA deployment records...
            </div>
          ) : deployments.length === 0 ? (
            <div className="p-12 text-center space-y-2 bg-slate-900/40 rounded-2xl border border-slate-800">
              <Activity className="w-8 h-8 text-slate-600 mx-auto" />
              <p className="text-sm font-semibold text-slate-300">No OTA deployments found</p>
              <p className="text-xs text-slate-500">Initiate a batch deployment from the firmware releases tab</p>
            </div>
          ) : (
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/60 border-b border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    <tr>
                      <th className="px-5 py-3.5">Deployment ID</th>
                      <th className="px-5 py-3.5">Target Device</th>
                      <th className="px-5 py-3.5">Target Version</th>
                      <th className="px-5 py-3.5">Lifecycle Stage</th>
                      <th className="px-5 py-3.5">Initiated</th>
                      <th className="px-5 py-3.5">Result / Diagnostics</th>
                      <th className="px-5 py-3.5 text-right">Operations</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {deployments.map((dep) => {
                      const device = dep.deviceId;
                      const firmware = dep.firmwareVersionId;
                      const isFailed = dep.status === 'failed';
                      const canRollback = isFailed && dep.previousFirmwareVersion && canManageFirmware;

                      return (
                        <tr key={dep._id} className="hover:bg-slate-800/30 transition">
                          <td className="px-5 py-4">
                            <span className="font-mono text-xs font-bold text-indigo-400">{dep.deploymentId}</span>
                            {dep.previousFirmwareVersion && (
                              <div className="text-[10px] text-slate-500 mt-0.5">
                                Prev: v{dep.previousFirmwareVersion}
                              </div>
                            )}
                          </td>

                          <td className="px-5 py-4">
                            <div className="font-semibold text-slate-200">{device?.name || device?.deviceId}</div>
                            <span className="text-[10px] font-mono text-slate-500 capitalize">
                              {device?.type?.replace('_', ' ')}
                            </span>
                          </td>

                          <td className="px-5 py-4">
                            <span className="font-semibold text-white">v{firmware?.version || 'unknown'}</span>
                          </td>

                          <td className="px-5 py-4">
                            <DeploymentStatusBadge status={dep.status} />
                          </td>

                          <td className="px-5 py-4 text-slate-400">
                            <div>{dep.initiatedAt ? new Date(dep.initiatedAt).toLocaleDateString() : 'N/A'}</div>
                            <span className="text-[10px] text-slate-500">
                              by {dep.initiatedBy?.displayName || 'Operator'}
                            </span>
                          </td>

                          <td className="px-5 py-4 max-w-xs">
                            {dep.result?.message ? (
                              <div
                                className={`text-[11px] truncate ${
                                  dep.status === 'failed' ? 'text-rose-400' : 'text-slate-300'
                                }`}
                              >
                                {dep.result.message}
                              </div>
                            ) : (
                              <span className="text-slate-600 text-[10px]">In progress...</span>
                            )}
                          </td>

                          <td className="px-5 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {/* Rollback Action Button */}
                              {canRollback && (
                                <button
                                  onClick={() => setRollbackTarget(dep)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 transition"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                  Rollback
                                </button>
                              )}

                              {/* Operator Lifecycle Simulation / Status Transition Controls */}
                              {canUpdateDeployment && dep.status === 'pending' && (
                                <button
                                  onClick={() => handleAdvanceStatus(dep, 'downloading')}
                                  className="px-2 py-1 rounded text-[11px] font-semibold bg-slate-800 hover:bg-slate-700 text-sky-400 border border-slate-700"
                                >
                                  Start Download
                                </button>
                              )}

                              {canUpdateDeployment && dep.status === 'downloading' && (
                                <button
                                  onClick={() => handleAdvanceStatus(dep, 'installing')}
                                  className="px-2 py-1 rounded text-[11px] font-semibold bg-slate-800 hover:bg-slate-700 text-indigo-400 border border-slate-700"
                                >
                                  Start Install
                                </button>
                              )}

                              {canUpdateDeployment && dep.status === 'installing' && (
                                <button
                                  onClick={() => handleAdvanceStatus(dep, 'verifying')}
                                  className="px-2 py-1 rounded text-[11px] font-semibold bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700"
                                >
                                  Verify Checksum
                                </button>
                              )}

                              {canUpdateDeployment && dep.status === 'verifying' && (
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => handleAdvanceStatus(dep, 'success')}
                                    className="p-1 rounded bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/30"
                                    title="Verify & Complete"
                                  >
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleAdvanceStatus(dep, 'failed')}
                                    className="p-1 rounded bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/30"
                                    title="Fail Deployment"
                                  >
                                    <XCircle className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      <RegisterFirmwareModal
        isOpen={isRegisterOpen}
        onClose={() => setIsRegisterOpen(false)}
        onSuccess={fetchVersions}
      />

      <FirmwareDetailModal
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        firmware={selectedFirmware}
        onOpenEditModal={(fw) => {
          setSelectedFirmware(fw);
          setIsEditOpen(true);
        }}
        onOpenDeployModal={(fw) => {
          setSelectedFirmware(fw);
          setIsDeployOpen(true);
        }}
        canManageFirmware={canManageFirmware}
      />

      <UpdateSecurityMetadataModal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        firmware={selectedFirmware}
        onSuccess={() => {
          fetchVersions();
          setIsEditOpen(false);
        }}
      />

      <CreateDeploymentModal
        isOpen={isDeployOpen}
        onClose={() => setIsDeployOpen(false)}
        initialFirmware={selectedFirmware}
        firmwareVersions={versions}
        onSuccess={() => {
          setActiveTab('deployments');
          fetchDeployments();
        }}
      />

      {/* Rollback Confirm Dialog */}
      <ConfirmDialog
        isOpen={!!rollbackTarget}
        title="Confirm Firmware Rollback"
        message={`Are you sure you want to revert device '${rollbackTarget?.deviceId?.name || rollbackTarget?.deviceId?.deviceId}' back to previous firmware version v${rollbackTarget?.previousFirmwareVersion}? This will transition deployment ${rollbackTarget?.deploymentId} to 'rolled_back'.`}
        confirmLabel="Rollback Firmware"
        isDestructive={true}
        isLoading={rollbackLoading}
        onConfirm={handleRollbackConfirm}
        onCancel={() => setRollbackTarget(null)}
      />
    </div>
  );
};

export default FirmwarePage;
