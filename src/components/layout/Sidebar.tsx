import { NavLink, useSearchParams } from 'react-router-dom';
import {
  Mail, LayoutDashboard, Inbox, FileText, Settings, BarChart3, BookOpen,
  LogOut, ChevronLeft, ChevronRight, ChevronDown, Users, SquarePen,
  FolderOpen, Plus, Trash2,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { useMailboxPermissions } from '../../hooks/useMailboxPermissions';
import type { Mailbox, MailboxFolder, ViewPermission } from '../../lib/types';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  onCompose: () => void;
  mobileOpen?: boolean;
  isMobile?: boolean;
  onCloseMobile?: () => void;
}

const navItems: { to: string; icon: typeof LayoutDashboard; label: string; view: ViewPermission }[] = [
  { to: '/', icon: LayoutDashboard, label: 'Tableau de bord', view: 'dashboard' },
  { to: '/inbox', icon: Inbox, label: 'Boite de reception', view: 'inbox' },
  { to: '/contacts', icon: Users, label: 'Annuaire', view: 'contacts' },
  { to: '/templates', icon: FileText, label: 'Modeles', view: 'templates' },
  { to: '/knowledge', icon: BookOpen, label: 'Base de connaissances', view: 'knowledge' },
  { to: '/reports', icon: BarChart3, label: 'Rapports', view: 'reports' },
  { to: '/admin', icon: Settings, label: 'Admin', view: 'admin' },
];

