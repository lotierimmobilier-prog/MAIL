import { useState, useEffect } from 'react';
import { Sparkles, Database, Play, CheckCircle2, AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export default function AiSearchManager() {
  const [stats, setStats] = useState({
    totalEmails: 0,
    embeddedEmails: 0,
    pendingEmails: 0,
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    details?: any;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  async function loadStats() {
    setLoading(true);

    const { count: totalEmails } = await supabase
      .from('emails')
      .select('*', { count: 'exact', head: true });

    const { count: embeddedEmails } = await supabase
      .from('email_embeddings')
      .select('*', { count: 'exact', head: true });

    setStats({
      totalEmails: totalEmails || 0,
      embeddedEmails: embeddedEmails || 0,
      pendingEmails: (totalEmails || 0) - (embeddedEmails || 0),
    });

    setLoading(false);
  }

  async function handleGenerateEmbeddings() {
    setIsProcessing(true);
    setResult(null);

    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/batch-generate-embeddings`;
      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          limit: 50,
          offset: 0,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setResult({
          success: true,
          message: data.message || 'Embeddings générés avec succès',
          details: data,
        });
        await loadStats();
      } else {
        const errorData = await response.json();
        setResult({
          success: false,
          message: errorData.error || 'Erreur lors de la génération',
        });
      }
    } catch (error) {
      console.error('Error generating embeddings:', error);
      setResult({
        success: false,
        message: 'Erreur de connexion',
      });
    } finally {
      setIsProcessing(false);
    }
  }

  const progressPercent = stats.totalEmails > 0
    ? Math.round((stats.embeddedEmails / stats.totalEmails) * 100)
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Recherche IA & Embeddings</h2>
          <p className="text-sm text-slate-500 mt-1">
            Gérez l'indexation sémantique des emails pour la recherche intelligente
          </p>
        </div>
        <button
          onClick={loadStats}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Actualiser
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
              <Database className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{stats.totalEmails}</p>
              <p className="text-xs text-slate-500">Emails au total</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{stats.embeddedEmails}</p>
              <p className="text-xs text-slate-500">Emails indexés</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{stats.pendingEmails}</p>
              <p className="text-xs text-slate-500">En attente</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Progression de l'indexation</h3>
            <p className="text-xs text-slate-500 mt-1">
              {progressPercent}% des emails indexés
            </p>
          </div>
          <span className="text-2xl font-bold text-slate-900">{progressPercent}%</span>
        </div>

        <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-500 rounded-full"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="text-sm font-semibold text-slate-900 mb-4">Actions</h3>

        <div className="space-y-3">
          <button
            onClick={handleGenerateEmbeddings}
            disabled={isProcessing || stats.pendingEmails === 0}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white text-sm font-medium rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Génération en cours...
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Générer les embeddings ({Math.min(50, stats.pendingEmails)} emails)
              </>
            )}
          </button>

          {stats.pendingEmails === 0 && (
            <div className="flex items-center gap-2 text-sm text-emerald-600 justify-center">
              <CheckCircle2 className="w-4 h-4" />
              Tous les emails sont indexés
            </div>
          )}
        </div>

        {result && (
          <div
            className={`mt-4 p-4 rounded-lg ${
              result.success ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
            }`}
          >
            <div className="flex items-start gap-2">
              {result.success ? (
                <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <p className="text-sm font-medium">{result.message}</p>
                {result.details && (
                  <div className="mt-2 text-xs space-y-1">
                    <p>Traités: {result.details.processed}/{result.details.total_emails}</p>
                    {result.details.errors > 0 && (
                      <p>Erreurs: {result.details.errors}</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl border border-purple-100 p-5">
        <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-600" />
          À propos de la recherche IA
        </h3>
        <div className="text-sm text-slate-600 space-y-2">
          <p>
            La recherche IA utilise des embeddings vectoriels (OpenAI text-embedding-3-small) pour comprendre
            le sens des emails, pas seulement les mots exacts.
          </p>
          <p>
            <strong>Avantages:</strong> Recherche par intention, synonymes automatiques, meilleure pertinence.
          </p>
          <p>
            <strong>Note:</strong> Les embeddings sont générés automatiquement pour les nouveaux emails.
            Utilisez ce panneau pour indexer les emails existants.
          </p>
        </div>
      </div>
    </div>
  );
}
