import { useEffect, useState } from 'react';
import { Sparkles, Edit, Check, X, RefreshCw, FileText } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface Draft {
  id: string;
  subject: string;
  body: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

interface AiResponseSuggestionsProps {
  ticketId: string;
  onAccept: (response: string) => void;
  onRegenerate: () => void;
}

export default function AiResponseSuggestions({
  ticketId,
  onAccept,
  onRegenerate,
}: AiResponseSuggestionsProps) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editedText, setEditedText] = useState('');

  useEffect(() => {
    loadDraft();

    const channel = supabase
      .channel(`drafts:${ticketId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'drafts',
          filter: `ticket_id=eq.${ticketId}`,
        },
        () => {
          loadDraft();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [ticketId]);

  async function loadDraft() {
    const { data } = await supabase
      .from('drafts')
      .select('*')
      .eq('ticket_id', ticketId)
      .maybeSingle();

    if (data) setDraft(data);
    setLoading(false);
  }

  async function handleAccept() {
    if (!draft) return;

    const finalResponse = editing ? editedText : draft.body;
    onAccept(finalResponse);

    await supabase
      .from('drafts')
      .delete()
      .eq('id', draft.id);

    setDraft(null);
    setEditing(false);
  }

  async function handleDelete() {
    if (!draft) return;

    await supabase
      .from('drafts')
      .delete()
      .eq('id', draft.id);

    setDraft(null);
  }

  function startEditing() {
    if (!draft) return;
    setEditing(true);
    setEditedText(draft.body);
  }

  function cancelEditing() {
    setEditing(false);
    setEditedText('');
  }

  async function handleRegenerate() {
    setGenerating(true);
    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/auto-generate-draft`;
      await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ticket_id: ticketId }),
      });
      await loadDraft();
    } catch (error) {
      console.error('Failed to regenerate:', error);
    } finally {
      setGenerating(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-sm text-slate-500">
        <RefreshCw className="w-4 h-4 animate-spin mr-2" />
        Chargement du brouillon automatique...
      </div>
    );
  }

  if (!draft) {
    return (
      <div className="bg-gradient-to-br from-cyan-50 to-blue-50 rounded-xl border-2 border-cyan-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-5 h-5 text-cyan-600" />
          <h3 className="text-lg font-semibold text-slate-900">
            Brouillon de réponse IA
          </h3>
        </div>
        <p className="text-sm text-slate-600 mb-4">
          Un brouillon de réponse est automatiquement généré après la réception d'un email. Si aucun brouillon n'apparaît, vous pouvez en générer un manuellement.
        </p>
        <button
          onClick={handleRegenerate}
          disabled={generating}
          className="flex items-center gap-2 px-4 py-2.5 bg-cyan-600 hover:bg-cyan-700 disabled:bg-slate-400 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg shadow-sm transition"
        >
          {generating ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              Génération en cours...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              Générer un brouillon
            </>
          )}
        </button>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-cyan-50 to-blue-50 rounded-xl border-2 border-cyan-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-cyan-600" />
          <h3 className="text-lg font-semibold text-slate-900">
            Brouillon de réponse IA
          </h3>
        </div>
        <button
          onClick={handleRegenerate}
          disabled={generating}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-cyan-700 hover:bg-white/50 disabled:text-slate-400 disabled:cursor-not-allowed rounded-lg transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${generating ? 'animate-spin' : ''}`} />
          {generating ? 'Génération...' : 'Régénérer'}
        </button>
      </div>

      {draft.notes && (
        <div className="mb-3 flex items-start gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
          <FileText className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-medium text-amber-900 mb-0.5">Notes pour l'agent</p>
            <p className="text-xs text-amber-700">{draft.notes}</p>
          </div>
        </div>
      )}

      {editing ? (
        <div className="space-y-3">
          <textarea
            value={editedText}
            onChange={e => setEditedText(e.target.value)}
            rows={10}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 bg-white"
          />
          <div className="flex gap-2">
            <button
              onClick={handleAccept}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition text-sm font-medium"
            >
              <Check className="w-4 h-4" />
              Valider et envoyer
            </button>
            <button
              onClick={cancelEditing}
              className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-white transition text-sm font-medium"
            >
              Annuler
            </button>
          </div>
        </div>
      ) : (
        <>
          <div
            className="bg-white rounded-lg p-4 mb-4 text-sm text-slate-700"
            dangerouslySetInnerHTML={{ __html: draft.body }}
          />

          <div className="flex gap-2">
            <button
              onClick={handleAccept}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition text-sm font-medium"
            >
              <Check className="w-4 h-4" />
              Valider et envoyer
            </button>
            <button
              onClick={startEditing}
              className="flex items-center gap-1.5 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-white transition text-sm font-medium"
            >
              <Edit className="w-4 h-4" />
              Modifier
            </button>
            <button
              onClick={handleDelete}
              className="flex items-center gap-1.5 px-4 py-2 border border-red-300 text-red-700 rounded-lg hover:bg-red-50 transition text-sm font-medium"
            >
              <X className="w-4 h-4" />
              Supprimer
            </button>
          </div>
        </>
      )}
    </div>
  );
}
