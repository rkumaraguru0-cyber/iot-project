import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { getCurrentOrganization, updateCurrentOrganization } from '../api/organizations';
import { updateProfile, changePassword } from '../api/users';
import { Settings, Shield, User, Key, Save, AlertTriangle, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export const SettingsPage = () => {
  const { user, updateUserState, hasRole } = useAuth();
  const [activeTab, setActiveTab] = useState('org');

  // Org Settings Form State
  const [orgForm, setOrgForm] = useState({
    name: '',
    slaThresholds: {
      critical: { triage: 15, resolve: 240 },
      high: { triage: 60, resolve: 1440 },
      medium: { triage: 240, resolve: 4320 },
      low: { triage: 1440, resolve: 10080 }
    },
    autoQuarantine: {
      enabled: false,
      threshold: 80
    },
    alertPreferences: {
      minSeverity: 'medium'
    }
  });
  const [isSavingOrg, setIsSavingOrg] = useState(false);

  // User Profile Form State
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Password Change Form State
  const [passwords, setPasswords] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  // Fetch Current Org
  const { data: orgData, isLoading: isOrgLoading } = useQuery({
    queryKey: ['current-organization'],
    queryFn: getCurrentOrganization
  });

  useEffect(() => {
    if (orgData) {
      setOrgForm({
        name: orgData.name || '',
        slaThresholds: {
          critical: {
            triage: orgData.settings?.slaThresholds?.critical?.triage ?? 15,
            resolve: orgData.settings?.slaThresholds?.critical?.resolve ?? 240
          },
          high: {
            triage: orgData.settings?.slaThresholds?.high?.triage ?? 60,
            resolve: orgData.settings?.slaThresholds?.high?.resolve ?? 1440
          },
          medium: {
            triage: orgData.settings?.slaThresholds?.medium?.triage ?? 240,
            resolve: orgData.settings?.slaThresholds?.medium?.resolve ?? 4320
          },
          low: {
            triage: orgData.settings?.slaThresholds?.low?.triage ?? 1440,
            resolve: orgData.settings?.slaThresholds?.low?.resolve ?? 10080
          }
        },
        autoQuarantine: {
          enabled: orgData.settings?.autoQuarantine?.enabled ?? false,
          threshold: orgData.settings?.autoQuarantine?.threshold ?? 80
        },
        alertPreferences: {
          minSeverity: orgData.settings?.alertPreferences?.minSeverity || 'medium'
        }
      });
    }
  }, [orgData]);

  useEffect(() => {
    if (user?.displayName) {
      setDisplayName(user.displayName);
    }
  }, [user]);

  const handleSaveOrg = async (e) => {
    e.preventDefault();
    if (!hasRole('org_admin')) {
      toast.error('Only Org Admins can update organization security settings');
      return;
    }
    setIsSavingOrg(true);
    try {
      await updateCurrentOrganization({
        name: orgForm.name,
        settings: {
          slaThresholds: orgForm.slaThresholds,
          autoQuarantine: orgForm.autoQuarantine,
          alertPreferences: orgForm.alertPreferences
        }
      });
      toast.success('Organization settings updated successfully');
    } catch (error) {
      const msg = error.response?.data?.error?.message || 'Failed to update organization settings';
      toast.error(msg);
    } finally {
      setIsSavingOrg(false);
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setIsSavingProfile(true);
    try {
      const updated = await updateProfile({ displayName });
      updateUserState({ displayName: updated.displayName });
      toast.success('Profile display name updated');
    } catch (error) {
      const msg = error.response?.data?.error?.message || 'Failed to update profile';
      toast.error(msg);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (passwords.newPassword !== passwords.confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }
    setIsSavingPassword(true);
    try {
      await changePassword({
        currentPassword: passwords.currentPassword,
        newPassword: passwords.newPassword
      });
      toast.success('Security password changed successfully');
      setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error) {
      const msg = error.response?.data?.error?.message || 'Failed to change password';
      toast.error(msg);
    } finally {
      setIsSavingPassword(false);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn max-w-4xl pb-12">
      {/* Page Header */}
      <div>
        <h1 className="text-xl font-black text-white tracking-tight flex items-center gap-2.5">
          <Settings className="w-6 h-6 text-indigo-400" />
          Settings & Security Configuration
        </h1>
        <p className="text-xs text-slate-400 mt-0.5">
          Configure organization SLA targets, automatic quarantine rules, and account credentials
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800 gap-6">
        <button
          onClick={() => setActiveTab('org')}
          className={`pb-3 text-xs font-bold transition flex items-center gap-2 border-b-2 ${
            activeTab === 'org'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Shield className="w-4 h-4" />
          Organization Security Settings
        </button>

        <button
          onClick={() => setActiveTab('profile')}
          className={`pb-3 text-xs font-bold transition flex items-center gap-2 border-b-2 ${
            activeTab === 'profile'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <User className="w-4 h-4" />
          User Profile & Password
        </button>
      </div>

      {/* Tab 1: Organization Settings */}
      {activeTab === 'org' && (
        <form onSubmit={handleSaveOrg} className="space-y-6">
          {/* Org Name Card */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 space-y-4">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">Tenant Identity</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Organization Name</label>
                <input
                  type="text"
                  disabled={!hasRole('org_admin')}
                  value={orgForm.name}
                  onChange={(e) => setOrgForm((p) => ({ ...p, name: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none disabled:opacity-60"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Organization Slug (Immutable)</label>
                <input
                  type="text"
                  readOnly
                  value={orgData?.slug || ''}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs font-mono text-slate-400 select-all focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Auto Quarantine Policy Card */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 space-y-4">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center justify-between">
              <span>Automatic Device Quarantine Policy</span>
              <span className="text-[10px] text-slate-500 font-normal">FR-DLC-04</span>
            </h2>

            <div className="flex items-center justify-between p-4 bg-slate-950/60 rounded-2xl border border-slate-800">
              <div>
                <div className="text-xs font-bold text-slate-200">Enable Auto-Quarantine on High Risk</div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Automatically transition device to quarantined state when risk score crosses threshold
                </div>
              </div>
              <input
                type="checkbox"
                disabled={!hasRole('org_admin')}
                checked={orgForm.autoQuarantine.enabled}
                onChange={(e) =>
                  setOrgForm((p) => ({
                    ...p,
                    autoQuarantine: { ...p.autoQuarantine, enabled: e.target.checked }
                  }))
                }
                className="w-5 h-5 rounded border-slate-700 text-indigo-600 focus:ring-indigo-500 bg-slate-900 cursor-pointer disabled:opacity-50"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Risk Score Trigger Threshold: <span className="font-bold text-indigo-400">{orgForm.autoQuarantine.threshold}</span> / 100
              </label>
              <input
                type="range"
                min="1"
                max="100"
                disabled={!hasRole('org_admin') || !orgForm.autoQuarantine.enabled}
                value={orgForm.autoQuarantine.threshold}
                onChange={(e) =>
                  setOrgForm((p) => ({
                    ...p,
                    autoQuarantine: { ...p.autoQuarantine, threshold: parseInt(e.target.value, 10) }
                  }))
                }
                className="w-full accent-indigo-500 disabled:opacity-40"
              />
            </div>
          </div>

          {/* SLA Thresholds Card */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 space-y-4">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              Incident Response SLA Targets (Minutes)
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {['critical', 'high', 'medium', 'low'].map((sev) => (
                <div key={sev} className="p-4 bg-slate-950/60 rounded-2xl border border-slate-800 space-y-3">
                  <div className="text-xs font-bold text-slate-200 capitalize flex items-center justify-between">
                    <span>{sev} SLA</span>
                    <span className="text-[10px] font-mono uppercase text-indigo-400">{sev}</span>
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-500 uppercase block mb-1">Triage Target (min)</label>
                    <input
                      type="number"
                      disabled={!hasRole('org_admin')}
                      value={orgForm.slaThresholds[sev]?.triage ?? 15}
                      onChange={(e) =>
                        setOrgForm((p) => ({
                          ...p,
                          slaThresholds: {
                            ...p.slaThresholds,
                            [sev]: {
                              ...p.slaThresholds[sev],
                              triage: parseInt(e.target.value, 10) || 1
                            }
                          }
                        }))
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white disabled:opacity-50"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-500 uppercase block mb-1">Resolve Target (min)</label>
                    <input
                      type="number"
                      disabled={!hasRole('org_admin')}
                      value={orgForm.slaThresholds[sev]?.resolve ?? 240}
                      onChange={(e) =>
                        setOrgForm((p) => ({
                          ...p,
                          slaThresholds: {
                            ...p.slaThresholds,
                            [sev]: {
                              ...p.slaThresholds[sev],
                              resolve: parseInt(e.target.value, 10) || 1
                            }
                          }
                        }))
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white disabled:opacity-50"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {hasRole('org_admin') && (
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isSavingOrg}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition shadow-lg shadow-indigo-600/20 disabled:opacity-50 flex items-center gap-2"
              >
                {isSavingOrg && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                <Save className="w-4 h-4" />
                Save Organization Settings
              </button>
            </div>
          )}
        </form>
      )}

      {/* Tab 2: User Profile & Security */}
      {activeTab === 'profile' && (
        <div className="space-y-6">
          {/* Profile Card */}
          <form onSubmit={handleSaveProfile} className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 space-y-4">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">Account Identity</h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Display Name</label>
                <input
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Account Email (Immutable)</label>
                <input
                  type="email"
                  readOnly
                  value={user?.email || ''}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Security Role</label>
                <input
                  type="text"
                  readOnly
                  value={user?.role || ''}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs font-mono text-indigo-400 capitalize focus:outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={isSavingProfile}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition shadow-lg shadow-indigo-600/20 disabled:opacity-50 flex items-center gap-2"
              >
                {isSavingProfile && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                Update Display Name
              </button>
            </div>
          </form>

          {/* Change Password Card */}
          <form onSubmit={handleChangePassword} className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 space-y-4">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Key className="w-4 h-4 text-indigo-400" />
              Change Security Password
            </h2>

            <div className="space-y-3 max-w-md">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Current Password</label>
                <input
                  type="password"
                  required
                  value={passwords.currentPassword}
                  onChange={(e) => setPasswords((p) => ({ ...p, currentPassword: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">New Password (Min 8 chars)</label>
                <input
                  type="password"
                  required
                  value={passwords.newPassword}
                  onChange={(e) => setPasswords((p) => ({ ...p, newPassword: e.target.value }))}
                  placeholder="Min 8 chars, 1 uppercase, 1 digit, 1 special char"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Confirm New Password</label>
                <input
                  type="password"
                  required
                  value={passwords.confirmPassword}
                  onChange={(e) => setPasswords((p) => ({ ...p, confirmPassword: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={isSavingPassword}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition shadow-lg shadow-indigo-600/20 disabled:opacity-50 flex items-center gap-2"
              >
                {isSavingPassword && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                Change Password
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default SettingsPage;
