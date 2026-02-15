import { useState } from 'react';
import { Server, Users, FolderOpen, Shield, Settings, Activity, Tag, Lock } from 'lucide-react';
import Header from '../layout/Header';
import MailboxManager from './MailboxManager';
import UserManager from './UserManager';
import CategoryManager from './CategoryManager';
import StatusPriorityManager from './StatusPriorityManager';
import AuditLogViewer from './AuditLogViewer';
import SettingsManager from './SettingsManager';
import MailboxDiagnostics from './MailboxDiagnostics';
import SecurityManager from './SecurityManager';
import { useAuth } from '../../contexts/AuthContext';

const tabs = [
  { id: 'mailboxes', label: 'Boîtes mail', icon: Server },
  { id: 'diagnostics', label: 'Diagnostics', icon: Activity },
  { id: 'users', label: 'Utilisateurs', icon: Users },
  { id: 'categories', label: 'Catégories', icon: FolderOpen },
  { id: 'status-priority', label: 'Statuts & Priorités', icon: Tag },
  { id: 'security', label: 'Sécurité', icon: Lock, adminOnly: true },
  { id: 'settings', label: 'Paramètres', icon: Settings, adminOnly: true },
  { id: 'audit', label: 'Journal d\'audit', icon: Shield, adminOnly: true },
];

export default function AdminView() {
  const { isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState('mailboxes');

  const visibleTabs = tabs.filter(t => !t.adminOnly || isAdmin);

  return (
    <div className="min-h-screen">
      <Header title="Administration" subtitle="Configuration et gestion du système" />

      <div className="px-6 pt-4">
        <div className="flex gap-1 border-b border-slate-200 mb-6">
          {visibleTabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition ${
                activeTab === tab.id
                  ? 'border-cyan-500 text-cyan-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-6 pb-6">
        {activeTab === 'mailboxes' && <MailboxManager />}
        {activeTab === 'diagnostics' && <MailboxDiagnostics />}
        {activeTab === 'users' && <UserManager />}
        {activeTab === 'categories' && <CategoryManager />}
        {activeTab === 'status-priority' && <StatusPriorityManager />}
        {activeTab === 'security' && isAdmin && <SecurityManager />}
        {activeTab === 'settings' && isAdmin && <SettingsManager />}
        {activeTab === 'audit' && isAdmin && <AuditLogViewer />}
      </div>
    </div>
  );
}
