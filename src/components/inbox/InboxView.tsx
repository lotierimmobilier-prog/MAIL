import { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { formatDistanceToNow, format, isToday, isPast, isFuture } from 'date-fns';
import { Inbox, Mail, RefreshCw, Trash2, CheckSquare, Square, MinusSquare, Download, Loader2, PenSquare, Paperclip, Calendar } from 'lucide-react';
import Header from '../layout/Header';
import InboxFilters, { type InboxFilterState } from './InboxFilters';
import Pagination from './Pagination';
import Badge from '../ui/Badge';
import LoadingSpinner from '../ui/LoadingSpinner';
import EmptyState from '../ui/EmptyState';
import NewEmailModal from '../email/NewEmailModal';
import AiSearchBar from '../search/AiSearchBar';
import { supabase } from '../../lib/supabase';
import { getStatusConfig, getPriorityConfig } from '../../lib/constants';
import type { Ticket, Category, Mailbox } from '../../lib/types';

const DEFAULT_PAGE_SIZE = 25;

export default function InboxView() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [ticketAttachments, setTicketAttachments] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [showNewEmailModal, setShowNewEmailModal] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ msg: string; ok: boolean } | null>(null);
  const [filters, setFilters] = useState<InboxFilterState>({
    search: '',
    status: '',
    priority: '',
    mailbox_id: '',
    category_id: '',
    due_date_filter: '',
  });

  const loadData = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);

    const [ticketRes, catRes, mbRes] = await Promise.all([
      supabase
        .from('tickets')
        .select('*, category:categories(name, color), assignee:profiles!tickets_assignee_id_fkey(full_name, avatar_color), mailbox:mailboxes(name, email_address)')
        .eq('archived', false)
        .order('last_message_at', { ascending: false }),
      supabase.from('categories').select('*').order('name'),
      supabase.from('mailboxes').select('*').order('name'),
    ]);

    console.log('[InboxView] Load results:', {
      tickets: ticketRes.data?.length || 0,
      ticketsError: ticketRes.error,
      categories: catRes.data?.length || 0,
      categoriesError: catRes.error,
      mailboxes: mbRes.data?.length || 0,
      mailboxesError: mbRes.error,
    });

    if (ticketRes.data) {
      setTickets(ticketRes.data);

      const ticketIds = ticketRes.data.map(t => t.id);
      const { data: allAttachments } = await supabase
        .from('attachments')
        .select('email_id');

      if (allAttachments && allAttachments.length > 0) {
        const emailIds = allAttachments.map(a => a.email_id);
        const { data: emailsWithAttachments } = await supabase
          .from('emails')
          .select('ticket_id')
          .in('ticket_id', ticketIds)
          .in('id', emailIds);

        if (emailsWithAttachments) {
          const uniqueTicketIds = [...new Set(emailsWithAttachments.map(e => e.ticket_id).filter(Boolean))];
          setTicketAttachments(new Set(uniqueTicketIds));
        }
      } else {
        setTicketAttachments(new Set());
      }
    }
    if (catRes.data) setCategories(catRes.data);
    if (mbRes.data) setMailboxes(mbRes.data);
    setLoading(false);
    setRefreshing(false);
    setSelected(new Set());
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    const mailboxFromUrl = searchParams.get('mailbox');
    if (mailboxFromUrl !== filters.mailbox_id) {
      setFilters(prev => ({ ...prev, mailbox_id: mailboxFromUrl || '' }));
      setCurrentPage(1);
    }
  }, [searchParams]);

  const filtered = useMemo(() => {
    let result = tickets;
    if (filters.status) {
      if (filters.status === 'null') {
        result = result.filter(t => !t.status);
      } else {
        result = result.filter(t => t.status === filters.status);
      }
    }
    if (filters.priority) {
      if (filters.priority === 'null') {
        result = result.filter(t => !t.priority);
      } else {
        result = result.filter(t => t.priority === filters.priority);
      }
    }
    if (filters.mailbox_id) result = result.filter(t => t.mailbox_id === filters.mailbox_id);
    if (filters.category_id) result = result.filter(t => t.category_id === filters.category_id);

    if (filters.due_date_filter) {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      result = result.filter(t => {
        if (filters.due_date_filter === 'no_due_date') return !t.due_date;
        if (!t.due_date) return false;

        const dueDate = new Date(t.due_date);
        const dueDateOnly = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());

        if (filters.due_date_filter === 'overdue') {
          return dueDateOnly < today;
        }
        if (filters.due_date_filter === 'today') {
          return dueDateOnly.getTime() === today.getTime();
        }
        if (filters.due_date_filter === 'upcoming') {
          const sevenDaysFromNow = new Date(today);
          sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
          return dueDateOnly >= today && dueDateOnly <= sevenDaysFromNow;
        }
        return true;
      });
    }

    if (filters.search) {
      const q = filters.search.toLowerCase();
      result = result.filter(t =>
        t.subject.toLowerCase().includes(q) ||
        t.contact_email.toLowerCase().includes(q) ||
        t.contact_name.toLowerCase().includes(q)
      );
    }
    return result;
  }, [tickets, filters]);

  useEffect(() => {
    setCurrentPage(1);
    setSelected(new Set());
  }, [filters, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);

  const paginatedTickets = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, safePage, pageSize]);

  function toggleSelect(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    const pageIds = paginatedTickets.map(t => t.id);
    const allPageSelected = pageIds.length > 0 && pageIds.every(id => selected.has(id));
    if (allPageSelected) {
      setSelected(prev => {
        const next = new Set(prev);
        pageIds.forEach(id => next.delete(id));
        return next;
      });
    } else {
      setSelected(prev => {
        const next = new Set(prev);
        pageIds.forEach(id => next.add(id));
        return next;
      });
    }
  }

  async function handleBulkDelete() {
    if (selected.size === 0) return;
    const count = selected.size;
    if (!confirm(`Supprimer ${count} ticket${count > 1 ? 's' : ''} et tous les emails associes ?`)) return;

    setDeleting(true);
    const ids = Array.from(selected);

    await supabase.from('ai_classifications').delete().in('ticket_id', ids);
    await supabase.from('internal_notes').delete().in('ticket_id', ids);
    await supabase.from('ticket_tags').delete().in('ticket_id', ids);
    await supabase.from('emails').delete().in('ticket_id', ids);
    await supabase.from('tickets').delete().in('id', ids);

    setDeleting(false);
    loadData();
  }

  async function handleSyncAll() {
    setSyncing(true);
    setSyncResult(null);
    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-mailbox`;
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });
      const data = await res.json();

      if (data.results?.length) {
        const totalSynced = data.results.reduce((sum: number, r: any) => sum + (r.synced || 0), 0);
        setSyncResult({
          msg: `${totalSynced} email${totalSynced !== 1 ? 's' : ''} synchronisé${totalSynced !== 1 ? 's' : ''}`,
          ok: true
        });
        loadData();
      } else if (data.error) {
        setSyncResult({ msg: data.error, ok: false });
      }
    } catch (err: any) {
      setSyncResult({ msg: err.message || 'Erreur réseau', ok: false });
    }
    setSyncing(false);
  }

  function handlePageChange(page: number) {
    setCurrentPage(page);
    setSelected(new Set());
  }

  function handlePageSizeChange(size: number) {
    setPageSize(size);
    setCurrentPage(1);
    setSelected(new Set());
  }

  const pageIds = paginatedTickets.map(t => t.id);
  const allPageSelected = pageIds.length > 0 && pageIds.every(id => selected.has(id));
  const somePageSelected = pageIds.some(id => selected.has(id)) && !allPageSelected;

  function handleAiSearchResultClick(emailId: string) {
    const ticket = tickets.find(t => {
      return t.id === emailId;
    });
    if (ticket) {
      navigate(`/inbox/${ticket.id}`);
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header title="Inbox" subtitle={`${filtered.length} ticket${filtered.length !== 1 ? 's' : ''}`} />

      <div className="bg-slate-50 border-b border-slate-200 px-5 py-4">
        <AiSearchBar onResultClick={handleAiSearchResultClick} />
      </div>

      <div className="bg-white border-b border-slate-200 px-5 py-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {paginatedTickets.length > 0 && (
            <button
              onClick={toggleSelectAll}
              className="p-1 rounded text-slate-400 hover:text-slate-600 transition"
              title={allPageSelected ? 'Tout désélectionner' : 'Tout sélectionner'}
            >
              {allPageSelected ? (
                <CheckSquare className="w-4.5 h-4.5 text-cyan-600" />
              ) : somePageSelected ? (
                <MinusSquare className="w-4.5 h-4.5 text-cyan-600" />
              ) : (
                <Square className="w-4.5 h-4.5" />
              )}
            </button>
          )}

          {mailboxes.length > 1 && (
            <select
              value={filters.mailbox_id}
              onChange={e => setFilters({ ...filters, mailbox_id: e.target.value })}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
            >
              <option value="">Toutes les boîtes mail</option>
              {mailboxes.map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          )}

          {selected.size > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-600">
                {selected.size} sélectionné{selected.size > 1 ? 's' : ''}
              </span>
              <button
                onClick={handleBulkDelete}
                disabled={deleting}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 text-xs font-medium rounded-lg transition disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {deleting ? 'Suppression...' : 'Supprimer'}
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {syncResult && (
            <span className={`text-xs font-medium ${syncResult.ok ? 'text-emerald-600' : 'text-red-500'}`}>
              {syncResult.msg}
            </span>
          )}
          <button
            onClick={() => setShowNewEmailModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition"
          >
            <PenSquare className="w-3.5 h-3.5" />
            Nouveau message
          </button>
          <button
            onClick={handleSyncAll}
            disabled={syncing}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-cyan-600 hover:bg-cyan-700 rounded-lg transition disabled:opacity-50"
          >
            {syncing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            {syncing ? 'Synchronisation...' : 'Synchroniser'}
          </button>
          <button
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-cyan-700 hover:bg-cyan-50 rounded-lg transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Actualiser
          </button>
        </div>
      </div>

      <InboxFilters filters={filters} onChange={setFilters} categories={categories} mailboxes={mailboxes} />

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <LoadingSpinner />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={tickets.length === 0 ? Inbox : Mail}
            title={tickets.length === 0 ? 'Aucun ticket' : 'Aucun résultat'}
            description={
              tickets.length === 0
                ? 'Les tickets apparaîtront ici lorsque les emails seront reçus.'
                : 'Essayez de modifier vos filtres.'
            }
          />
        ) : (
          <div className="divide-y divide-slate-100">
            {paginatedTickets.map(ticket => {
              const statusCfg = getStatusConfig(ticket.status);
              const priorityCfg = getPriorityConfig(ticket.priority);
              const mailbox = ticket.mailbox as { name: string; email_address: string } | undefined;
              const category = ticket.category as { name: string; color: string } | undefined;
              const assignee = ticket.assignee as { full_name: string; avatar_color: string } | undefined;
              const isSelected = selected.has(ticket.id);
              const isUnread = !ticket.is_read;

              return (
                <div
                  key={ticket.id}
                  onClick={() => navigate(`/inbox/${ticket.id}`)}
                  className={`flex items-center gap-3 px-5 py-4 cursor-pointer transition group ${
                    isSelected ? 'bg-cyan-50/60' : 'bg-white hover:bg-slate-50'
                  }`}
                >
                  <button
                    onClick={e => toggleSelect(ticket.id, e)}
                    className="p-0.5 rounded text-slate-400 hover:text-cyan-600 transition shrink-0"
                  >
                    {isSelected ? (
                      <CheckSquare className="w-4 h-4 text-cyan-600" />
                    ) : (
                      <Square className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                    )}
                  </button>

                  {assignee ? (
                    <div
                      className="w-2.5 h-2.5 rounded shrink-0"
                      style={{ backgroundColor: assignee.avatar_color || '#0891B2' }}
                      title={`Assigné à ${assignee.full_name}`}
                    />
                  ) : (
                    <div
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: statusCfg.color }}
                    />
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`text-sm text-slate-900 truncate group-hover:text-cyan-700 transition ${isUnread ? 'font-bold' : 'font-semibold'}`}>
                        {ticket.subject}
                      </p>
                      {ticketAttachments.has(ticket.id) && (
                        <Paperclip className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      )}
                      {ticket.priority === 'urgent' && (
                        <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                      <span className="font-medium text-slate-700">
                        {ticket.contact_name || ticket.contact_email}
                      </span>
                      {mailbox && (
                        <>
                          <span className="text-slate-300">|</span>
                          <span>{mailbox.name}</span>
                        </>
                      )}
                      {assignee && (
                        <>
                          <span className="text-slate-300">|</span>
                          <span>Assigné : {assignee.full_name}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {category && <Badge label={category.name} color={category.color} />}
                    {ticket.priority && <Badge label={priorityCfg.label} color={priorityCfg.color} />}
                    {ticket.status && <Badge label={statusCfg.label} color={statusCfg.color} />}
                    {ticket.due_date && (() => {
                      const dueDate = new Date(ticket.due_date);
                      const dueDateStr = format(dueDate, 'dd/MM');
                      let dueBadgeColor = '#64748B';
                      let dueBadgeLabel = dueDateStr;

                      if (isPast(dueDate) && !isToday(dueDate)) {
                        dueBadgeColor = '#EF4444';
                        dueBadgeLabel = `En retard (${dueDateStr})`;
                      } else if (isToday(dueDate)) {
                        dueBadgeColor = '#F59E0B';
                        dueBadgeLabel = `Aujourd'hui`;
                      } else if (isFuture(dueDate)) {
                        dueBadgeColor = '#10B981';
                        dueBadgeLabel = `Échéance ${dueDateStr}`;
                      }

                      return (
                        <div className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: `${dueBadgeColor}15`, color: dueBadgeColor }}>
                          <Calendar className="w-3 h-3" />
                          {dueBadgeLabel}
                        </div>
                      );
                    })()}
                    <span className="text-xs text-slate-400 w-20 text-right">
                      {formatDistanceToNow(new Date(ticket.last_message_at), { addSuffix: true })}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {filtered.length > 0 && (
        <Pagination
          currentPage={safePage}
          totalItems={filtered.length}
          pageSize={pageSize}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
        />
      )}

      {showNewEmailModal && (
        <NewEmailModal
          onClose={() => setShowNewEmailModal(false)}
          onSent={() => {
            setShowNewEmailModal(false);
            loadData();
          }}
        />
      )}
    </div>
  );
}
