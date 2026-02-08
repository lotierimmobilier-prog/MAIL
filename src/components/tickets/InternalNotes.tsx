import { useState } from 'react';
import { format } from 'date-fns';
import { StickyNote, Send } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { InternalNote } from '../../lib/types';

interface InternalNotesProps {
  ticketId: string;
  notes: InternalNote[];
  onNoteAdded: () => void;
}

export default function InternalNotes({ ticketId, notes, onNoteAdded }: InternalNotesProps) {
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;

    setSubmitting(true);
    await supabase.from('internal_notes').insert({
      ticket_id: ticketId,
      content: content.trim(),
    });
    setContent('');
    setSubmitting(false);
    onNoteAdded();
  }

  return (
    <div className="bg-amber-50/50 rounded-xl border border-amber-200/60">
      <div className="flex items-center gap-2 px-5 py-3 border-b border-amber-200/60">
        <StickyNote className="w-4 h-4 text-amber-600" />
        <h4 className="text-xs font-semibold text-amber-900 uppercase tracking-wider">Notes Internes</h4>
        <span className="text-xs text-amber-600">(equipe uniquement)</span>
      </div>

      {notes.length > 0 && (
        <div className="divide-y divide-amber-200/40">
          {notes.map(note => {
            const author = note.author as { full_name: string } | undefined;
            return (
              <div key={note.id} className="px-5 py-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-amber-800">
                    {author?.full_name ?? 'Admin'}
                  </span>
                  <span className="text-xs text-amber-500">
                    {format(new Date(note.created_at), 'dd/MM/yyyy HH:mm')}
                  </span>
                </div>
                <p className="text-sm text-amber-900">{note.content}</p>
              </div>
            );
          })}
        </div>
      )}

      <form onSubmit={handleSubmit} className="px-5 py-3 border-t border-amber-200/60">
        <div className="flex gap-2">
          <input
            type="text"
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="Ajouter une note interne..."
            className="flex-1 px-3 py-2 bg-white border border-amber-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400"
          />
          <button
            type="submit"
            disabled={!content.trim() || submitting}
            className="px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
}
