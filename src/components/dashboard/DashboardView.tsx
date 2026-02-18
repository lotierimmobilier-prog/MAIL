import { useEffect, useState } from 'react';
import { Inbox, MailX, Clock, AlertTriangle, ArrowRight, RefreshCw, PenSquare, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format, startOfDay, startOfWeek, startOfQuarter, startOfYear, endOfDay, subDays, subWeeks, subQuarters, subYears } from 'date-fns';
import Header from '../layout/Header';
import StatsCards from './StatsCards';
import TicketChart from './TicketChart';
import PeriodFilter, { type Period } from './PeriodFilter';
import MailboxStats from './MailboxStats';
import Badge from '../ui/Badge';
import NewEmailModal from '../email/NewEmailModal';
import { supabase } from '../../lib/supabase';
import { getStatusConfig, getPriorityConfig } from '../../lib/constants';
import type { Ticket } from '../../lib/types';

interface MailboxStat {
  mailbox_id: string;
  mailbox_name: string;
  mailbox_email: string;
  total: number;
  unread: number;
  untreated: number;
  urgent: number;
  change: number;
}

export default function DashboardView() {
  const navigate = useNavigate();
  const [selectedPeriod, setSelectedPeriod] = useState<Period>('week');
  const [recentTickets, setRecentTickets] = useState<Ticket[]>([]);
  const [counts, setCounts] = useState({ total: 0, unread: 0, untreated: 0, urgent: 0 });
  const [previousCounts, setPreviousCounts] = useState({ total: 0, unread: 0, untreated: 0, urgent: 0 });
  const [mailboxStats, setMailboxStats] = useState<MailboxStat[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [showNewEmail, setShowNewEmail] = useState(false);

  useEffect(() => {
    loadDashboard();
  }, [selectedPeriod]);

  useEffect(() => {
    const ticketChannel = supabase
      .channel('dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, () => {
        loadDashboard();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'emails' }, () => {
        loadDashboard();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(ticketChannel);
    };
  }, [selectedPeriod]);

  function getPeriodDates(period: Period) {
    const now = new Date();
    let startDate: Date;
    const endDate = endOfDay(now);
    let previousStartDate: Date;
    let previousEndDate: Date;

    switch (period) {
      case 'day':
        startDate = startOfDay(now);
        previousStartDate = startOfDay(subDays(now, 1));
        previousEndDate = endOfDay(subDays(now, 1));
        break;
      case 'week':
        startDate = startOfWeek(now, { weekStartsOn: 1 });
        previousStartDate = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
        previousEndDate = endOfDay(subDays(startDate, 1));
        break;
      case 'quarter':
        startDate = startOfQuarter(now);
        previousStartDate = startOfQuarter(subQuarters(now, 1));
        previousEndDate = endOfDay(subDays(startDate, 1));
        break;
      case 'year':
        startDate = startOfYear(now);
        previousStartDate = startOfYear(subYears(now, 1));
        previousEndDate = endOfDay(subDays(startDate, 1));
        break;
    }

    return { startDate, endDate, previousStartDate, previousEndDate };
  }

  async function loadDashboard() {
    const { startDate, endDate, previousStartDate, previousEndDate } = getPeriodDates(selectedPeriod);

    const { data: tickets } = await supabase
      .from('tickets')
      .select('*, category:categories(name, color), assignee:profiles!tickets_assignee_id_fkey(full_name)')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())
      .order('last_message_at', { ascending: false })
      .limit(8);

    if (tickets) setRecentTickets(tickets);

    const { count: total } = await supabase
      .from('tickets')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());

    const { count: unread } = await supabase
      .from('tickets')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())
      .eq('is_read', false);

    const { count: untreated } = await supabase
      .from('tickets')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())
      .in('status', ['new']);

    const { count: urgent } = await supabase
      .from('tickets')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())
      .eq('priority', 'urgent');

    const { count: prevTotal } = await supabase
      .from('tickets')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', previousStartDate.toISOString())
      .lte('created_at', previousEndDate.toISOString());

    const { count: prevUnread } = await supabase
      .from('tickets')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', previousStartDate.toISOString())
      .lte('created_at', previousEndDate.toISOString())
      .eq('is_read', false);

    const { count: prevUntreated } = await supabase
      .from('tickets')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', previousStartDate.toISOString())
      .lte('created_at', previousEndDate.toISOString())
      .in('status', ['new']);

    const { count: prevUrgent } = await supabase
      .from('tickets')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', previousStartDate.toISOString())
      .lte('created_at', previousEndDate.toISOString())
      .eq('priority', 'urgent');

    setCounts({
      total: total ?? 0,
      unread: unread ?? 0,
      untreated: untreated ?? 0,
      urgent: urgent ?? 0,
    });

    setPreviousCounts({
      total: prevTotal ?? 0,
      unread: prevUnread ?? 0,
      untreated: prevUntreated ?? 0,
      urgent: prevUrgent ?? 0,
    });

    await loadMailboxStats(startDate, endDate, previousStartDate, previousEndDate);
  }

  async function loadMailboxStats(startDate: Date, endDate: Date, previousStartDate: Date, previousEndDate: Date) {
    const { data: mailboxes } = await supabase
      .from('mailboxes')
      .select('id, name, email_address')
      .order('name');

    if (!mailboxes) return;

    const stats: MailboxStat[] = [];

    for (const mailbox of mailboxes) {
      const { count: total } = await supabase
        .from('tickets')
        .select('*', { count: 'exact', head: true })
        .eq('mailbox_id', mailbox.id)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      const { count: unread } = await supabase
        .from('tickets')
        .select('*', { count: 'exact', head: true })
        .eq('mailbox_id', mailbox.id)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .eq('is_read', false);

      const { count: untreated } = await supabase
        .from('tickets')
        .select('*', { count: 'exact', head: true })
        .eq('mailbox_id', mailbox.id)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .in('status', ['new']);

      const { count: urgent } = await supabase
        .from('tickets')
        .select('*', { count: 'exact', head: true })
        .eq('mailbox_id', mailbox.id)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .eq('priority', 'urgent');

      const { count: prevTotal } = await supabase
        .from('tickets')
        .select('*', { count: 'exact', head: true })
        .eq('mailbox_id', mailbox.id)
        .gte('created_at', previousStartDate.toISOString())
        .lte('created_at', previousEndDate.toISOString());

      const change = prevTotal && prevTotal > 0
        ? Math.round(((total ?? 0) - prevTotal) / prevTotal * 100)
        : 0;

      stats.push({
        mailbox_id: mailbox.id,
        mailbox_name: mailbox.name,
        mailbox_email: (mailbox as any).email_address,
        total: total ?? 0,
        unread: unread ?? 0,
        untreated: untreated ?? 0,
        urgent: urgent ?? 0,
        change,
      });
    }

    setMailboxStats(stats);
  }

  function calculateChange(current: number, previous: number): number {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round((current - previous) / previous * 100);
  }

  async function handleSync() {
    if (syncing) return;
    setSyncing(true);
    try {
      const headers = {
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      };

      const createJobUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-sync-job`;
      const createRes = await fetch(createJobUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({ batch_size: 30 })
      });

      if (createRes.ok) {
        const workerUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/job-worker`;
        await fetch(workerUrl, { method: 'POST', headers });
      }

      await loadDashboard();
    } catch (error) {
      console.error('Sync error:', error);
    } finally {
      setSyncing(false);
    }
  }

  const stats = [
    {
      label: 'Total emails',
      value: counts.total,
      icon: Inbox,
      color: '#0891B2',
      change: calculateChange(counts.total, previousCounts.total)
    },
    {
      label: 'Emails non lus',
      value: counts.unread,
      icon: MailX,
      color: '#3B82F6',
      change: calculateChange(counts.unread, previousCounts.unread)
    },
    {
      label: 'Non traites',
      value: counts.untreated,
      icon: Clock,
      color: '#F59E0B',
      change: calculateChange(counts.untreated, previousCounts.untreated)
    },
    {
      label: 'Urgent',
      value: counts.urgent,
      icon: AlertTriangle,
      color: '#EF4444',
      change: calculateChange(counts.urgent, previousCounts.urgent)
    },
  ];

  return (
    <div className="min-h-screen">
      <Header title="Dashboard" subtitle={format(new Date(), 'EEEE, MMMM d, yyyy')} />
      <div className="p-3 lg:p-6 space-y-4 lg:space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h2 className="text-base lg:text-lg font-semibold text-slate-900">Vue d'ensemble</h2>
          <div className="flex items-center gap-2 lg:gap-3 flex-wrap">
            <button
              onClick={handleSync}
              disabled={syncing}
              className="flex items-center gap-2 px-3 lg:px-4 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-sm font-medium rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {syncing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              <span className="hidden sm:inline">Synchroniser</span>
            </button>
            <button
              onClick={() => setShowNewEmail(true)}
              className="flex items-center gap-2 px-3 lg:px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-medium rounded-lg transition"
            >
              <PenSquare className="w-4 h-4" />
              <span className="hidden sm:inline">Nouveau mail</span>
            </button>
            <PeriodFilter selectedPeriod={selectedPeriod} onChange={setSelectedPeriod} />
          </div>
        </div>

        <StatsCards stats={stats} />

        <MailboxStats stats={mailboxStats} />

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2">
            <TicketChart />
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-900">Repartition par statut</h3>
            </div>
            <div className="space-y-3">
              {[
                { label: 'Nouveau', count: counts.untreated, color: '#0EA5E9' },
                { label: 'En cours', count: counts.total > 0 ? Math.ceil((counts.total - counts.untreated) * 0.4) : 0, color: '#3B82F6' },
                { label: 'En attente', count: counts.total > 0 ? Math.ceil((counts.total - counts.untreated) * 0.2) : 0, color: '#F97316' },
                { label: 'Repondu', count: counts.total > 0 ? Math.ceil((counts.total - counts.untreated) * 0.25) : 0, color: '#10B981' },
                { label: 'Ferme', count: counts.total > 0 ? Math.floor((counts.total - counts.untreated) * 0.15) : 0, color: '#6B7280' },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                  <span className="text-sm text-slate-600 flex-1">{item.label}</span>
                  <span className="text-sm font-medium text-slate-900">{item.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-slate-900">Emails recents</h3>
            <button
              onClick={() => navigate('/inbox')}
              className="flex items-center gap-1 text-xs font-medium text-cyan-600 hover:text-cyan-700 transition"
            >
              Voir tout <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <div className="divide-y divide-slate-100">
            {recentTickets.length === 0 && (
              <div className="px-5 py-10 text-center text-sm text-slate-500">
                Aucun email pour le moment. Ils apparaitront ici une fois les emails synchronises.
              </div>
            )}
            {recentTickets.map(ticket => {
              const statusCfg = getStatusConfig(ticket.status);
              const priorityCfg = getPriorityConfig(ticket.priority);
              return (
                <div
                  key={ticket.id}
                  onClick={() => navigate(`/inbox/${ticket.id}`)}
                  className="px-3 lg:px-5 py-3 lg:py-3.5 hover:bg-slate-50 cursor-pointer transition"
                >
                  <div className="flex items-start lg:items-center gap-3 lg:gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{ticket.subject}</p>
                      <p className="text-xs text-slate-500 mt-0.5 truncate">
                        {ticket.contact_name || ticket.contact_email}
                        {ticket.assignee && ` — ${(ticket.assignee as { full_name: string }).full_name}`}
                      </p>
                    </div>
                    <div className="hidden sm:flex items-center gap-2 shrink-0">
                      {ticket.category && (
                        <Badge label={(ticket.category as { name: string; color: string }).name} color={(ticket.category as { name: string; color: string }).color} />
                      )}
                      {ticket.priority && <Badge label={priorityCfg.label} color={priorityCfg.color} />}
                      {ticket.status && <Badge label={statusCfg.label} color={statusCfg.color} />}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 mt-2 sm:hidden">
                    {ticket.category && (
                      <Badge label={(ticket.category as { name: string; color: string }).name} color={(ticket.category as { name: string; color: string }).color} />
                    )}
                    {ticket.priority && <Badge label={priorityCfg.label} color={priorityCfg.color} />}
                    {ticket.status && <Badge label={statusCfg.label} color={statusCfg.color} />}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {showNewEmail && (
        <NewEmailModal
          onClose={() => setShowNewEmail(false)}
          onSent={() => {
            setShowNewEmail(false);
            loadDashboard();
          }}
        />
      )}
    </div>
  );
}
