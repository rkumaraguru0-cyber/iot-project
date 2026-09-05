import React, { useState } from 'react';
import { MessageSquare, Send, User } from 'lucide-react';
import toast from 'react-hot-toast';

export const IncidentNotesList = ({ notes = [], onAddNote, canAddNotes = true, isSubmitting = false }) => {
  const [content, setContent] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!content.trim()) return;

    try {
      await onAddNote(content.trim());
      setContent('');
      toast.success('Investigation note recorded');
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to add note');
    }
  };

  return (
    <div className="space-y-6">
      {/* Notes Feed */}
      {!notes || notes.length === 0 ? (
        <div className="p-8 text-center text-xs text-slate-500 bg-slate-950/40 rounded-2xl border border-slate-800/60 font-mono">
          No investigation notes recorded yet.
        </div>
      ) : (
        <div className="space-y-3">
          {notes.map((note, idx) => (
            <div key={idx} className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <div className="flex items-center gap-2 font-mono">
                  <div className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-[10px] font-bold">
                    <User className="w-3 h-3" />
                  </div>
                  <span className="font-semibold text-slate-200">{note.author}</span>
                </div>
                <span className="text-[11px] font-mono text-slate-500">
                  {new Date(note.timestamp).toLocaleString()}
                </span>
              </div>
              <p className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed pl-7">
                {note.content}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Add Note Form */}
      {canAddNotes && (
        <form onSubmit={handleSubmit} className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-300 uppercase tracking-wider font-mono">
            <MessageSquare className="w-4 h-4 text-indigo-400" />
            Append Investigation Note
          </div>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Document investigation findings, telemetry correlations, or containment observations..."
            rows={3}
            disabled={isSubmitting}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-none font-sans"
          />
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-mono text-slate-500">Notes are immutable and recorded in the audit trail.</span>
            <button
              type="submit"
              disabled={isSubmitting || !content.trim()}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-xl transition-all shadow-md shadow-indigo-600/20 flex items-center gap-2"
            >
              <Send className="w-3.5 h-3.5" />
              {isSubmitting ? 'Recording...' : 'Add Note'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
