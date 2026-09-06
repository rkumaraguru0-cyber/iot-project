import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  Shield,
  Cpu,
  Users,
  Settings,
  LogOut,
  Bell,
  Activity,
  AlertOctagon,
  FileCode,
  HardDrive,
  FileText
} from 'lucide-react';
import toast from 'react-hot-toast';

export const Layout = () => {
  const { user, logout, hasRole } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout();
      toast.success('Logged out successfully');
      navigate('/login');
    } catch {
      toast.error('Logout error');
    }
  };

  const navItems = [
    { to: '/devices', label: 'Device Inventory', icon: Cpu, active: true },
    { to: '/security-events', label: 'Security Events', icon: Activity, active: true },
    { to: '/incidents', label: 'Incidents & SLA', icon: AlertOctagon, active: true },
    { to: '/firmware', label: 'Firmware & OTA', icon: HardDrive, active: true },
    { to: '/rules', label: 'Detection Rules', icon: FileCode, active: true },
    { to: '/users', label: 'Team & Access', icon: Users, active: true },
    { to: '/settings', label: 'Org Settings & Profile', icon: Settings, active: true }
  ];

  const queuedNavItems = [
    { label: 'Forensic Audit Log', icon: FileText, phase: 'Ph 11' }
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col md:flex-row">
      {/* Sidebar Navigation */}
      <aside className="w-full md:w-64 bg-slate-900 border-r border-slate-800/80 flex flex-col shrink-0">
        {/* Logo Brand */}
        <div className="h-16 flex items-center gap-3 px-6 border-b border-slate-800/80 bg-slate-950/40">
          <div className="p-2 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-white shadow-lg shadow-indigo-500/20">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm font-extrabold tracking-tight text-white flex items-center gap-1.5">
              SecureWatch <span className="text-indigo-400 font-normal">IoT</span>
            </h1>
            <p className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">SOC Operations Center</p>
          </div>
        </div>

        {/* Organization Badge */}
        <div className="px-5 py-3 border-b border-slate-800/50 bg-slate-900/50">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Active Tenant</div>
          <div className="text-xs font-semibold text-slate-200 truncate flex items-center justify-between">
            <span>{user?.organization?.name || 'Organization'}</span>
            <span className="text-[10px] font-mono bg-indigo-500/10 text-indigo-400 px-1.5 py-0.5 rounded border border-indigo-500/20">
              {user?.role}
            </span>
          </div>
        </div>

        {/* Primary Navigation Links */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">Fleet Operations</div>
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`
                }
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </NavLink>
            );
          })}

          <div className="pt-6 px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-slate-600">
            SOC Intelligence Pipeline
          </div>
          {queuedNavItems.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.label}
                className="flex items-center justify-between px-3.5 py-2 rounded-xl text-xs text-slate-500/70 cursor-not-allowed select-none"
                title={`Available in ${item.phase}`}
              >
                <div className="flex items-center gap-3">
                  <Icon className="w-4 h-4 opacity-50" />
                  <span>{item.label}</span>
                </div>
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-500">
                  {item.phase}
                </span>
              </div>
            );
          })}
        </nav>

        {/* User Footer Profile & Logout */}
        <div className="p-4 border-t border-slate-800/80 bg-slate-950/40 flex items-center justify-between">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-8 h-8 rounded-full bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-xs font-bold text-indigo-400">
              {user?.displayName ? user.displayName.charAt(0).toUpperCase() : 'U'}
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-bold text-white truncate">{user?.displayName || 'SOC Analyst'}</p>
              <p className="text-[10px] text-slate-400 truncate">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition"
            title="Log Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* Main Content Viewport */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header Bar */}
        <header className="h-16 px-8 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between backdrop-blur-sm shrink-0">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
            <span className="text-slate-200">Organization Fleet</span>
            <span>/</span>
            <span className="text-indigo-400 font-semibold">{user?.organization?.name || 'SecureWatch Enterprise'}</span>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[11px] font-semibold text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Deterministic Engine Active
            </div>
          </div>
        </header>

        {/* Route Outlet Content */}
        <main className="flex-1 p-6 md:p-8 overflow-y-auto bg-slate-950">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;
