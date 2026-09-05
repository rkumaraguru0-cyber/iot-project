import React from 'react';
import { Shield, Play, Trash2, Cpu, Clock, Layers, AlertTriangle } from 'lucide-react';

const SEVERITY_COLORS = {
  critical: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  high: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  medium: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  low: 'bg-blue-500/10 text-blue-400 border-blue-500/20'
};

const OPERATOR_SYMBOLS = {
  gt: '>',
  gte: '≥',
  lt: '<',
  lte: '≤',
  eq: '=',
  neq: '≠',
  rate_exceeds: 'Δ rate >',
  not_in_list: '∉'
};

export const RuleCard = ({ rule, onTest, onDelete, canDelete = false, canTest = true }) => {
  const isSystem = rule.isSystem;
  const severityStyle = SEVERITY_COLORS[rule.severity] || SEVERITY_COLORS.medium;
  const operatorSymbol = OPERATOR_SYMBOLS[rule.operator] || rule.operator;

  return (
    <div className="bg-slate-900/80 border border-slate-800 hover:border-slate-700/80 rounded-2xl p-5 transition-all duration-200 flex flex-col justify-between shadow-sm">
      <div>
        {/* Header Badges */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs font-bold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-1 rounded-lg">
              {rule.ruleId}
            </span>
            {isSystem ? (
              <span className="text-[10px] font-semibold uppercase tracking-wider bg-slate-800 text-slate-300 border border-slate-700 px-2 py-0.5 rounded-md flex items-center gap-1">
                <Shield className="w-3 h-3 text-indigo-400" /> System Rule
              </span>
            ) : (
              <span className="text-[10px] font-semibold uppercase tracking-wider bg-teal-500/10 text-teal-300 border border-teal-500/20 px-2 py-0.5 rounded-md">
                Tenant Rule
              </span>
            )}
            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${severityStyle}`}>
              {rule.severity}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${rule.enabled ? 'bg-emerald-400 shadow-sm shadow-emerald-500/50' : 'bg-slate-600'}`} />
            <span className="text-xs text-slate-400">{rule.enabled ? 'Active' : 'Disabled'}</span>
          </div>
        </div>

        {/* Rule Title & Description */}
        <h3 className="text-sm font-bold text-white mb-1">{rule.name}</h3>
        {rule.description && (
          <p className="text-xs text-slate-400 mb-4 line-clamp-2">{rule.description}</p>
        )}

        {/* Condition Grid */}
        <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3 mb-4 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400 flex items-center gap-1.5 font-medium">
              <Layers className="w-3.5 h-3.5 text-indigo-400" /> Metric Condition
            </span>
            <span className="font-mono font-bold text-slate-200">
              {rule.metric} <span className="text-amber-400">{operatorSymbol}</span> {Array.isArray(rule.value) ? `[${rule.value.join(', ')}]` : rule.value}
            </span>
          </div>

          <div className="flex items-center justify-between text-xs border-t border-slate-800/60 pt-2">
            <span className="text-slate-400 flex items-center gap-1.5 font-medium">
              <Clock className="w-3.5 h-3.5 text-indigo-400" /> Evaluation Window
            </span>
            <span className="font-mono text-slate-300">
              {rule.window?.type === 'none' || !rule.window ? 'Instant (none)' : `${rule.window.type} (${rule.window.size})`}
            </span>
          </div>

          <div className="flex items-center justify-between text-xs border-t border-slate-800/60 pt-2">
            <span className="text-slate-400 flex items-center gap-1.5 font-medium">
              <AlertTriangle className="w-3.5 h-3.5 text-indigo-400" /> Alert Cooldown
            </span>
            <span className="font-mono text-slate-300">{rule.cooldownSeconds || 300}s</span>
          </div>
        </div>

        {/* Device Types Scope */}
        <div className="mb-4">
          <div className="text-[11px] font-semibold text-slate-400 mb-1.5 flex items-center gap-1">
            <Cpu className="w-3 h-3 text-slate-500" /> Applicable Device Types
          </div>
          <div className="flex flex-wrap gap-1.5">
            {rule.deviceTypes?.map((dt) => (
              <span
                key={dt}
                className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-800/90 text-slate-300 border border-slate-700/60"
              >
                {dt === '*' ? 'All Device Types (*)' : dt}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Card Actions Footer */}
      <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
        <span className="text-[10px] font-mono text-slate-500 uppercase">
          Category: {rule.category || 'threshold'}
        </span>

        <div className="flex items-center gap-2">
          {canTest && (
            <button
              onClick={() => onTest(rule)}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 transition flex items-center gap-1.5"
              title="Dry-run evaluate this rule"
            >
              <Play className="w-3 h-3" /> Test
            </button>
          )}

          {!isSystem && canDelete && (
            <button
              onClick={() => onDelete(rule)}
              className="p-1.5 text-xs font-semibold rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition"
              title="Soft-delete tenant rule"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default RuleCard;
