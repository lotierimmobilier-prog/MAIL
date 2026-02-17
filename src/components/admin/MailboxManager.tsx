import { useEffect, useState } from 'react';
import { Plus, Edit3, Trash2, ToggleLeft, ToggleRight, Server, RefreshCw, Loader2, Zap, AlertCircle, Download } from 'lucide-react';
import Modal from '../ui/Modal';
import { supabase } from '../../lib/supabase';
import type { Mailbox } from '../../lib/types';
import { callEdgeFunction } from '../../lib/edgeFunctionClient';

let isSyncing = false;
let syncStartTime = 0;
let lastProgressTime = 0;
let currentSyncMailboxId: string | null = null;
const MAX_SYNC_DURATION = 60000;
const MAX_NO_PROGRESS_DURATION = 30000;

export default function MailboxManager() {
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [editOpen, setEditOpen] = useState(false);
  const [selected, setSelected] = useState<Mailbox | null>(null);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<{ id: string; msg: string; ok: boolean } | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; msg: string; ok: boolean; details?: any } | null>(null);
  const [syncStuck, setSyncStuck] = useState(false);
  const [form, setForm] = useState({
    name: '', email_address: '', provider_type: 'imap',
    imap_host: '', imap_port: '993',
    smtp_host: '', smtp_port: '465', smtp_security: 'SSL', username: '', encrypted_password: '',
    use_tls: true, polling_interval_seconds: '60', signature: '',
    style_prompt: '', tone: 'professional',
    ovh_consumer_key: '', ovh_domain: '', ovh_account: '',
  });

  useEffect(() => {
    load();

    const checkInterval = setInterval(() => {
      if (isSyncing) {
        const now = Date.now();
        const noProgressDuration = now - lastProgressTime;
        const totalDuration = now - syncStartTime;

        if (noProgressDuration > MAX_NO_PROGRESS_DURATION) {
          console.warn('Auto-resetting stuck sync - no progress for', MAX_NO_PROGRESS_DURATION, 'ms');
          isSyncing = false;
          syncStartTime = 0;
          lastProgressTime = 0;
          currentSyncMailboxId = null;
          setSyncing(null);
          setSyncStuck(true);
          setSyncResult({
            id: currentSyncMailboxId || '',
            msg: 'Sync bloquée (aucun progrès) - réinitialisée automatiquement',
            ok: false
          });
        } else if (totalDuration > MAX_SYNC_DURATION) {
          console.warn('Auto-resetting long-running sync after', MAX_SYNC_DURATION, 'ms');
          isSyncing = false;
          syncStartTime = 0;
          lastProgressTime = 0;
          currentSyncMailboxId = null;
          setSyncing(null);
          setSyncStuck(true);
          setSyncResult({
            id: currentSyncMailboxId || '',
            msg: 'Sync trop longue - réinitialisée automatiquement',
            ok: false
          });
        }
      }
    }, 5000);

    return () => clearInterval(checkInterval);
  }, []);

  async function load() {
    const { data } = await supabase
      .from('mailboxes')
      .select('id, name, email_address, provider_type, imap_host, imap_port, smtp_host, smtp_port, smtp_security, username, use_tls, polling_interval_seconds, is_active, signature, style_prompt, tone, ovh_domain, ovh_account, created_at, updated_at')
      .order('name');
    if (data) setMailboxes(data);
  }

  function openNew() {
    setSelected(null);
    setForm({
      name: '', email_address: '', provider_type: 'imap',
      imap_host: 'ssl0.ovh.net', imap_port: '993',
      smtp_host: 'ssl0.ovh.net', smtp_port: '465', smtp_security: 'SSL', username: '', encrypted_password: '',
      use_tls: true, polling_interval_seconds: '60', signature: '',
      style_prompt: '', tone: 'professional',
      ovh_consumer_key: '', ovh_domain: '', ovh_account: '',
    });
    setEditOpen(true);
  }

  function openEdit(mb: Mailbox) {
    setSelected(mb);
    setForm({
      name: mb.name, email_address: mb.email_address,
      provider_type: (mb as any).provider_type || 'imap',
      imap_host: mb.imap_host,
      imap_port: String(mb.imap_port), smtp_host: mb.smtp_host,
      smtp_port: String(mb.smtp_port), smtp_security: (mb as any).smtp_security || 'SSL', username: mb.username,
      encrypted_password: '', use_tls: mb.use_tls,
      polling_interval_seconds: String(mb.polling_interval_seconds),
      signature: mb.signature, style_prompt: mb.style_prompt, tone: mb.tone,
      ovh_consumer_key: (mb as any).ovh_consumer_key || '',
      ovh_domain: (mb as any).ovh_domain || '',
      ovh_account: (mb as any).ovh_account || '',
    });
    setEditOpen(true);
  }

  async function handleSave() {
    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/update-mailbox-credentials`;

      const payload: any = {
        mailboxId: selected?.id,
        name: form.name,
        email_address: form.email_address,
        provider_type: form.provider_type,
        signature: form.signature,
        style_prompt: form.style_prompt,
        tone: form.tone,
      };

      if (form.provider_type === 'ovh') {
        payload.ovh_domain = form.ovh_domain;
        payload.ovh_account = form.ovh_account;
        if (form.ovh_consumer_key) {
          payload.ovh_consumer_key = form.ovh_consumer_key;
        }
      } else {
        payload.imap_host = form.imap_host;
        payload.imap_port = parseInt(form.imap_port);
        payload.smtp_host = form.smtp_host;
        payload.smtp_port = parseInt(form.smtp_port);
        payload.smtp_security = form.smtp_security;
        payload.username = form.username;
        payload.use_tls = form.use_tls;
        payload.polling_interval_seconds = parseInt(form.polling_interval_seconds);
        if (form.encrypted_password) {
          payload.password = form.encrypted_password;
        }
      }

      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.access_token) {
        alert('Session expirée, veuillez vous reconnecter');
        return;
      }

      console.log('Sending request to:', apiUrl);
      console.log('Payload:', { ...payload, password: payload.password ? '***' : undefined });

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify(payload),
      });

      console.log('Response status:', response.status);

      if (!response.ok) {
        const contentType = response.headers.get('content-type');
        let errorMessage = 'Failed to save mailbox';

        if (contentType?.includes('application/json')) {
          const error = await response.json();
          console.error('Server error response:', error);
          errorMessage = error.details || error.error || errorMessage;
        } else {
          const errorText = await response.text();
          console.error('Server error text:', errorText);
          errorMessage = errorText || errorMessage;
        }

        throw new Error(errorMessage);
      }

      setEditOpen(false);
      load();
    } catch (error: any) {
      console.error('Error saving mailbox:', error);
      alert(`Erreur: ${error.message}`);
    }
  }

  async function toggleActive(mb: Mailbox) {
    await supabase.from('mailboxes').update({ is_active: !mb.is_active }).eq('id', mb.id);
    load();
  }

  async function handleDelete(mb: Mailbox) {
    if (!confirm(`Delete mailbox "${mb.name}"? This will also remove all associated tickets.`)) return;
    await supabase.from('mailboxes').delete().eq('id', mb.id);
    load();
  }

  async function handleTestConnection(mb: Mailbox) {
    setTesting(mb.id);
    setTestResult(null);

    console.log('[MailboxManager] Testing connection for mailbox:', mb.id);

    const { data, error } = await callEdgeFunction<{
      success: boolean;
      message?: string;
      error?: string;
      details?: {
        server: string;
        username: string;
        email_count: number;
        timings: {
          connection_ms: number;
          login_ms: number;
          select_ms: number;
          total_ms: number;
        }
      }
    }>({
      functionName: 'test-imap-connection',
      body: {
        mailbox_id: mb.id,
        imap_host: mb.imap_host,
        imap_port: mb.imap_port,
        username: mb.username,
      },
      timeout: 15000
    });

    if (error) {
      console.error('[MailboxManager] Test connection failed:', error);
      setTestResult({
        id: mb.id,
        msg: `✗ ${error}`,
        ok: false
      });
    } else if (data?.success) {
      console.log('[MailboxManager] Test connection successful:', data.details);
      setTestResult({
        id: mb.id,
        msg: `✓ ${data.message} - ${data.details?.email_count || 0} emails trouvés (${data.details?.timings.total_ms || 0}ms)`,
        ok: true,
        details: data.details
      });
    } else {
      console.warn('[MailboxManager] Test connection returned error:', data?.error);
      setTestResult({
        id: mb.id,
        msg: `✗ ${data?.error || 'Erreur inconnue'}`,
        ok: false
      });
    }

    setTesting(null);
  }

  function forceResetSync() {
    console.warn('Manual sync reset triggered');
    isSyncing = false;
    syncStartTime = 0;
    lastProgressTime = 0;
    currentSyncMailboxId = null;
    setSyncing(null);
    setSyncStuck(false);
    setSyncResult(null);
  }

  async function syncMailboxSafe(mb: Mailbox, startUID: number = 1): Promise<{ success: boolean; synced: number; hasMore: boolean; nextUID: number; error?: string }> {
    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-mailbox`;

      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mailbox_id: mb.id,
          startUID: startUID
        }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const data = await res.json();

      if (data.results?.[0]) {
        const r = data.results[0];

        if (r.status === 'ok') {
          return {
            success: true,
            synced: r.synced || 0,
            hasMore: r.has_more === true,
            nextUID: r.next_uid || startUID
          };
        } else if (r.status === 'skipped') {
          return {
            success: false,
            synced: 0,
            hasMore: false,
            nextUID: startUID,
            error: r.reason || 'Ignoré'
          };
        } else {
          return {
            success: false,
            synced: 0,
            hasMore: false,
            nextUID: startUID,
            error: r.error || 'Erreur inconnue'
          };
        }
      }

      if (data.error) {
        return {
          success: false,
          synced: 0,
          hasMore: false,
          nextUID: startUID,
          error: data.error
        };
      }

      return {
        success: false,
        synced: 0,
        hasMore: false,
        nextUID: startUID,
        error: 'Réponse invalide'
      };
    } catch (err: any) {
      return {
        success: false,
        synced: 0,
        hasMore: false,
        nextUID: startUID,
        error: err.message || 'Erreur réseau'
      };
    }
  }

  async function syncAllEmails(mb: Mailbox, mode: string = "new") {
    let totalSynced = 0;
    let batchCount = 0;
    let hasMore = true;
    let currentUID = 1;
    const maxBatches = 10000;

    while (hasMore && batchCount < maxBatches && isSyncing) {
      batchCount++;

      const result = await syncMailboxSafe(mb, currentUID);

      if (result.success) {
        totalSynced += result.synced;
        hasMore = result.hasMore;
        currentUID = result.nextUID;
        lastProgressTime = Date.now();

        const progressMsg = `Batch ${batchCount}: ${result.synced} email${result.synced !== 1 ? 's' : ''} synchronisé${result.synced !== 1 ? 's' : ''} (Total: ${totalSynced})${hasMore ? ' - En cours...' : ' - Terminé'}`;

        setSyncResult({
          id: mb.id,
          msg: progressMsg,
          ok: true
        });

        if (hasMore && result.synced > 0) {
          await new Promise(resolve => setTimeout(resolve, 200));
        } else if (result.synced === 0) {
          hasMore = false;
        }
      } else {
        setSyncResult({ id: mb.id, msg: result.error || 'Erreur', ok: false });
        hasMore = false;
      }
    }

    if (batchCount >= maxBatches) {
      setSyncResult({
        id: mb.id,
        msg: `Limite atteinte: ${totalSynced} emails synchronisés en ${batchCount} batchs`,
        ok: true
      });
    } else if (totalSynced > 0) {
      setSyncResult({
        id: mb.id,
        msg: `Synchronisation terminée: ${totalSynced} email${totalSynced !== 1 ? 's' : ''} synchronisé${totalSynced !== 1 ? 's' : ''} en ${batchCount} batch${batchCount !== 1 ? 's' : ''}`,
        ok: true
      });
    }

    return totalSynced;
  }

  async function handleSync(mb: Mailbox, mode: string = "new") {
    if (isSyncing) {
      const now = Date.now();
      const currentMailbox = mailboxes.find(m => m.id === currentSyncMailboxId);
      const currentMailboxName = currentMailbox ? currentMailbox.name : 'inconnue';
      const noProgressDuration = now - lastProgressTime;

      if (noProgressDuration > MAX_NO_PROGRESS_DURATION) {
        console.warn('Sync was stuck (no progress), resetting state automatically');
        isSyncing = false;
        syncStartTime = 0;
        lastProgressTime = 0;
        currentSyncMailboxId = null;
      } else {
        console.log('Already syncing, skipping. Current sync mailbox:', currentSyncMailboxId);
        const elapsedSeconds = Math.floor((now - syncStartTime) / 1000);
        setSyncResult({
          id: mb.id,
          msg: `Une synchronisation est déjà en cours pour "${currentMailboxName}" (${elapsedSeconds}s). Veuillez patienter ou cliquez sur "Arrêter".`,
          ok: false
        });
        return;
      }
    }

    isSyncing = true;
    syncStartTime = Date.now();
    lastProgressTime = Date.now();
    currentSyncMailboxId = mb.id;
    setSyncing(mb.id);
    setSyncResult(null);
    setSyncStuck(false);

    const modeLabel = mode === "all" ? "COMPLÈTE" : "NOUVEAUX";
    console.log(`SYNC ${modeLabel} START for mailbox:`, mb.id, 'at', new Date(syncStartTime).toISOString());

    try {
      const totalSynced = await syncAllEmails(mb, mode);
      console.log(`SYNC ${modeLabel} SUCCESS for mailbox:`, mb.id, '- Total synced:', totalSynced);
    } catch (err: any) {
      console.error(`SYNC ${modeLabel} ERROR for mailbox:`, mb.id, '-', err);
      setSyncResult({ id: mb.id, msg: err.message || 'Erreur réseau', ok: false });
    } finally {
      isSyncing = false;
      syncStartTime = 0;
      lastProgressTime = 0;
      currentSyncMailboxId = null;
      setSyncing(null);
      console.log(`SYNC ${modeLabel} END for mailbox:`, mb.id, 'at', new Date().toISOString());
      load();
    }
  }

  async function handleSyncAll(mb: Mailbox) {
    return handleSync(mb, "all");
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Boîtes mail</h3>
          <p className="text-sm text-slate-500">Gérer les connexions aux boîtes mail OVH</p>
        </div>
        <div className="flex items-center gap-2">
          {(isSyncing || syncStuck) && (
            <button
              onClick={forceResetSync}
              className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded-lg transition"
              title="Réinitialiser la synchronisation bloquée"
            >
              <AlertCircle className="w-4 h-4" />
              Reset Sync
            </button>
          )}
          <button onClick={openNew} className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-medium rounded-lg transition">
            <Plus className="w-4 h-4" />
            Ajouter une boîte mail
          </button>
        </div>
      </div>

      {syncStuck && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-900">Synchronisation bloquée détectée</p>
            <p className="text-xs text-amber-700 mt-0.5">
              La synchronisation a été réinitialisée automatiquement car elle ne progressait plus.
            </p>
          </div>
        </div>
      )}

      {isSyncing && syncing && (
        <div className="mb-4 p-3 bg-cyan-50 border border-cyan-200 rounded-lg flex items-start gap-2">
          <Loader2 className="w-5 h-5 text-cyan-600 flex-shrink-0 mt-0.5 animate-spin" />
          <div className="flex-1">
            <p className="text-sm font-medium text-cyan-900">
              Synchronisation en cours: {mailboxes.find(m => m.id === syncing)?.name || 'Boîte mail'}
            </p>
            <p className="text-xs text-cyan-700 mt-0.5">
              Cette opération peut prendre plusieurs minutes pour les boîtes avec beaucoup d'emails. Veuillez patienter...
            </p>
          </div>
          <button
            onClick={forceResetSync}
            className="text-xs px-2 py-1 bg-cyan-100 hover:bg-cyan-200 text-cyan-800 rounded transition"
          >
            Arrêter
          </button>
        </div>
      )}

      <div className="space-y-3">
        {mailboxes.map(mb => (
          <div key={mb.id} className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
              <Server className="w-5 h-5 text-slate-500" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-slate-900">{mb.name}</p>
                <span className={`text-xs px-1.5 py-0.5 rounded ${mb.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                  {mb.is_active ? 'Actif' : 'Inactif'}
                </span>
                <span className={`text-xs px-1.5 py-0.5 rounded ${(mb as any).provider_type === 'ovh' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>
                  {(mb as any).provider_type === 'ovh' ? 'OVH API' : 'IMAP'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">{mb.email_address}</p>
              {(mb as any).provider_type === 'ovh' ? (
                <p className="text-xs text-slate-400">OVH: {(mb as any).ovh_account}@{(mb as any).ovh_domain}</p>
              ) : (
                <p className="text-xs text-slate-400">IMAP: {mb.imap_host}:{mb.imap_port} | SMTP: {mb.smtp_host}:{mb.smtp_port}</p>
              )}
              {syncResult?.id === mb.id && (
                <p className={`text-xs mt-1 ${syncResult.ok ? 'text-emerald-600' : 'text-red-500'}`}>
                  {syncResult.msg}
                </p>
              )}
              {testResult?.id === mb.id && (
                <p className={`text-xs mt-1 ${testResult.ok ? 'text-emerald-600' : 'text-red-500'}`}>
                  {testResult.msg}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {(mb as any).provider_type !== 'ovh' && (
                <button
                  onClick={() => handleTestConnection(mb)}
                  disabled={testing !== null || syncing !== null}
                  className="p-2 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition disabled:opacity-50"
                  title="Tester la connexion IMAP"
                >
                  {testing === mb.id ? (
                    <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
                  ) : (
                    <Zap className="w-4 h-4" />
                  )}
                </button>
              )}
              <button
                onClick={() => handleSync(mb, "new")}
                disabled={syncing !== null}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-50 text-cyan-700 hover:bg-cyan-100 transition disabled:opacity-50 text-xs font-medium"
                title="Synchroniser les nouveaux emails"
              >
                {syncing === mb.id ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Sync...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Nouveaux</span>
                  </>
                )}
              </button>
              <button
                onClick={() => handleSyncAll(mb)}
                disabled={syncing !== null}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition disabled:opacity-50 text-xs font-medium"
                title="Synchroniser TOUS les emails (historique complet)"
              >
                {syncing === mb.id ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Sync...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5" />
                    <span>Tout synchroniser</span>
                  </>
                )}
              </button>
              <button onClick={() => toggleActive(mb)} className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition">
                {mb.is_active ? <ToggleRight className="w-5 h-5 text-emerald-500" /> : <ToggleLeft className="w-5 h-5" />}
              </button>
              <button onClick={() => openEdit(mb)} className="p-2 rounded-lg text-slate-400 hover:text-cyan-600 hover:bg-cyan-50 transition">
                <Edit3 className="w-4 h-4" />
              </button>
              <button onClick={() => handleDelete(mb)} className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
        {mailboxes.length === 0 && (
          <p className="text-sm text-slate-500 text-center py-8">Aucune boîte mail configurée pour le moment.</p>
        )}
      </div>

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title={selected ? 'Modifier la boîte mail' : 'Ajouter une boîte mail'} size="lg">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Type de fournisseur</label>
            <select value={form.provider_type} onChange={e => setForm({ ...form, provider_type: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500">
              <option value="imap">IMAP (Connexion directe)</option>
              <option value="ovh">OVH API</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Nom d'affichage</label>
              <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500" placeholder="Boîte Support" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Adresse email</label>
              <input type="email" value={form.email_address} onChange={e => setForm({ ...form, email_address: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500" placeholder="support@entreprise.com" />
            </div>
          </div>

          {form.provider_type === 'ovh' ? (
            <div className="border border-blue-200 bg-blue-50/30 rounded-lg p-4">
              <h4 className="text-xs font-semibold text-blue-900 uppercase tracking-wider mb-3">Configuration OVH API</h4>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Consumer Key</label>
                  <input type="text" value={form.ovh_consumer_key} onChange={e => setForm({ ...form, ovh_consumer_key: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                    placeholder={selected ? "(inchangé si vide)" : "Clé consumer OVH"} />
                  {selected && (
                    <p className="text-xs text-slate-500 mt-1">
                      Laissez vide pour conserver la clé existante
                    </p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-600 mb-1">Domaine</label>
                    <input type="text" value={form.ovh_domain} onChange={e => setForm({ ...form, ovh_domain: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                      placeholder="exemple.com" />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-600 mb-1">Compte</label>
                    <input type="text" value={form.ovh_account} onChange={e => setForm({ ...form, ovh_account: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                      placeholder="contact" />
                  </div>
                </div>
                <p className="text-xs text-blue-700 mt-2">
                  Les identifiants OVH API sont configurés globalement. Seule la consumer key est requise par boîte mail.
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="border border-slate-200 rounded-lg p-4">
                <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-3">Paramètres IMAP</h4>
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className="block text-xs text-slate-500 mb-1">Hôte</label>
                    <input type="text" value={form.imap_host} onChange={e => setForm({ ...form, imap_host: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/20" placeholder="ssl0.ovh.net" />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Port</label>
                    <input type="number" value={form.imap_port} onChange={e => setForm({ ...form, imap_port: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/20" />
                  </div>
                </div>
              </div>

              <div className="border border-slate-200 rounded-lg p-4">
                <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-3">Paramètres SMTP</h4>
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className="block text-xs text-slate-500 mb-1">Hôte</label>
                    <input type="text" value={form.smtp_host} onChange={e => setForm({ ...form, smtp_host: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/20" placeholder="ssl0.ovh.net" />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Port</label>
                    <input type="number" value={form.smtp_port} onChange={e => setForm({ ...form, smtp_port: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/20" />
                  </div>
                </div>
                <div className="mt-3">
                  <label className="block text-xs text-slate-500 mb-1">Méthode de chiffrement</label>
                  <select value={form.smtp_security} onChange={e => setForm({ ...form, smtp_security: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/20">
                    <option value="SSL">SSL (Port 465)</option>
                    <option value="TLS">TLS</option>
                    <option value="STARTTLS">STARTTLS (Port 587)</option>
                    <option value="None">Aucun (Non recommandé)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Nom d'utilisateur</label>
                  <input type="text" value={form.username} onChange={e => setForm({ ...form, username: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Mot de passe</label>
                  <input type="password" value={form.encrypted_password} onChange={e => setForm({ ...form, encrypted_password: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                    placeholder={selected ? '(inchangé)' : 'Entrez le mot de passe'} />
                </div>
              </div>
            </>
          )}

          <div className="border border-slate-200 rounded-lg p-4">
            <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-3">Paramètres de style IA</h4>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Ton</label>
                <select value={form.tone} onChange={e => setForm({ ...form, tone: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/20">
                  <option value="professional">Professionnel</option>
                  <option value="friendly">Amical</option>
                  <option value="formal">Formel</option>
                  <option value="casual">Décontracté</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Instructions de style</label>
                <textarea value={form.style_prompt} onChange={e => setForm({ ...form, style_prompt: e.target.value })} rows={3}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                  placeholder="Instructions personnalisées pour les réponses générées par IA..." />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Signature</label>
                <textarea value={form.signature} onChange={e => setForm({ ...form, signature: e.target.value })} rows={2}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                  placeholder="Cordialement,&#10;Équipe Support" />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setEditOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800">Annuler</button>
            <button
              onClick={handleSave}
              disabled={
                !form.name ||
                !form.email_address ||
                (form.provider_type === 'ovh' && (
                  !form.ovh_domain ||
                  !form.ovh_account ||
                  (!selected && !form.ovh_consumer_key)
                ))
              }
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-medium rounded-lg transition disabled:opacity-50">
              {selected ? 'Enregistrer les modifications' : 'Ajouter la boîte mail'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
