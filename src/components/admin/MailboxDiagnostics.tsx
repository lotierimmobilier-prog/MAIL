import { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle, Loader2, RefreshCw, Sparkles } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Mailbox } from '../../lib/types';

export default function MailboxDiagnostics() {
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [emailCounts, setEmailCounts] = useState<Record<string, number>>({});
  const [testing, setTesting] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, { status: string; message: string; details?: any }>>({});
  const [cleaningEmails, setCleaningEmails] = useState(false);
  const [cleanResult, setCleanResult] = useState<{ success: boolean; total: number; cleaned: number; skipped: number } | null>(null);

  useEffect(() => {
    loadMailboxes();
  }, []);

  async function loadMailboxes() {
    const { data } = await supabase.from('mailboxes').select('*').order('name');
    if (data) {
      setMailboxes(data);

      for (const mailbox of data) {
        const { count } = await supabase
          .from('emails')
          .select('*', { count: 'exact', head: true })
          .eq('mailbox_id', mailbox.id);

        setEmailCounts(prev => ({ ...prev, [mailbox.id]: count || 0 }));
      }
    }
  }

  async function testMailbox(mailbox: Mailbox) {
    setTesting(mailbox.id);
    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-mailbox`;
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ mailbox_id: mailbox.id }),
      });

      const data = await res.json();
      console.log('Test result for', mailbox.name, ':', data);

      if (data.results && data.results.length > 0) {
        const result = data.results[0];
        setResults(prev => ({
          ...prev,
          [mailbox.id]: {
            status: result.status,
            message: result.error || `${result.synced || 0} email(s) synchronisé(s)`,
            details: result,
          },
        }));
      } else if (data.error) {
        setResults(prev => ({
          ...prev,
          [mailbox.id]: {
            status: 'error',
            message: data.error,
          },
        }));
      }
    } catch (err: any) {
      console.error('Test error:', err);
      setResults(prev => ({
        ...prev,
        [mailbox.id]: {
          status: 'error',
          message: err.message || 'Erreur de connexion',
        },
      }));
    }
    setTesting(null);
  }

  async function cleanHtmlEmails() {
    setCleaningEmails(true);
    setCleanResult(null);
    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/clean-emails`;
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await res.json();
      setCleanResult(data);
      await loadMailboxes();
    } catch (err: any) {
      console.error('Clean error:', err);
      setCleanResult({
        success: false,
        total: 0,
        cleaned: 0,
        skipped: 0,
      });
    }
    setCleaningEmails(false);
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Diagnostic des boîtes mail</h2>
          <p className="text-sm text-slate-500 mt-1">
            Testez la connexion et la synchronisation de chaque boîte mail
          </p>
        </div>
        <button
          onClick={cleanHtmlEmails}
          disabled={cleaningEmails}
          className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition disabled:opacity-50 disabled:cursor-not-allowed text-sm"
        >
          {cleaningEmails ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Nettoyage...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              Nettoyer les emails HTML
            </>
          )}
        </button>
      </div>

      {cleanResult && (
        <div
          className={`p-4 rounded-lg border ${
            cleanResult.success
              ? 'bg-emerald-50 border-emerald-200'
              : 'bg-red-50 border-red-200'
          }`}
        >
          <div className="flex items-start gap-2">
            {cleanResult.success ? (
              <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            )}
            <div>
              <p className={`text-sm font-medium ${cleanResult.success ? 'text-emerald-900' : 'text-red-900'}`}>
                {cleanResult.success ? 'Nettoyage terminé' : 'Erreur lors du nettoyage'}
              </p>
              <p className={`text-xs mt-1 ${cleanResult.success ? 'text-emerald-700' : 'text-red-700'}`}>
                {cleanResult.cleaned} email(s) nettoyé(s) sur {cleanResult.total} analysé(s)
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {mailboxes.map(mailbox => {
          const result = results[mailbox.id];
          const isTesting = testing === mailbox.id;

          return (
            <div
              key={mailbox.id}
              className="bg-white border border-slate-200 rounded-lg p-4 space-y-3"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className="text-sm font-semibold text-slate-900">{mailbox.name}</h3>
                    {!mailbox.is_active && (
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs rounded-full">
                        Inactive
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">{mailbox.email_address}</p>
                  <div className="mt-2 text-xs text-slate-600 space-y-0.5">
                    <p className="text-cyan-700 font-medium">
                      📧 {emailCounts[mailbox.id] || 0} email(s) dans la base de données
                    </p>
                    <p>
                      <span className="font-medium">Type:</span> {mailbox.provider_type.toUpperCase()}
                    </p>
                    {mailbox.provider_type === 'imap' && (
                      <>
                        <p>
                          <span className="font-medium">IMAP:</span> {mailbox.imap_host}:{mailbox.imap_port}
                        </p>
                        <p>
                          <span className="font-medium">SMTP:</span> {mailbox.smtp_host}:{mailbox.smtp_port}
                        </p>
                        <p>
                          <span className="font-medium">Utilisateur:</span> {mailbox.username}
                        </p>
                      </>
                    )}
                    {mailbox.provider_type === 'ovh' && (
                      <>
                        <p>
                          <span className="font-medium">Domaine OVH:</span> {mailbox.ovh_domain || 'Non configuré'}
                        </p>
                        <p>
                          <span className="font-medium">Compte OVH:</span> {mailbox.ovh_account || 'Non configuré'}
                        </p>
                        <p>
                          <span className="font-medium">Consumer Key:</span>{' '}
                          {mailbox.ovh_consumer_key ? 'Configurée' : 'Non configurée'}
                        </p>
                      </>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => testMailbox(mailbox)}
                  disabled={isTesting || !mailbox.is_active}
                  className="flex items-center gap-2 px-3 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  {isTesting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Test...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4" />
                      Tester
                    </>
                  )}
                </button>
              </div>

              {result && (
                <div
                  className={`p-3 rounded-lg border ${
                    result.status === 'ok'
                      ? 'bg-emerald-50 border-emerald-200'
                      : result.status === 'error'
                      ? 'bg-red-50 border-red-200'
                      : 'bg-amber-50 border-amber-200'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {result.status === 'ok' ? (
                      <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-sm font-medium ${
                          result.status === 'ok' ? 'text-emerald-900' : 'text-red-900'
                        }`}
                      >
                        {result.status === 'ok'
                          ? 'Synchronisation réussie'
                          : result.status === 'skipped'
                          ? 'Synchronisation ignorée'
                          : 'Erreur de synchronisation'}
                      </p>
                      <p
                        className={`text-xs mt-1 ${
                          result.status === 'ok' ? 'text-emerald-700' : 'text-red-700'
                        }`}
                      >
                        {result.message}
                      </p>
        {result.details && (
                        <details className="mt-2">
                          <summary className="text-xs text-slate-600 cursor-pointer hover:text-slate-900">
                            Détails techniques
                          </summary>
                          <div className="mt-2 space-y-1 text-xs">
                            {result.details.status === 'ok' && (
                              <>
                                <p className="text-slate-700">
                                  <span className="font-medium">Emails synchronisés:</span> {result.details.synced || 0}
                                </p>
                                <p className="text-slate-700">
                                  <span className="font-medium">Total sur le serveur:</span> {result.details.total || 0}
                                </p>
                                {result.details.synced === 0 && result.details.total > 0 && (
                                  <p className="text-amber-700 mt-2 font-medium">
                                    ⚠️ Il y a {result.details.total} emails sur le serveur mais aucun nouveau n'a été synchronisé.
                                    Tous les emails récents (30 derniers jours) sont déjà dans la base de données.
                                  </p>
                                )}
                              </>
                            )}
                            {result.details.reason && (
                              <p className="text-amber-700">
                                <span className="font-medium">Raison:</span> {result.details.reason}
                              </p>
                            )}
                            <details className="mt-2">
                              <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-700">
                                JSON complet
                              </summary>
                              <pre className="text-xs bg-slate-900 text-slate-100 p-2 rounded mt-1 overflow-x-auto">
                                {JSON.stringify(result.details, null, 2)}
                              </pre>
                            </details>
                          </div>
                        </details>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {mailboxes.length === 0 && (
        <div className="text-center py-12 text-slate-500">
          <p>Aucune boîte mail configurée</p>
        </div>
      )}
    </div>
  );
}
