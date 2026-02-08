import { useEffect, useState } from 'react';
import { Plus, Edit3, Trash2 } from 'lucide-react';
import Modal from '../ui/Modal';
import { supabase } from '../../lib/supabase';

interface Status {
  id: string;
  name: string;
  description: string;
  color: string;
  icon: string;
  order: number;
  is_default: boolean;
  is_active: boolean;
}

interface Priority {
  id: string;
  name: string;
  description: string;
  color: string;
  level: number;
  is_default: boolean;
  is_active: boolean;
}

export default function StatusPriorityManager() {
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [priorities, setPriorities] = useState<Priority[]>([]);
  const [statusEditOpen, setStatusEditOpen] = useState(false);
  const [priorityEditOpen, setPriorityEditOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<Status | null>(null);
  const [selectedPriority, setSelectedPriority] = useState<Priority | null>(null);

  const [statusName, setStatusName] = useState('');
  const [statusDescription, setStatusDescription] = useState('');
  const [statusColor, setStatusColor] = useState('#64748B');
  const [statusIcon, setStatusIcon] = useState('circle');
  const [statusOrder, setStatusOrder] = useState(0);
  const [statusDefault, setStatusDefault] = useState(false);

  const [priorityName, setPriorityName] = useState('');
  const [priorityDescription, setPriorityDescription] = useState('');
  const [priorityColor, setPriorityColor] = useState('#64748B');
  const [priorityLevel, setPriorityLevel] = useState(5);
  const [priorityDefault, setPriorityDefault] = useState(false);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const [statusRes, priorityRes] = await Promise.all([
      supabase.from('ticket_statuses').select('*').order('order'),
      supabase.from('ticket_priorities').select('*').order('level')
    ]);
    if (statusRes.data) setStatuses(statusRes.data);
    if (priorityRes.data) setPriorities(priorityRes.data);
  }

  function openNewStatus() {
    setSelectedStatus(null);
    setStatusName('');
    setStatusDescription('');
    setStatusColor('#64748B');
    setStatusIcon('circle');
    setStatusOrder(statuses.length + 1);
    setStatusDefault(false);
    setStatusEditOpen(true);
  }

  function openEditStatus(status: Status) {
    setSelectedStatus(status);
    setStatusName(status.name);
    setStatusDescription(status.description);
    setStatusColor(status.color);
    setStatusIcon(status.icon);
    setStatusOrder(status.order);
    setStatusDefault(status.is_default);
    setStatusEditOpen(true);
  }

  function openNewPriority() {
    setSelectedPriority(null);
    setPriorityName('');
    setPriorityDescription('');
    setPriorityColor('#64748B');
    setPriorityLevel(5);
    setPriorityDefault(false);
    setPriorityEditOpen(true);
  }

  function openEditPriority(priority: Priority) {
    setSelectedPriority(priority);
    setPriorityName(priority.name);
    setPriorityDescription(priority.description);
    setPriorityColor(priority.color);
    setPriorityLevel(priority.level);
    setPriorityDefault(priority.is_default);
    setPriorityEditOpen(true);
  }

  async function handleSaveStatus() {
    if (!statusName.trim()) return;
    const payload = {
      name: statusName,
      description: statusDescription,
      color: statusColor,
      icon: statusIcon,
      order: statusOrder,
      is_default: statusDefault
    };

    if (selectedStatus) {
      await supabase.from('ticket_statuses').update(payload).eq('id', selectedStatus.id);
    } else {
      await supabase.from('ticket_statuses').insert(payload);
    }
    setStatusEditOpen(false);
    loadData();
  }

  async function handleSavePriority() {
    if (!priorityName.trim()) return;
    const payload = {
      name: priorityName,
      description: priorityDescription,
      color: priorityColor,
      level: priorityLevel,
      is_default: priorityDefault
    };

    if (selectedPriority) {
      await supabase.from('ticket_priorities').update(payload).eq('id', selectedPriority.id);
    } else {
      await supabase.from('ticket_priorities').insert(payload);
    }
    setPriorityEditOpen(false);
    loadData();
  }

  async function handleDeleteStatus(status: Status) {
    if (!confirm(`Supprimer le statut "${status.name}" ?`)) return;
    await supabase.from('ticket_statuses').delete().eq('id', status.id);
    loadData();
  }

  async function handleDeletePriority(priority: Priority) {
    if (!confirm(`Supprimer la priorité "${priority.name}" ?`)) return;
    await supabase.from('ticket_priorities').delete().eq('id', priority.id);
    loadData();
  }

  const PRESET_COLORS = ['#0891B2', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#EC4899', '#8B5CF6', '#64748B'];
  const ICONS = ['circle', 'inbox', 'help-circle', 'user-check', 'activity', 'clock', 'mail-check', 'check-circle', 'alert-circle', 'star'];

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Statuts des tickets</h3>
            <p className="text-sm text-slate-500">Gérez les statuts disponibles pour les tickets</p>
          </div>
          <button onClick={openNewStatus} className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-medium rounded-lg transition">
            <Plus className="w-4 h-4" />
            Ajouter un statut
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {statuses.map(status => (
            <div key={status.id} className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3">
              <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: status.color }} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-slate-900">{status.name}</p>
                  {status.is_default && (
                    <span className="text-xs px-1.5 py-0.5 bg-cyan-100 text-cyan-700 rounded font-medium">Par défaut</span>
                  )}
                </div>
                {status.description && <p className="text-xs text-slate-500 truncate">{status.description}</p>}
              </div>
              <button onClick={() => openEditStatus(status)} className="p-1.5 rounded text-slate-400 hover:text-cyan-600 hover:bg-cyan-50 transition">
                <Edit3 className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => handleDeleteStatus(status)} className="p-1.5 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 transition">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Priorités des tickets</h3>
            <p className="text-sm text-slate-500">Gérez les niveaux de priorité disponibles</p>
          </div>
          <button onClick={openNewPriority} className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-medium rounded-lg transition">
            <Plus className="w-4 h-4" />
            Ajouter une priorité
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {priorities.map(priority => (
            <div key={priority.id} className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3">
              <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: priority.color }} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-slate-900">{priority.name}</p>
                  {priority.is_default && (
                    <span className="text-xs px-1.5 py-0.5 bg-cyan-100 text-cyan-700 rounded font-medium">Par défaut</span>
                  )}
                  <span className="text-xs text-slate-500">Niveau {priority.level}</span>
                </div>
                {priority.description && <p className="text-xs text-slate-500 truncate">{priority.description}</p>}
              </div>
              <button onClick={() => openEditPriority(priority)} className="p-1.5 rounded text-slate-400 hover:text-cyan-600 hover:bg-cyan-50 transition">
                <Edit3 className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => handleDeletePriority(priority)} className="p-1.5 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 transition">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      <Modal open={statusEditOpen} onClose={() => setStatusEditOpen(false)} title={selectedStatus ? 'Modifier le statut' : 'Nouveau statut'} size="sm">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Nom</label>
            <input type="text" value={statusName} onChange={e => setStatusName(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
            <input type="text" value={statusDescription} onChange={e => setStatusDescription(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Couleur</label>
            <div className="flex items-center gap-2">
              {PRESET_COLORS.map(c => (
                <button key={c} onClick={() => setStatusColor(c)}
                  className={`w-7 h-7 rounded-full border-2 transition ${statusColor === c ? 'border-slate-900 scale-110' : 'border-transparent'}`}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Ordre d'affichage</label>
            <input type="number" value={statusOrder} onChange={e => setStatusOrder(parseInt(e.target.value))}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500" />
          </div>
          <div>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={statusDefault} onChange={e => setStatusDefault(e.target.checked)}
                className="rounded border-slate-300 text-cyan-600 focus:ring-cyan-500/20" />
              <span className="text-sm text-slate-700">Statut par défaut</span>
            </label>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setStatusEditOpen(false)} className="px-4 py-2 text-sm text-slate-600">Annuler</button>
            <button onClick={handleSaveStatus} disabled={!statusName.trim()}
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-medium rounded-lg transition disabled:opacity-50">
              {selectedStatus ? 'Enregistrer' : 'Créer'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={priorityEditOpen} onClose={() => setPriorityEditOpen(false)} title={selectedPriority ? 'Modifier la priorité' : 'Nouvelle priorité'} size="sm">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Nom</label>
            <input type="text" value={priorityName} onChange={e => setPriorityName(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
            <input type="text" value={priorityDescription} onChange={e => setPriorityDescription(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Couleur</label>
            <div className="flex items-center gap-2">
              {PRESET_COLORS.map(c => (
                <button key={c} onClick={() => setPriorityColor(c)}
                  className={`w-7 h-7 rounded-full border-2 transition ${priorityColor === c ? 'border-slate-900 scale-110' : 'border-transparent'}`}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Niveau (1-10)</label>
            <input type="number" min="1" max="10" value={priorityLevel} onChange={e => setPriorityLevel(parseInt(e.target.value))}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500" />
          </div>
          <div>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={priorityDefault} onChange={e => setPriorityDefault(e.target.checked)}
                className="rounded border-slate-300 text-cyan-600 focus:ring-cyan-500/20" />
              <span className="text-sm text-slate-700">Priorité par défaut</span>
            </label>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setPriorityEditOpen(false)} className="px-4 py-2 text-sm text-slate-600">Annuler</button>
            <button onClick={handleSavePriority} disabled={!priorityName.trim()}
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-medium rounded-lg transition disabled:opacity-50">
              {selectedPriority ? 'Enregistrer' : 'Créer'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
