import { useEffect, useState } from 'react';
import { Plus, Edit3, Trash2, ToggleLeft, ToggleRight, Server, RefreshCw, Loader2 } from 'lucide-react';
import Modal from '../ui/Modal';
import { supabase } from '../../lib/supabase';
import type { Mailbox } from '../../lib/types';

export default function MailboxManager() {
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [editOpen, setEditOpen] = useState(false);
  const [selected, setSelected] = useState<Mailbox | null>(null);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<{ id: string; msg: string; ok: boolean } | null>(null);
  const [form, setForm] = useState({
    name: '', email_address: '', provider_type: 'imap',
    imap_host: '', imap_port: '993',
    smtp_host: '', smtp_port: '465', smtp_security: 'SSL', username: '', encrypted_password: '',
    use_tls: true, polling_interval_seconds: '60', signature: '',
    style_prompt: '', tone: 'professional',
    ovh_consumer_key: '', ovh_domain: '', ovh_account: '',
  });

  useEffect(() => { load(); }, []);

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

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save mailbox');
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

  async function handleSync(mb: Mailbox) {
    setSyncing(mb.id);
    setSyncResult(null);
    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-mailbox`;
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ mailbox_id: mb.id }),
      });
      const data = await res.json();
      if (data.results?.[0]) {
        const r = data.results[0];
        if (r.status === 'ok') {
          setSyncResult({ id: mb.id, msg: `${r.synced} email${r.synced !== 1 ? 's' : ''} synchronise(s)`, ok: true });
        } else if (r.status === 'skipped') {
          setSyncResult({ id: mb.id, msg: r.reason || 'Ignore', ok: false });
        } else {
          setSyncResult({ id: mb.id, msg: r.error || 'Erreur inconnue', ok: false });
        }
      } else if (data.error) {
        setSyncResult({ id: mb.id, msg: data.error, ok: false });
      }
    } catch (err: any) {
      setSyncResult({ id: mb.id, msg: err.message || 'Erreur reseau', ok: false });
    }
    setSyncing(null);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Boîtes mail</h3>
          <p className="text-sm text-slate-500">Gérer les connexions aux boîtes mail OVH</p>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-medium rounded-lg transition">
          <Plus className="w-4 h-4" />
          Ajouter une boîte mail
        </button>
      </div>

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
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => handleSync(mb)}
                disabled={syncing !== null}
                className="p-2 rounded-lg text-slate-400 hover:text-cyan-600 hover:bg-cyan-50 transition disabled:opacity-50"
                title="Synchroniser les emails"
              >
                {syncing === mb.id ? (
                  <Loader2 className="w-4 h-4 animate-spin text-cyan-500" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
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
                    placeholder="Clé consumer OVH" />
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
                (form.provider_type === 'ovh' && (!form.ovh_consumer_key || !form.ovh_domain || !form.ovh_account))
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
