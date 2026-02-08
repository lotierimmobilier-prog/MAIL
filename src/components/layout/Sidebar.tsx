import { NavLink, useSearchParams } from 'react-router-dom';
import {
  Mail, LayoutDashboard, Inbox, FileText, Settings, BarChart3, BookOpen,
  LogOut, ChevronLeft, ChevronRight, ChevronDown,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import type { Mailbox } from '../../lib/types';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Tableau de bord' },
  { to: '/inbox', icon: Inbox, label: 'Boîte de réception' },
  { to: '/templates', icon: FileText, label: 'Modèles' },
  { to: '/knowledge', icon: BookOpen, label: 'Base de connaissances' },
  { to: '/reports', icon: BarChart3, label: 'Rapports' },
  { to: '/admin', icon: Settings, label: 'Admin' },
];

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const { signOut } = useAuth();
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [showMailboxes, setShowMailboxes] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    loadMailboxes();
  }, []);

  async function loadMailboxes() {
    const { data } = await supabase
      .from('mailboxes')
      .select('*')
      .eq('is_active', true)
      .order('name');
    if (data) {
      setMailboxes(data);
    }
  }

  function selectMailbox(mailboxId: string | null) {
    const newParams = new URLSearchParams(searchParams);
    if (mailboxId) {
      newParams.set('mailbox', mailboxId);
    } else {
      newParams.delete('mailbox');
    }
    setSearchParams(newParams);
    setShowMailboxes(false);
  }

  return (
    <aside
      className={`fixed top-0 left-0 h-screen bg-slate-900 text-white flex flex-col z-30 transition-all duration-300 ${
        collapsed ? 'w-16' : 'w-60'
      }`}
    >
      <div className="flex items-center gap-3 px-4 h-16 border-b border-slate-800 shrink-0">
        <div className="w-8 h-8 rounded-lg bg-cyan-500 flex items-center justify-center shrink-0">
          <Mail className="w-4 h-4 text-white" />
        </div>
        {!collapsed && <span className="font-bold text-lg tracking-tight">EmailOps</span>}
      </div>

      <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
        {navItems.map((item, index) => (
          <div key={item.to}>
            <NavLink
              to={item.to}
              end={item.to === '/'}
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
                  <span>Boîtes mail</span>
                </button>

                {showMailboxes && (
                  <div className="space-y-0.5 pl-3">
                    <button
                      onClick={() => selectMailbox(null)}
                      className={`block w-full text-left px-3 py-1.5 text-xs rounded transition ${
                        !searchParams.get('mailbox')
                          ? 'bg-cyan-500/10 text-cyan-400'
                          : 'text-slate-400 hover:text-white hover:bg-slate-800'
                      }`}
                    >
                      Toutes les boîtes
                    </button>
                    {mailboxes.map(mailbox => (
                      <button
                        key={mailbox.id}
                        onClick={() => selectMailbox(mailbox.id)}
                        className={`block w-full text-left px-3 py-1.5 text-xs rounded transition truncate ${
                          searchParams.get('mailbox') === mailbox.id
                            ? 'bg-cyan-500/10 text-cyan-400'
                            : 'text-slate-400 hover:text-white hover:bg-slate-800'
                        }`}
                        title={mailbox.name}
                      >
                        {mailbox.name}
                      </button>
                    ))}
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
            <p className="text-sm font-medium text-slate-200 truncate">Administrateur</p>
            <p className="text-xs text-slate-500">Admin</p>
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
          {!collapsed && <span className="text-xs">Réduire</span>}
        </button>
      </div>
    </aside>
  );
}
