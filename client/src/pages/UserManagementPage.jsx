import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { getUsers, inviteUser, updateUser } from '../api/users';
import { Pagination } from '../components/common/Pagination';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import {
  Users,
  UserPlus,
  Search,
  Shield,
  Check,
  Copy,
  Key,
  X,
  RefreshCw,
  UserCheck,
  UserX,
  ShieldAlert
} from 'lucide-react';
import toast from 'react-hot-toast';

const ROLE_LABELS = {
  super_admin: 'Super Admin',
  org_admin: 'Org Admin',
  security_analyst: 'Security Analyst',
  operator: 'Operator',
  viewer: 'Viewer'
};

const ROLE_COLORS = {
  super_admin: 'bg-purple-500/10 text-purple-300 border-purple-500/30',
  org_admin: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30',
  security_analyst: 'bg-blue-500/10 text-blue-300 border-blue-500/30',
  operator: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  viewer: 'bg-slate-500/10 text-slate-300 border-slate-500/30'
};

export const UserManagementPage = () => {
  const { hasRole, user: currentUser } = useAuth();

  const [page, setPage] = useState(1);
  const [limit] = useState(15);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteResult, setInviteResult] = useState(null);
  const [copiedPass, setCopiedPass] = useState(false);

  const [deactivateTarget, setDeactivateTarget] = useState(null);
  const [isDeactivating, setIsDeactivating] = useState(false);

  const [inviteForm, setInviteForm] = useState({
    email: '',
    displayName: '',
    role: 'operator'
  });
  const [isInviting, setIsInviting] = useState(false);

  const {
    data: userData,
    isLoading,
    isFetching,
    refetch
  } = useQuery({
    queryKey: ['users', { page, limit, search, roleFilter }],
    queryFn: () =>
      getUsers({
        page,
        limit,
        search: search || undefined,
        role: roleFilter || undefined
      })
  });

  const handleInviteSubmit = async (e) => {
    e.preventDefault();
    setIsInviting(true);
    try {
      const result = await inviteUser(inviteForm);
      setInviteResult(result);
      toast.success('User invited successfully');
      refetch();
    } catch (error) {
      const msg = error.response?.data?.error?.message || 'Failed to invite user';
      toast.error(msg);
    } finally {
      setIsInviting(false);
    }
  };

  const handleRoleChange = async (targetUser, newRole) => {
    try {
      await updateUser(targetUser.id, { role: newRole });
      toast.success(`Role updated to ${newRole}`);
      refetch();
    } catch (error) {
      const msg = error.response?.data?.error?.message || 'Failed to update role';
      toast.error(msg);
    }
  };

  const handleConfirmDeactivate = async () => {
    if (!deactivateTarget) return;
    setIsDeactivating(true);
    try {
      const newStatus = !deactivateTarget.isActive;
      await updateUser(deactivateTarget.id, { isActive: newStatus });
      toast.success(`User ${newStatus ? 'activated' : 'deactivated'}`);
      setDeactivateTarget(null);
      refetch();
    } catch (error) {
      const msg = error.response?.data?.error?.message || 'Failed to update user status';
      toast.error(msg);
    } finally {
      setIsDeactivating(false);
    }
  };

  const handleCopyPassword = () => {
    if (inviteResult?.temporaryPassword) {
      navigator.clipboard.writeText(inviteResult.temporaryPassword);
      setCopiedPass(true);
      toast.success('Temporary password copied to clipboard');
      setTimeout(() => setCopiedPass(false), 2000);
    }
  };

  const handleCloseInvite = () => {
    setIsInviteOpen(false);
    setInviteResult(null);
    setInviteForm({ email: '', displayName: '', role: 'operator' });
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-white tracking-tight flex items-center gap-2.5">
            <Users className="w-6 h-6 text-indigo-400" />
            SOC Team & Access Control
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Manage organization members, role hierarchy privileges, and access credentials
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="p-2.5 bg-slate-900 border border-slate-800 text-slate-300 hover:text-white rounded-xl text-xs font-semibold transition disabled:opacity-50"
            title="Refresh Users"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
          </button>

          {hasRole('org_admin') && (
            <button
              onClick={() => setIsInviteOpen(true)}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-indigo-600/20 flex items-center gap-2"
            >
              <UserPlus className="w-4 h-4" />
              Invite Team Member
            </button>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search by name or email..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
          />
        </div>

        <select
          value={roleFilter}
          onChange={(e) => {
            setRoleFilter(e.target.value);
            setPage(1);
          }}
          className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:border-indigo-500 focus:outline-none"
        >
          <option value="">All Security Roles</option>
          <option value="super_admin">Super Admin</option>
          <option value="org_admin">Org Admin</option>
          <option value="security_analyst">Security Analyst</option>
          <option value="operator">Operator</option>
          <option value="viewer">Viewer</option>
        </select>
      </div>

      {/* Users Table */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800 text-[11px]">
              <tr>
                <th className="px-6 py-3.5">Team Member</th>
                <th className="px-6 py-3.5">Assigned Role</th>
                <th className="px-6 py-3.5">Access Status</th>
                <th className="px-6 py-3.5">Last Login</th>
                <th className="px-6 py-3.5">Joined</th>
                {hasRole('org_admin') && <th className="px-6 py-3.5 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {isLoading ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                      <span>Loading team access records...</span>
                    </div>
                  </td>
                </tr>
              ) : !userData?.users || userData.users.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-16 text-center text-slate-500">
                    <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p className="font-semibold text-slate-300">No team members found</p>
                  </td>
                </tr>
              ) : (
                userData.users.map((member) => (
                  <tr key={member.id} className="hover:bg-slate-800/40 transition">
                    <td className="px-6 py-4">
                      <div className="font-bold text-white flex items-center gap-2">
                        {member.displayName}
                        {member.id === currentUser?.id && (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                            You
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono mt-0.5">{member.email}</div>
                    </td>
                    <td className="px-6 py-4">
                      {hasRole('org_admin') && member.id !== currentUser?.id ? (
                        <select
                          value={member.role}
                          onChange={(e) => handleRoleChange(member, e.target.value)}
                          className={`text-xs font-semibold px-2 py-1 rounded-lg border focus:outline-none bg-slate-950 ${
                            ROLE_COLORS[member.role] || 'border-slate-700 text-slate-300'
                          }`}
                        >
                          <option value="super_admin">Super Admin</option>
                          <option value="org_admin">Org Admin</option>
                          <option value="security_analyst">Security Analyst</option>
                          <option value="operator">Operator</option>
                          <option value="viewer">Viewer</option>
                        </select>
                      ) : (
                        <span
                          className={`inline-flex px-2.5 py-1 rounded-lg text-xs font-semibold border ${
                            ROLE_COLORS[member.role] || 'border-slate-700 text-slate-300'
                          }`}
                        >
                          {ROLE_LABELS[member.role] || member.role}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                          member.isActive
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                            : 'bg-red-500/10 text-red-400 border border-red-500/30'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${member.isActive ? 'bg-emerald-400' : 'bg-red-400'}`}
                        />
                        {member.isActive ? 'Active' : 'Deactivated'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-400 text-xs font-mono">
                      {member.lastLoginAt ? new Date(member.lastLoginAt).toLocaleDateString() : 'Never'}
                    </td>
                    <td className="px-6 py-4 text-slate-400 text-xs font-mono">
                      {member.createdAt ? new Date(member.createdAt).toLocaleDateString() : '—'}
                    </td>
                    {hasRole('org_admin') && (
                      <td className="px-6 py-4 text-right">
                        {member.id !== currentUser?.id && (
                          <button
                            onClick={() => setDeactivateTarget(member)}
                            className={`p-1.5 rounded-lg border transition ${
                              member.isActive
                                ? 'bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20'
                                : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                            }`}
                            title={member.isActive ? 'Deactivate Account' : 'Reactivate Account'}
                          >
                            {member.isActive ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <Pagination
          page={userData?.page || 1}
          limit={userData?.limit || limit}
          total={userData?.total || 0}
          onPageChange={(newPage) => setPage(newPage)}
        />
      </div>

      {/* Invite User Modal */}
      {isInviteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-fadeIn">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    {inviteResult ? 'Credentials Generated' : 'Invite Team Member'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {inviteResult ? 'Share temporary password securely' : 'Add user with role permissions'}
                  </p>
                </div>
              </div>
              <button
                onClick={handleCloseInvite}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {inviteResult ? (
              <div className="p-6 space-y-5">
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-start gap-3">
                  <Check className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Invitation Complete:</span> User{' '}
                    <span className="font-bold text-white">{inviteResult.email}</span> created with role{' '}
                    <span className="font-bold text-white">{inviteResult.role}</span>.
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-amber-400" />
                    One-Time Temporary Password
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      readOnly
                      value={inviteResult.temporaryPassword}
                      className="w-full bg-slate-950 border border-amber-500/40 rounded-xl px-4 py-3 text-xs font-mono text-amber-300 pr-24 select-all focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleCopyPassword}
                      className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg transition flex items-center gap-1.5"
                    >
                      {copiedPass ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedPass ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-3">
                  <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Security Notice:</span> This temporary password is shown only once and
                    is not stored in plaintext. Securely transmit it to the user.
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleCloseInvite}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition shadow-lg shadow-indigo-600/20"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleInviteSubmit} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Display Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={inviteForm.displayName}
                    onChange={(e) => setInviteForm((p) => ({ ...p, displayName: e.target.value }))}
                    placeholder="e.g., Alex Vance"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Corporate Email <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={inviteForm.email}
                    onChange={(e) => setInviteForm((p) => ({ ...p, email: e.target.value }))}
                    placeholder="e.g., alex.vance@org.com"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Assigned Role <span className="text-red-400">*</span>
                  </label>
                  <select
                    value={inviteForm.role}
                    onChange={(e) => setInviteForm((p) => ({ ...p, role: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="viewer">Viewer (Read-only)</option>
                    <option value="operator">Operator (Day-to-day triage)</option>
                    <option value="security_analyst">Security Analyst (Rules & Forensics)</option>
                    <option value="org_admin">Org Admin (Full org administration)</option>
                  </select>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={handleCloseInvite}
                    disabled={isInviting}
                    className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white bg-slate-800 rounded-xl transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isInviting}
                    className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition shadow-lg shadow-indigo-600/20 disabled:opacity-50 flex items-center gap-2"
                  >
                    {isInviting && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                    Generate Credentials & Invite
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Deactivate User Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!deactivateTarget}
        title={deactivateTarget?.isActive ? 'Deactivate Team Member' : 'Reactivate Team Member'}
        message={`Are you sure you want to ${
          deactivateTarget?.isActive ? 'deactivate' : 'reactivate'
        } account for ${deactivateTarget?.displayName} (${deactivateTarget?.email})? ${
          deactivateTarget?.isActive ? 'They will lose immediate access to all SOC endpoints.' : ''
        }`}
        confirmLabel={deactivateTarget?.isActive ? 'Deactivate Access' : 'Reactivate Access'}
        isDestructive={deactivateTarget?.isActive}
        isLoading={isDeactivating}
        onConfirm={handleConfirmDeactivate}
        onCancel={() => setDeactivateTarget(null)}
      />
    </div>
  );
};

export default UserManagementPage;
