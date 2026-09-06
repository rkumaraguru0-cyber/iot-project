import React from 'react';
import { X, ShieldCheck, FileText, User, Server, Clock } from 'lucide-react';

export const AuditDetailModal = ({ log, onClose }) => {
  if (!log) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Forensic Audit Log Entry</h2>
              <p className="text-[11px] font-mono text-slate-500">ID: {log._id}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
              <p className="text-[10px] uppercase font-bold text-slate-500 mb-1 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
                Action
              </p>
              <p className="text-xs font-mono font-bold text-white">{log.action}</p>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
              <p className="text-[10px] uppercase font-bold text-slate-500 mb-1 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-indigo-400" />
                Timestamp (UTC)
              </p>
              <p className="text-xs font-mono text-slate-300">
                {log.timestamp ? new Date(log.timestamp).toISOString() : 'N/A'}
              </p>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
              <p className="text-[10px] uppercase font-bold text-slate-500 mb-1 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-indigo-400" />
                Actor
              </p>
              <p className="text-xs font-semibold text-slate-200">{log.actorName || 'System / Service'}</p>
              <p className="text-[10px] font-mono text-slate-500 truncate">
                Actor ID: {typeof log.actor === 'object' ? log.actor?._id : log.actor}
              </p>
              {log.actorIp && (
                <p className="text-[10px] font-mono text-slate-500">IP: {log.actorIp}</p>
              )}
            </div>

            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
              <p className="text-[10px] uppercase font-bold text-slate-500 mb-1 flex items-center gap-1.5">
                <Server className="w-3.5 h-3.5 text-indigo-400" />
                Target Resource
              </p>
              <p className="text-xs font-mono font-bold text-indigo-400">{log.targetType}</p>
              <p className="text-[10px] font-mono text-slate-500 truncate">
                Target ID: {typeof log.targetId === 'object' ? log.targetId?._id : log.targetId}
              </p>
            </div>
          </div>

          {/* Details / Diff Payload JSON */}
          <div>
            <p className="text-[10px] uppercase font-bold text-slate-500 mb-1.5">
              Structured Audit Payload & Metadata
            </p>
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/90 font-mono text-[11px] text-slate-300 overflow-x-auto max-h-60">
              <pre>{JSON.stringify(log.details || {}, null, 2)}</pre>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/40 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default AuditDetailModal;
