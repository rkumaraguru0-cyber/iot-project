import React, { useState } from 'react';
import { X, Play, CheckCircle, AlertTriangle, Info, Terminal } from 'lucide-react';
import { testRule } from '../../api/rules';
import toast from 'react-hot-toast';

export const RuleTestModal = ({ rule, isOpen, onClose }) => {
  const [metricValue, setMetricValue] = useState(
    typeof rule?.value === 'number' ? (rule.value + (rule.operator === 'gt' ? 5 : -5)).toString() : '90'
  );
  const [deviceId, setDeviceId] = useState('DEV-TEST-01');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  if (!isOpen || !rule) return null;

  const handleTest = async (e) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    try {
      const parsedNum = Number(metricValue);
      const val = isNaN(parsedNum) ? metricValue : parsedNum;

      const payload = {
        rule: {
          ruleId: rule.ruleId,
          name: rule.name,
          metric: rule.metric,
          operator: rule.operator,
          value: rule.value,
          window: rule.window,
          severity: rule.severity,
          confidence: rule.confidence,
          explanationTemplate: rule.explanationTemplate
        },
        telemetry: {
          deviceId,
          timestamp: new Date().toISOString(),
          metrics: {
            [rule.metric]: val
          }
        }
      };

      const res = await testRule(payload);
      setResult(res.evaluation);
    } catch (err) {
      const msg = err.response?.data?.error?.message || err.message || 'Dry-run evaluation failed';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Play className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Dry-Run Rule Test</h3>
              <p className="text-xs font-mono text-indigo-400">{rule.ruleId} — {rule.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Rule Specification Snapshot */}
          <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3.5 text-xs space-y-1.5">
            <div className="flex justify-between">
              <span className="text-slate-400">Target Metric:</span>
              <span className="font-mono text-slate-200 font-bold">{rule.metric}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Operator & Threshold:</span>
              <span className="font-mono text-amber-400 font-bold">{rule.operator} {rule.value}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Window Type:</span>
              <span className="font-mono text-slate-300">{rule.window?.type || 'none'}</span>
            </div>
          </div>

          <form onSubmit={handleTest} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Simulated Metric Value ({rule.metric})
              </label>
              <input
                type="text"
                value={metricValue}
                onChange={(e) => setMetricValue(e.target.value)}
                required
                placeholder="e.g. 95"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Simulated Device ID
              </label>
              <input
                type="text"
                value={deviceId}
                onChange={(e) => setDeviceId(e.target.value)}
                placeholder="DEV-TEST-01"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
              />
            </div>

            <div className="flex items-start gap-2 p-3 bg-indigo-500/5 border border-indigo-500/10 rounded-xl text-[11px] text-slate-400">
              <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
              <span>
                Dry-run executes the rule purely in-memory. No database writes, no anomalies persisted, and no cooldown timers are altered.
              </span>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold text-xs rounded-xl shadow-lg shadow-indigo-600/20 transition flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Terminal className="w-4 h-4" /> Run Dry-Run Evaluation
                </>
              )}
            </button>
          </form>

          {/* Test Evaluation Result Banner */}
          {result && (
            <div className={`p-4 rounded-xl border animate-fadeIn ${
              result.isAnomaly
                ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
            }`}>
              <div className="flex items-center gap-2 font-bold text-xs mb-2">
                {result.isAnomaly ? (
                  <>
                    <AlertTriangle className="w-4 h-4 text-rose-400" />
                    <span>ANOMALY TRIGGERED</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                    <span>NORMAL / NO ANOMALY</span>
                  </>
                )}
              </div>

              <div className="text-xs space-y-1 text-slate-300 font-mono">
                <div>Observed Value: <span className="font-bold text-white">{String(result.observedValue)}</span></div>
                <div>Threshold Value: <span className="font-bold text-white">{String(result.thresholdValue)}</span></div>
                {result.explanation && (
                  <div className="pt-2 text-[11px] text-slate-300 font-sans border-t border-slate-700/40">
                    <span className="font-semibold text-slate-400">Explanation: </span>
                    {result.explanation}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RuleTestModal;