export default function Sidebar({ collapsed, onToggle, onCompose, mobileOpen, isMobile, onCloseMobile }: SidebarProps) {
  const { signOut, hasView, userFullName, userRole, canManage } = useAuth();
  const { getReadableMailboxIds, getSendableMailboxIds } = useMailboxPermissions();
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [folders, setFolders] = useState<MailboxFolder[]>([]);
  const [expandedMailboxes, setExpandedMailboxes] = useState<Set<string>>(new Set());
  const [showMailboxes, setShowMailboxes] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const [creatingFolder, setCreatingFolder] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState('');

  useEffect(() => {
    loadMailboxes();
    loadFolders();
  }, []);

  async function loadMailboxes() {
    const { data } = await supabase
      .from('mailboxes')
      .select('*')
      .eq('is_active', true)
      .order('name');
    if (data) {
      const readableIds = getReadableMailboxIds();
      setMailboxes(readableIds ? data.filter(m => readableIds.has(m.id)) : data);
    }
  }

  async function loadFolders() {
    const { data } = await supabase
      .from('mailbox_folders')
      .select('*')
      .order('sort_order', { ascending: true });
    if (data) setFolders(data);
  }

  function toggleMailbox(mailboxId: string) {
    setExpandedMailboxes(prev => {
      const next = new Set(prev);
      if (next.has(mailboxId)) next.delete(mailboxId);
      else next.add(mailboxId);
      return next;
    });
  }

  function selectMailbox(mailboxId: string | null) {
    const newParams = new URLSearchParams(searchParams);
    if (mailboxId) {
      newParams.set('mailbox', mailboxId);
    } else {
      newParams.delete('mailbox');
    }
    newParams.delete('folder');
    setSearchParams(newParams);
  }

  function selectFolder(mailboxId: string, folderId: string) {
    const newParams = new URLSearchParams(searchParams);
    newParams.set('mailbox', mailboxId);
    newParams.set('folder', folderId);
    setSearchParams(newParams);
  }

  async function createFolder(mailboxId: string) {
    if (!newFolderName.trim()) return;
    const maxSort = folders.filter(f => f.mailbox_id === mailboxId).length;
    await supabase.from('mailbox_folders').insert({
      mailbox_id: mailboxId,
      name: newFolderName.trim(),
      imap_path: newFolderName.trim(),
      sort_order: maxSort,
    });
    setNewFolderName('');
    setCreatingFolder(null);
    loadFolders();
  }

  async function deleteFolder(folderId: string) {
    await supabase.from('mailbox_folders').delete().eq('id', folderId);
    loadFolders();
  }

  function getFoldersForMailbox(mailboxId: string) {
    return folders.filter(f => f.mailbox_id === mailboxId && !f.parent_id);
  }

  const selectedMailbox = searchParams.get('mailbox');
  const selectedFolder = searchParams.get('folder');
  const sendableIds = getSendableMailboxIds();
  const canSendAny = !sendableIds || sendableIds.size > 0;

  return (
    <aside
      className={`fixed top-0 left-0 h-screen bg-slate-900 text-white flex flex-col transition-all duration-300 ${
        isMobile
          ? `w-60 z-50 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`
          : `z-30 ${collapsed ? 'w-16' : 'w-60'}`
      }`}
    >
      <div className={`flex flex-col items-center justify-center px-3 py-3 border-b border-slate-800 shrink-0 ${collapsed ? 'h-16' : 'min-h-fit'}`}>
        <div className="bg-white rounded-lg p-2">
          <img
            src="/lotier.png"
            alt="Lotier Immobilier"
            className={`${collapsed ? 'w-10 h-10' : 'w-12 h-12'} object-contain`}
          />
        </div>
        {!collapsed && (
          <div className="text-center mt-2">
            <p className="text-xs font-semibold text-slate-300 tracking-tight">messagerie IA+</p>
          </div>
        )}
      </div>

      {canSendAny && (
        <div className="px-3 pt-4 pb-2">
          <button
            onClick={onCompose}
            className={`flex items-center gap-2 w-full rounded-lg font-medium transition-colors ${
              collapsed
                ? 'justify-center p-2.5 bg-cyan-500 hover:bg-cyan-600 text-white'
                : 'px-4 py-2.5 bg-cyan-500 hover:bg-cyan-600 text-white text-sm'
            }`}
            title="Nouveau message"
          >
            <SquarePen className="w-5 h-5 shrink-0" />
            {!collapsed && <span>Nouveau message</span>}
          </button>
        </div>
      )}

      <nav className="flex-1 py-2 px-2 space-y-1 overflow-y-auto">
        {navItems.filter(item => hasView(item.view)).map((item) => (
          <div key={item.to}>
            <NavLink
              to={item.to}
              end={item.to === '/'}
              onClick={() => isMobile && onCloseMobile?.()}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-cyan-500/15 text-cyan-400'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                } ${collapsed ? 'justify-center' : ''}`
              }
            >
              <item.icon className="w-5 h-5 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </NavLink>

            {item.to === '/inbox' && !collapsed && mailboxes.length > 0 && (
              <div className="ml-3 mt-1 space-y-0.5">
                <button
                  onClick={() => setShowMailboxes(!showMailboxes)}
                  className="flex items-center gap-2 px-3 py-1.5 text-xs text-slate-400 hover:text-slate-300 transition w-full"
                >
                  <ChevronDown className={`w-3 h-3 transition-transform ${showMailboxes ? 'rotate-180' : ''}`} />
                  <span>Boites mail</span>
                </button>

                {showMailboxes && (
                  <div className="space-y-0.5 pl-1">
                    <button
                      onClick={() => selectMailbox(null)}
                      className={`block w-full text-left px-3 py-1.5 text-xs rounded transition ${
                        !selectedMailbox
                          ? 'bg-cyan-500/10 text-cyan-400'
                          : 'text-slate-400 hover:text-white hover:bg-slate-800'
                      }`}
                    >
                      Toutes les boites
                    </button>
                    {mailboxes.map(mailbox => {
                      const mbFolders = getFoldersForMailbox(mailbox.id);
                      const isExpanded = expandedMailboxes.has(mailbox.id);
                      const isSelected = selectedMailbox === mailbox.id && !selectedFolder;

                      return (
                        <div key={mailbox.id}>
                          <div className="flex items-center group">
                            <button
                              onClick={() => toggleMailbox(mailbox.id)}
                              className="p-1 text-slate-500 hover:text-slate-300 transition shrink-0"
                            >
                              <ChevronDown className={`w-3 h-3 transition-transform ${isExpanded ? '' : '-rotate-90'}`} />
                            </button>
                            <button
                              onClick={() => selectMailbox(mailbox.id)}
                              className={`flex-1 text-left px-2 py-1.5 text-xs rounded transition truncate ${
                                isSelected
                                  ? 'bg-cyan-500/10 text-cyan-400'
                                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
                              }`}
                              title={mailbox.name}
                            >
                              {mailbox.name}
                            </button>
                          </div>

                          {isExpanded && (
                            <div className="ml-4 pl-2 border-l border-slate-700/50 space-y-0.5 mt-0.5">
                              {mbFolders.map(folder => (
                                <div key={folder.id} className="flex items-center group">
                                  <button
                                    onClick={() => selectFolder(mailbox.id, folder.id)}
                                    className={`flex items-center gap-1.5 flex-1 text-left px-2 py-1 text-xs rounded transition truncate ${
                                      selectedFolder === folder.id
                                        ? 'bg-cyan-500/10 text-cyan-400'
                                        : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
                                    }`}
                                    title={folder.name}
                                  >
                                    <FolderOpen className="w-3 h-3 shrink-0" />
                                    {folder.name}
                                  </button>
                                  {canManage && folder.imap_path !== 'INBOX' && (
                                    <button
                                      onClick={() => deleteFolder(folder.id)}
                                      className="p-0.5 text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition shrink-0"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>
                              ))}

                              {canManage && (
                                <>
                                  {creatingFolder === mailbox.id ? (
                                    <div className="flex items-center gap-1 px-1">
                                      <input
                                        type="text"
                                        value={newFolderName}
                                        onChange={e => setNewFolderName(e.target.value)}
                                        onKeyDown={e => {
                                          if (e.key === 'Enter') createFolder(mailbox.id);
                                          if (e.key === 'Escape') { setCreatingFolder(null); setNewFolderName(''); }
                                        }}
                                        placeholder="Nom du dossier"
                                        className="flex-1 px-2 py-1 text-xs bg-slate-800 border border-slate-600 rounded text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 min-w-0"
                                        autoFocus
                                      />
                                      <button
                                        onClick={() => createFolder(mailbox.id)}
                                        className="p-1 text-cyan-400 hover:text-cyan-300 transition"
                                      >
                                        <Plus className="w-3 h-3" />
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => setCreatingFolder(mailbox.id)}
                                      className="flex items-center gap-1.5 px-2 py-1 text-xs text-slate-600 hover:text-slate-400 transition w-full"
                                    >
                                      <Plus className="w-3 h-3" />
                                      Nouveau dossier
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </nav>

      <div className="px-2 py-3 border-t border-slate-800 space-y-1">
        {!collapsed && (
          <div className="px-3 py-2 mb-1">
            <p className="text-sm font-medium text-slate-200 truncate">{userFullName || 'Utilisateur'}</p>
            <p className="text-xs text-slate-500 capitalize">{userRole || ''}</p>
          </div>
        )}
        <button
          onClick={signOut}
          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors w-full ${
            collapsed ? 'justify-center' : ''
          }`}
        >
          <LogOut className="w-5 h-5 shrink-0" />
          {!collapsed && <span>Deconnexion</span>}
        </button>
        <button
          onClick={onToggle}
          className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-500 hover:text-slate-300 transition-colors w-full ${
            collapsed ? 'justify-center' : ''
          }`}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          {!collapsed && <span className="text-xs">Reduire</span>}
        </button>
      </div>
    </aside>
  );
}
