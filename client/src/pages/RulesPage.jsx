import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getRules, createRule, deleteRule } from '../api/rules';
import { getAnomalies } from '../api/anomalies';
import { RuleCard } from '../components/rules/RuleCard';
import { RuleTestModal } from '../components/rules/RuleTestModal';
import {
  FileCode,
  Plus,
  Filter,
  RefreshCw,
  Layers,
  Activity,
  AlertOctagon,
  Clock,
  ShieldAlert,
  SlidersHorizontal,
  X
} from 'lucide-react';
import toast from 'react-hot-toast';

const DEVICE_TYPES_OPTIONS = [
  { value: '*', label: 'All Device Types (*)' },
  { value: 'temperature_sensor', label: 'Temperature Sensor' },
  { value: 'smart_camera', label: 'Smart Camera' },
  { value: 'industrial_gateway', label: 'Industrial Gateway' },
  { value: 'medical_monitor', label: 'Medical Monitor' },
  { value: 'smart_lock', label: 'Smart Lock' }
];

export const RulesPage = () => {
  const { user, hasRole } = useAuth();

  const [activeTab, setActiveTab] = useState('rules'); // 'rules' | 'anomalies'
  const [rules, setRules] = useState([]);
  const [anomalies, setAnomalies] = useState([]);
  const [totalAnomalies, setTotalAnomalies] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedSeverity, setSelectedSeverity] = useState('');
  const [selectedDeviceType, setSelectedDeviceType] = useState('');

  // Modals state
  const [testingRule, setTestingRule] = useState(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // New Rule Form State
  const [newRule, setNewRule] = useState({
    name: '',
    description: '',
    category: 'threshold',
    deviceTypes: ['*'],
    metric: 'cpu_usage',
    operator: 'gt',
    value: 80,
    window: { type: 'none', size: 1 },
    cooldownSeconds: 300,
    severity: 'high',
    confidence: 'high',
    explanationTemplate: 'Metric exceeded configured safety boundary'
  });

  const canCreateRule = hasRole('security_analyst');
  const canDeleteRule = hasRole('org_admin');
  const canTestRule = hasRole('operator');

  const fetchRules = useCallback(async () => {
    try {
      const params = {};
      if (selectedCategory) params.category = selectedCategory;
      if (selectedSeverity) params.severity = selectedSeverity;
      if (selectedDeviceType) params.deviceType = selectedDeviceType;

      const res = await getRules(params);
      setRules(res.rules || []);
    } catch (err) {
      toast.error('Failed to load detection rules');
    }
  }, [selectedCategory, selectedSeverity, selectedDeviceType]);

  const fetchAnomalyLogs = useCallback(async () => {
    try {
      const res = await getAnomalies({ limit: 50 });
      setAnomalies(res.anomalies || []);
      setTotalAnomalies(res.total || 0);
    } catch (err) {
      toast.error('Failed to load anomaly detection logs');
    }
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchRules(), fetchAnomalyLogs()]);
    setLoading(false);
  }, [fetchRules, fetchAnomalyLogs]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchRules(), fetchAnomalyLogs()]);
    setRefreshing(false);
    toast.success('Rules & Anomaly logs refreshed');
  };

  const handleCreateRule = async (e) => {
    e.preventDefault();
    try {
      const parsedVal = Number(newRule.value);
      const formattedRule = {
        ...newRule,
        value: isNaN(parsedVal) ? newRule.value : parsedVal
      };

      await createRule(formattedRule);
      toast.success('Custom tenant rule created successfully');
      setIsCreateModalOpen(false);
      fetchRules();
    } catch (err) {
      const msg = err.response?.data?.error?.message || err.message || 'Failed to create rule';
      toast.error(msg);
    }
  };

  const handleDeleteRule = async (rule) => {
    if (!window.confirm(`Are you sure you want to delete rule "${rule.name}" (${rule.ruleId})?`)) {
      return;
    }
    try {
      await deleteRule(rule._id || rule.ruleId);
      toast.success('Rule deleted successfully');
      fetchRules();
    } catch (err) {
      const msg = err.response?.data?.error?.message || err.message || 'Failed to delete rule';
      toast.error(msg);
    }
  };

  const systemRules = rules.filter((r) => r.isSystem);
  const tenantRules = rules.filter((r) => !r.isSystem);

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <FileCode className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-white">Deterministic Detection Rules</h1>
          </div>
          <p className="text-xs text-slate-400">
            Configure threshold and rate-based detection rules for real-time anomaly detection.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2 text-slate-400 hover:text-slate-200 bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl text-xs font-semibold transition flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>

          {canCreateRule && (
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-indigo-600/20 transition flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> Create Rule
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
        <button
          onClick={() => setActiveTab('rules')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
            activeTab === 'rules'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Layers className="w-4 h-4" /> Active Rules ({rules.length})
        </button>

        <button
          onClick={() => setActiveTab('anomalies')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
            activeTab === 'anomalies'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <ShieldAlert className="w-4 h-4" /> Anomaly Detection Logs ({totalAnomalies})
        </button>
      </div>

      {activeTab === 'rules' ? (
        <div className="space-y-8">
          {/* Filters Bar */}
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
              <Filter className="w-4 h-4 text-indigo-400" /> Filters:
            </div>

            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-slate-950 border border-slate-800 text-xs text-slate-300 rounded-xl px-3 py-1.5 focus:outline-none focus:border-indigo-500"
            >
              <option value="">All Categories</option>
              <option value="operational">Operational</option>
              <option value="security">Security</option>
              <option value="behavioral">Behavioral</option>
              <option value="threshold">Threshold</option>
            </select>

            <select
              value={selectedSeverity}
              onChange={(e) => setSelectedSeverity(e.target.value)}
              className="bg-slate-950 border border-slate-800 text-xs text-slate-300 rounded-xl px-3 py-1.5 focus:outline-none focus:border-indigo-500"
            >
              <option value="">All Severities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>

            <select
              value={selectedDeviceType}
              onChange={(e) => setSelectedDeviceType(e.target.value)}
              className="bg-slate-950 border border-slate-800 text-xs text-slate-300 rounded-xl px-3 py-1.5 focus:outline-none focus:border-indigo-500"
            >
              <option value="">All Device Types</option>
              {DEVICE_TYPES_OPTIONS.map((dto) => (
                <option key={dto.value} value={dto.value}>
                  {dto.label}
                </option>
              ))}
            </select>
          </div>

          {/* System Rules Section */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-indigo-500" /> System Baseline Rules
                </h2>
                <p className="text-[11px] text-slate-400">Global immutable rules established across all tenant fleets</p>
              </div>
              <span className="text-xs font-mono text-slate-500">{systemRules.length} rules</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {systemRules.map((rule) => (
                <RuleCard
                  key={rule.ruleId || rule._id}
                  rule={rule}
                  onTest={(r) => setTestingRule(r)}
                  canDelete={false}
                  canTest={canTestRule}
                />
              ))}
            </div>
          </div>

          {/* Custom Tenant Rules Section */}
          <div className="pt-4 border-t border-slate-800/80">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-teal-400" /> Custom Tenant Rules
                </h2>
                <p className="text-[11px] text-slate-400">Organization-specific rules and thresholds</p>
              </div>
              <span className="text-xs font-mono text-slate-500">{tenantRules.length} rules</span>
            </div>

            {tenantRules.length === 0 ? (
              <div className="bg-slate-900/30 border border-slate-800/50 rounded-2xl p-8 text-center">
                <SlidersHorizontal className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-300">No Custom Tenant Rules Defined</p>
                <p className="text-[11px] text-slate-500 mt-1 max-w-sm mx-auto">
                  Create custom rules tailored to your fleet metrics, device types, and operating thresholds.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {tenantRules.map((rule) => (
                  <RuleCard
                    key={rule.ruleId || rule._id}
                    rule={rule}
                    onTest={(r) => setTestingRule(r)}
                    onDelete={handleDeleteRule}
                    canDelete={canDeleteRule}
                    canTest={canTestRule}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Anomaly Logs Section */
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-400" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">Detection Logs</h3>
              </div>
              <span className="text-xs font-mono text-slate-500">{anomalies.length} recent detections</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/60 text-slate-400 font-mono border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4 font-medium">Timestamp</th>
                    <th className="py-3 px-4 font-medium">Device</th>
                    <th className="py-3 px-4 font-medium">Rule ID</th>
                    <th className="py-3 px-4 font-medium">Severity</th>
                    <th className="py-3 px-4 font-medium">Metric</th>
                    <th className="py-3 px-4 font-medium">Observed / Threshold</th>
                    <th className="py-3 px-4 font-medium">Explanation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300 font-sans">
                  {anomalies.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-500 font-mono">
                        No anomaly detection logs recorded for active organization fleet.
                      </td>
                    </tr>
                  ) : (
                    anomalies.map((anom) => (
                      <tr key={anom._id} className="hover:bg-slate-800/30 transition">
                        <td className="py-3 px-4 font-mono text-slate-400 whitespace-nowrap">
                          {new Date(anom.timestamp || anom.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-slate-200">
                          {anom.deviceId?.deviceId || 'DEV-N/A'}
                        </td>
                        <td className="py-3 px-4 font-mono text-indigo-400">
                          {anom.ruleId}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${
                            anom.severity === 'critical' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                            anom.severity === 'high' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                            'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
                          }`}>
                            {anom.severity}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-300">
                          {anom.metric}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-300">
                          <span className="text-rose-400 font-bold">{anom.observedValue}</span> / {anom.thresholdValue}
                        </td>
                        <td className="py-3 px-4 text-slate-400 max-w-xs truncate" title={anom.explanation}>
                          {anom.explanation}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Dry-Run Test Modal */}
      {testingRule && (
        <RuleTestModal
          rule={testingRule}
          isOpen={Boolean(testingRule)}
          onClose={() => setTestingRule(null)}
        />
      )}

      {/* Create Rule Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Create Custom Detection Rule</h3>
                  <p className="text-xs text-slate-400">Add tenant-scoped deterministic anomaly rule</p>
                </div>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateRule} className="p-6 overflow-y-auto space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Rule Name</label>
                <input
                  type="text"
                  required
                  value={newRule.name}
                  onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
                  placeholder="e.g. Critical Camera Memory Surge"
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Metric</label>
                  <input
                    type="text"
                    required
                    value={newRule.metric}
                    onChange={(e) => setNewRule({ ...newRule, metric: e.target.value })}
                    placeholder="e.g. cpu_usage, memory_usage, temperature"
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Operator</label>
                  <select
                    value={newRule.operator}
                    onChange={(e) => setNewRule({ ...newRule, operator: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="gt">gt (&gt;)</option>
                    <option value="gte">gte (&ge;)</option>
                    <option value="lt">lt (&lt;)</option>
                    <option value="lte">lte (&le;)</option>
                    <option value="eq">eq (=)</option>
                    <option value="neq">neq (&ne;)</option>
                    <option value="rate_exceeds">rate_exceeds (rate/min)</option>
                    <option value="not_in_list">not_in_list</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Threshold Value</label>
                  <input
                    type="number"
                    required
                    value={newRule.value}
                    onChange={(e) => setNewRule({ ...newRule, value: e.target.value })}
                    placeholder="e.g. 85"
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Alert Cooldown (sec)</label>
                  <input
                    type="number"
                    min="0"
                    max="86400"
                    value={newRule.cooldownSeconds}
                    onChange={(e) => setNewRule({ ...newRule, cooldownSeconds: parseInt(e.target.value, 10) || 0 })}
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Window Type</label>
                  <select
                    value={newRule.window.type}
                    onChange={(e) => setNewRule({
                      ...newRule,
                      window: { ...newRule.window, type: e.target.value }
                    })}
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="none">none (instant)</option>
                    <option value="consecutive">consecutive</option>
                    <option value="sliding">sliding</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Window Size</label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={newRule.window.size}
                    onChange={(e) => setNewRule({
                      ...newRule,
                      window: { ...newRule.window, size: parseInt(e.target.value, 10) || 1 }
                    })}
                    disabled={newRule.window.type === 'none'}
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono disabled:opacity-40 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Severity</label>
                  <select
                    value={newRule.severity}
                    onChange={(e) => setNewRule({ ...newRule, severity: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Confidence</label>
                  <select
                    value={newRule.confidence}
                    onChange={(e) => setNewRule({ ...newRule, confidence: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Applicable Device Types</label>
                <select
                  multiple
                  value={newRule.deviceTypes}
                  onChange={(e) => {
                    const options = Array.from(e.target.selectedOptions, (option) => option.value);
                    setNewRule({ ...newRule, deviceTypes: options });
                  }}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500 h-24"
                >
                  {DEVICE_TYPES_OPTIONS.map((dto) => (
                    <option key={dto.value} value={dto.value}>
                      {dto.label}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-500 mt-1">Hold Ctrl/Cmd to select multiple types, or select "*" for all.</p>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Explanation Template</label>
                <input
                  type="text"
                  value={newRule.explanationTemplate}
                  onChange={(e) => setNewRule({ ...newRule, explanationTemplate: e.target.value })}
                  placeholder="e.g. CPU temperature spiked above safety threshold"
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl shadow-lg shadow-indigo-600/20 transition"
                >
                  Create Rule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default RulesPage;
