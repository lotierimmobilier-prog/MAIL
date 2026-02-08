import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { ChevronDown, Plus, Eye, EyeOff, Mail, Send, Settings as SettingsIcon } from 'lucide-react';
import Badge from '../ui/Badge';
import Modal from '../ui/Modal';
import { supabase } from '../../lib/supabase';
import type { Profile, UserRole, Mailbox } from '../../lib/types';

const ROLE_COLORS: Record<string, string> = {
  admin: '#EF4444',
  manager: '#F59E0B',
  agent: '#3B82F6',
  readonly: '#6B7280',
};

interface MailboxPermission {
  mailboxId: string;
  canRead: boolean;
  canSend: boolean;
  canManage: boolean;
}

export default function UserManager() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<UserRole>('agent');
  const [avatarColor, setAvatarColor] = useState('#0891B2');
  const [mailboxPermissions, setMailboxPermissions] = useState<MailboxPermission[]>([]);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    load();
    loadMailboxes();
  }, []);

  async function load() {
    const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    if (data) setUsers(data);
  }

  async function loadMailboxes() {
    const { data } = await supabase.from('mailboxes').select('*').order('name');
    if (data) setMailboxes(data);
  }

  function openCreateModal() {
    setEmail('');
    setPassword('');
    setFullName('');
    setRole('agent');
    setAvatarColor('#0891B2');
    setShowPassword(false);
    setMailboxPermissions([]);
    setCreateModalOpen(true);
  }

  function toggleMailboxPermission(mailboxId: string, permission: 'canRead' | 'canSend' | 'canManage') {
    setMailboxPermissions(prev => {
      const existing = prev.find(p => p.mailboxId === mailboxId);
      if (existing) {
        if (permission === 'canRead' && existing.canRead && !existing.canSend && !existing.canManage) {
          return prev.filter(p => p.mailboxId !== mailboxId);
        }
        return prev.map(p =>
          p.mailboxId === mailboxId ? { ...p, [permission]: !p[permission] } : p
        );
      } else {
        return [...prev, { mailboxId, canRead: true, canSend: false, canManage: false }];
      }
    });
  }

  async function handleCreateUser() {
    if (!email || !password || !fullName) {
      alert('Veuillez remplir tous les champs obligatoires');
      return;
    }

    if (password.length < 8) {
      alert('Le mot de passe doit contenir au moins 8 caractères');
      return;
    }

    setCreating(true);
    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user`;
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        alert('Session expirée. Veuillez vous reconnecter.');
        return;
      }

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
          fullName,
          role,
          avatarColor,
          mailboxPermissions
        })
      });

      const result = await response.json();

      if (!response.ok) {
        alert(result.error || 'Erreur lors de la création de l\'utilisateur');
        return;
      }

      alert('Utilisateur créé avec succès');
      setCreateModalOpen(false);
      load();
    } catch (error) {
      alert('Erreur lors de la création de l\'utilisateur');
      console.error(error);
    } finally {
      setCreating(false);
    }
  }

  async function updateRole(userId: string, role: UserRole) {
    await supabase.from('profiles').update({ role, updated_at: new Date().toISOString() }).eq('id', userId);
    load();
  }

  async function toggleActive(user: Profile) {
    await supabase.from('profiles').update({ is_active: !user.is_active, updated_at: new Date().toISOString() }).eq('id', user.id);
    load();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Gestion des utilisateurs</h3>
          <p className="text-sm text-slate-500">Gérer les rôles et permissions de l'équipe</p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-medium rounded-lg transition"
        >
          <Plus className="w-4 h-4" />
          Créer un utilisateur
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Utilisateur</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Rôle</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Statut</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Inscrit le</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map(user => (
              <tr key={user.id} className="hover:bg-slate-50 transition">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-medium text-slate-600">
                      {(user.full_name || user.email).charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900">{user.full_name || 'Sans nom'}</p>
                      <p className="text-xs text-slate-500">{user.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="relative inline-block">
                    <select
                      value={user.role}
                      onChange={e => updateRole(user.id, e.target.value as UserRole)}
                      className="appearance-none bg-transparent pr-6 text-sm font-medium cursor-pointer focus:outline-none"
                      style={{ color: ROLE_COLORS[user.role] }}
                    >
                      <option value="admin">Admin</option>
                      <option value="manager">Manager</option>
                      <option value="agent">Agent</option>
                      <option value="readonly">Lecture seule</option>
                    </select>
                    <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
                  </div>
                </td>
                <td className="px-4 py-3">
                  <Badge
                    label={user.is_active ? 'Actif' : 'Désactivé'}
                    color={user.is_active ? '#10B981' : '#EF4444'}
                  />
                </td>
                <td className="px-4 py-3 text-sm text-slate-500">
                  {format(new Date(user.created_at), 'MMM d, yyyy')}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => toggleActive(user)}
                    className="text-xs font-medium text-slate-500 hover:text-slate-700 transition"
                  >
                    {user.is_active ? 'Désactiver' : 'Activer'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {users.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-slate-500">Aucun utilisateur trouvé.</div>
        )}
      </div>

      <Modal open={createModalOpen} onClose={() => setCreateModalOpen(false)} title="Créer un utilisateur" size="lg">
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Nom complet *</label>
              <input
                type="text"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                placeholder="Jean Dupont"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Email *</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="jean.dupont@exemple.com"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Mot de passe *</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Minimum 8 caractères"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-xs text-slate-500 mt-1">Au moins 8 caractères requis</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Rôle *</label>
              <select
                value={role}
                onChange={e => setRole(e.target.value as UserRole)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
              >
                <option value="agent">Agent</option>
                <option value="manager">Manager</option>
                <option value="readonly">Lecture seule</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-2">Couleur d'identification</label>
            <p className="text-xs text-slate-500 mb-2">Cette couleur sera affichée pour les tickets assignés à cet utilisateur</p>
            <div className="flex items-center gap-2">
              {['#0891B2', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#EC4899', '#8B5CF6', '#6B7280'].map(color => (
                <button
                  key={color}
                  onClick={() => setAvatarColor(color)}
                  className={`w-8 h-8 rounded-lg border-2 transition ${avatarColor === color ? 'border-slate-900 scale-110' : 'border-transparent'}`}
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-2">Permissions des boîtes mail</label>
            <p className="text-xs text-slate-500 mb-3">Définissez les boîtes mail auxquelles l'utilisateur aura accès</p>

            {mailboxes.length === 0 ? (
              <div className="text-sm text-slate-500 text-center py-4 bg-slate-50 rounded-lg">
                Aucune boîte mail disponible
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto border border-slate-200 rounded-lg">
                {mailboxes.map(mailbox => {
                  const perm = mailboxPermissions.find(p => p.mailboxId === mailbox.id);
                  return (
                    <div key={mailbox.id} className="flex items-center gap-3 p-3 hover:bg-slate-50 border-b border-slate-100 last:border-0">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900">{mailbox.name}</p>
                        <p className="text-xs text-slate-500">{mailbox.email_address}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => toggleMailboxPermission(mailbox.id, 'canRead')}
                          className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition ${
                            perm?.canRead
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                          }`}
                        >
                          <Mail className="w-3 h-3" />
                          Lire
                        </button>
                        <button
                          onClick={() => toggleMailboxPermission(mailbox.id, 'canSend')}
                          className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition ${
                            perm?.canSend
                              ? 'bg-green-100 text-green-700'
                              : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                          }`}
                          disabled={!perm?.canRead}
                        >
                          <Send className="w-3 h-3" />
                          Envoyer
                        </button>
                        <button
                          onClick={() => toggleMailboxPermission(mailbox.id, 'canManage')}
                          className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition ${
                            perm?.canManage
                              ? 'bg-orange-100 text-orange-700'
                              : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                          }`}
                          disabled={!perm?.canRead}
                        >
                          <SettingsIcon className="w-3 h-3" />
                          Gérer
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
              onClick={() => setCreateModalOpen(false)}
              disabled={creating}
              className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 disabled:opacity-50"
            >
              Annuler
            </button>
            <button
              onClick={handleCreateUser}
              disabled={creating || !email || !password || !fullName}
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-medium rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {creating ? 'Création...' : 'Créer l\'utilisateur'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
