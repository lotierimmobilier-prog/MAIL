import { useState, useEffect } from 'react';
import { Mail, Send, Settings as SettingsIcon } from 'lucide-react';
import Modal from '../ui/Modal';
import { supabase } from '../../lib/supabase';
import type { Profile, UserRole, Mailbox, ViewPermission } from '../../lib/types';
import { ALL_VIEW_PERMISSIONS, VIEW_PERMISSION_LABELS } from '../../lib/types';

interface MailboxPerm {
  mailboxId: string;
  canRead: boolean;
  canSend: boolean;
  canManage: boolean;
}

interface UserEditModalProps {
  user: Profile;
  mailboxes: Mailbox[];
  onClose: () => void;
  onSaved: () => void;
}

const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Admin',
  manager: 'Manager',
  agent: 'Agent',
  readonly: 'Lecture seule',
};

const AVATAR_COLORS = ['#0891B2', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#EC4899', '#8B5CF6', '#6B7280'];

export default function UserEditModal({ user, mailboxes, onClose, onSaved }: UserEditModalProps) {
  const [fullName, setFullName] = useState(user.full_name || '');
  const [role, setRole] = useState<UserRole>(user.role);
  const [avatarColor, setAvatarColor] = useState(user.avatar_color || '#0891B2');
  const [isActive, setIsActive] = useState(user.is_active);
  const [allowedViews, setAllowedViews] = useState<ViewPermission[]>(user.allowed_views || [...ALL_VIEW_PERMISSIONS]);
  const [mailboxPerms, setMailboxPerms] = useState<MailboxPerm[]>([]);
  const [saving, setSaving] = useState(false);
  const [loadingPerms, setLoadingPerms] = useState(true);

  useEffect(() => {
    loadMailboxPermissions();
  }, []);

  async function loadMailboxPermissions() {
    const { data } = await supabase
      .from('mailbox_permissions')
      .select('mailbox_id, can_read, can_send, can_manage')
      .eq('user_id', user.id);

    if (data) {
      setMailboxPerms(data.map(p => ({
        mailboxId: p.mailbox_id,
        canRead: p.can_read,
        canSend: p.can_send,
        canManage: p.can_manage,
      })));
    }
    setLoadingPerms(false);
  }

  function toggleView(view: ViewPermission) {
    setAllowedViews(prev =>
      prev.includes(view)
        ? prev.filter(v => v !== view)
        : [...prev, view]
    );
  }

  function toggleMailboxPerm(mailboxId: string, permission: 'canRead' | 'canSend' | 'canManage') {
    setMailboxPerms(prev => {
      const existing = prev.find(p => p.mailboxId === mailboxId);
      if (existing) {
        if (permission === 'canRead' && existing.canRead && !existing.canSend && !existing.canManage) {
          return prev.filter(p => p.mailboxId !== mailboxId);
        }
        return prev.map(p =>
          p.mailboxId === mailboxId ? { ...p, [permission]: !p[permission] } : p
        );
      }
      return [...prev, { mailboxId, canRead: true, canSend: false, canManage: false }];
    });
  }

  async function handleSave() {
    if (!fullName.trim()) return;
    setSaving(true);

    try {
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          full_name: fullName.trim(),
          role,
          avatar_color: avatarColor,
          is_active: isActive,
          allowed_views: allowedViews,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (profileError) {
        alert('Erreur lors de la mise a jour du profil');
        return;
      }

      await supabase.from('mailbox_permissions').delete().eq('user_id', user.id);

      const permsToInsert = mailboxPerms
        .filter(p => p.canRead || p.canSend || p.canManage)
        .map(p => ({
          user_id: user.id,
          mailbox_id: p.mailboxId,
          can_read: p.canRead,
          can_send: p.canSend,
          can_manage: p.canManage,
        }));

      if (permsToInsert.length > 0) {
        await supabase.from('mailbox_permissions').insert(permsToInsert);
      }

      onSaved();
    } catch {
      alert('Erreur lors de la mise a jour');
    } finally {
      setSaving(false);
    }
  }

  const isAdminOrManager = role === 'admin' || role === 'manager';

  return (
    <Modal open onClose={onClose} title={`Modifier - ${user.full_name || user.email}`} size="lg">
      <div className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Nom complet</label>
            <input
              type="text"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Role</label>
            <select
              value={role}
              onChange={e => setRole(e.target.value as UserRole)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
            >
              {Object.entries(ROLE_LABELS).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <label className="text-xs font-medium text-slate-600">Compte actif</label>
          <button
            onClick={() => setIsActive(!isActive)}
            className={`relative w-10 h-5 rounded-full transition-colors ${isActive ? 'bg-emerald-500' : 'bg-slate-300'}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${isActive ? 'translate-x-5' : ''}`} />
          </button>
          <span className={`text-xs ${isActive ? 'text-emerald-600' : 'text-slate-500'}`}>
            {isActive ? 'Actif' : 'Desactive'}
          </span>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-2">Couleur d'identification</label>
          <div className="flex items-center gap-2">
            {AVATAR_COLORS.map(color => (
              <button
                key={color}
                onClick={() => setAvatarColor(color)}
                className={`w-8 h-8 rounded-lg border-2 transition ${avatarColor === color ? 'border-slate-900 scale-110' : 'border-transparent'}`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-2">Vues autorisees</label>
          {isAdminOrManager ? (
            <p className="text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2">
              Les administrateurs et managers ont acces a toutes les vues.
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {ALL_VIEW_PERMISSIONS.map(view => (
                <label
                  key={view}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition ${
                    allowedViews.includes(view)
                      ? 'bg-cyan-50 border-cyan-300 text-cyan-800'
                      : 'bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={allowedViews.includes(view)}
                    onChange={() => toggleView(view)}
                    className="sr-only"
                  />
                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition ${
                    allowedViews.includes(view) ? 'bg-cyan-500 border-cyan-500' : 'border-slate-300'
                  }`}>
                    {allowedViews.includes(view) && (
                      <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <span className="text-xs font-medium">{VIEW_PERMISSION_LABELS[view]}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-2">Permissions des boites mail</label>
          {loadingPerms ? (
            <div className="text-sm text-slate-500 text-center py-4">Chargement...</div>
          ) : mailboxes.length === 0 ? (
            <div className="text-sm text-slate-500 text-center py-4 bg-slate-50 rounded-lg">
              Aucune boite mail disponible
            </div>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto border border-slate-200 rounded-lg">
              {mailboxes.map(mailbox => {
                const perm = mailboxPerms.find(p => p.mailboxId === mailbox.id);
                return (
                  <div key={mailbox.id} className="flex items-center gap-3 p-3 hover:bg-slate-50 border-b border-slate-100 last:border-0">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900">{mailbox.name}</p>
                      <p className="text-xs text-slate-500">{mailbox.email_address}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => toggleMailboxPerm(mailbox.id, 'canRead')}
                        className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition ${
                          perm?.canRead ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                        }`}
                      >
                        <Mail className="w-3 h-3" />
                        Lire
                      </button>
                      <button
                        onClick={() => toggleMailboxPerm(mailbox.id, 'canSend')}
                        className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition ${
                          perm?.canSend ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                        }`}
                        disabled={!perm?.canRead}
                      >
                        <Send className="w-3 h-3" />
                        Envoyer
                      </button>
                      <button
                        onClick={() => toggleMailboxPerm(mailbox.id, 'canManage')}
                        className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition ${
                          perm?.canManage ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                        }`}
                        disabled={!perm?.canRead}
                      >
                        <SettingsIcon className="w-3 h-3" />
                        Gerer
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !fullName.trim()}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-medium rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
