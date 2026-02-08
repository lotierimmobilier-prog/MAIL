import { Search, Filter, X } from 'lucide-react';
import type { TicketStatus, TicketPriority, Category, Mailbox } from '../../lib/types';
import { TICKET_STATUSES, TICKET_PRIORITIES } from '../../lib/constants';

export interface InboxFilterState {
  search: string;
  status: TicketStatus | '';
  priority: TicketPriority | '';
  mailbox_id: string;
  category_id: string;
  due_date_filter: string;
}

interface InboxFiltersProps {
  filters: InboxFilterState;
  onChange: (filters: InboxFilterState) => void;
  categories: Category[];
  mailboxes: Mailbox[];
}

export default function InboxFilters({ filters, onChange, categories, mailboxes }: InboxFiltersProps) {
  const hasActiveFilters = filters.status || filters.priority || filters.mailbox_id || filters.category_id || filters.due_date_filter;

  const clearFilters = () => {
    onChange({ search: filters.search, status: '', priority: '', mailbox_id: '', category_id: '', due_date_filter: '' });
  };

  return (
    <div className="bg-white border-b border-slate-200 px-5 py-3 space-y-3">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Rechercher par sujet, expéditeur ou mot-clé..."
            value={filters.search}
            onChange={e => onChange({ ...filters, search: e.target.value })}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition"
          />
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <Filter className="w-3.5 h-3.5" />
          <span>Filtres</span>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <select
          value={filters.status}
          onChange={e => onChange({ ...filters, status: e.target.value as TicketStatus | '' })}
          className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
        >
          <option value="">Tous les statuts</option>
          <option value="null">Sans statut</option>
          {TICKET_STATUSES.map(s => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>

        <select
          value={filters.priority}
          onChange={e => onChange({ ...filters, priority: e.target.value as TicketPriority | '' })}
          className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
        >
          <option value="">Toutes les priorités</option>
          <option value="null">Sans priorité</option>
          {TICKET_PRIORITIES.map(p => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>

        {mailboxes.length > 0 && (
          <select
            value={filters.mailbox_id}
            onChange={e => onChange({ ...filters, mailbox_id: e.target.value })}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
          >
            <option value="">Toutes les boîtes mail</option>
            {[...mailboxes].sort((a, b) => a.name.localeCompare(b.name)).map(m => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        )}

        {categories.length > 0 && (
          <select
            value={filters.category_id}
            onChange={e => onChange({ ...filters, category_id: e.target.value })}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
          >
            <option value="">Toutes les catégories</option>
            {categories.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        )}

        <select
          value={filters.due_date_filter}
          onChange={e => onChange({ ...filters, due_date_filter: e.target.value })}
          className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
        >
          <option value="">Toutes les échéances</option>
          <option value="overdue">En retard</option>
          <option value="today">Aujourd'hui</option>
          <option value="upcoming">À venir (7 jours)</option>
          <option value="no_due_date">Sans échéance</option>
        </select>

        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1 px-2 py-1.5 text-xs text-red-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
          >
            <X className="w-3 h-3" />
            Effacer
          </button>
        )}
      </div>
    </div>
  );
}
