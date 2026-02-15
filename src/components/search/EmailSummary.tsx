import { useState } from 'react';
import { Sparkles, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface EmailSummaryProps {
  emailId: string;
}

interface Summary {
  summary: string;
  key_points: string[];
  action_items: string[];
  cached: boolean;
}

export default function EmailSummary({ emailId }: EmailSummaryProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  async function generateSummary() {
    if (summary) {
      setIsExpanded(!isExpanded);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/summarize-email`;
      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email_id: emailId }),
      });

      if (response.ok) {
        const data = await response.json();
        setSummary({
          summary: data.summary,
          key_points: data.key_points || [],
          action_items: data.action_items || [],
          cached: data.cached,
        });
        setIsExpanded(true);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Erreur lors de la génération du résumé');
      }
    } catch (err) {
      console.error('Summary error:', err);
      setError('Erreur de connexion');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-4 border border-purple-100">
      <button
        onClick={generateSummary}
        disabled={isLoading}
        className="flex items-center gap-2 text-sm font-medium text-purple-700 hover:text-purple-800 transition disabled:opacity-50"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Génération du résumé...
          </>
        ) : summary ? (
          <>
            <Sparkles className="w-4 h-4" />
            {isExpanded ? 'Masquer le résumé IA' : 'Afficher le résumé IA'}
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4" />
            Résumer cet email avec l'IA
          </>
        )}
      </button>

      {error && (
        <div className="mt-3 flex items-start gap-2 text-sm text-red-600">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {summary && isExpanded && (
        <div className="mt-4 space-y-4">
          <div>
            <h4 className="text-sm font-semibold text-slate-900 mb-2">Résumé</h4>
            <p className="text-sm text-slate-700 leading-relaxed">{summary.summary}</p>
          </div>

          {summary.key_points.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-slate-900 mb-2">Points clés</h4>
              <ul className="space-y-1.5">
                {summary.key_points.map((point, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm text-slate-700">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-500 mt-1.5 shrink-0" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {summary.action_items.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-slate-900 mb-2">Actions à faire</h4>
              <ul className="space-y-1.5">
                {summary.action_items.map((action, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm text-slate-700">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                    <span>{action}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {summary.cached && (
            <p className="text-xs text-slate-500 italic">
              Résumé mis en cache • Généré précédemment
            </p>
          )}
        </div>
      )}
    </div>
  );
}
