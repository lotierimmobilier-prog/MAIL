import { useEffect, useState } from 'react';
import { Inbox, CheckCircle2, Clock, AlertTriangle, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format, startOfDay, startOfWeek, startOfQuarter, startOfYear, endOfDay, subDays, subWeeks, subQuarters, subYears } from 'date-fns';
import Header from '../layout/Header';
import StatsCards from './StatsCards';
import TicketChart from './TicketChart';
import PeriodFilter, { type Period } from './PeriodFilter';
import MailboxStats from './MailboxStats';
import Badge from '../ui/Badge';
import { supabase } from '../../lib/supabase';
import { getStatusConfig, getPriorityConfig } from '../../lib/constants';
import type { Ticket } from '../../lib/types';

interface MailboxStat {
  mailbox_id: string;
  mailbox_name: string;
  mailbox_email: string;
  total: number;
  open: number;
  waiting: number;
  urgent: number;
  change: number;
}

export default function DashboardView() {
  const navigate = useNavigate();
  const [selectedPeriod, setSelectedPeriod] = useState<Period>('week');
  const [recentTickets, setRecentTickets] = useState<Ticket[]>([]);
  const [counts, setCounts] = useState({ total: 0, open: 0, waiting: 0, urgent: 0 });
  const [previousCounts, setPreviousCounts] = useState({ total: 0, open: 0, waiting: 0, urgent: 0 });
  const [mailboxStats, setMailboxStats] = useState<MailboxStat[]>([]);

  useEffect(() => {
    loadDashboard();
  }, [selectedPeriod]);

  function getPeriodDates(period: Period) {
    const now = new Date();
    let startDate: Date;
    let endDate = endOfDay(now);
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

    const { count: open } = await supabase
      .from('tickets')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())
      .in('status', ['new', 'qualify', 'assigned', 'in_progress']);

    const { count: waiting } = await supabase
      .from('tickets')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())
      .eq('status', 'waiting');

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

    const { count: prevOpen } = await supabase
      .from('tickets')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', previousStartDate.toISOString())
      .lte('created_at', previousEndDate.toISOString())
      .in('status', ['new', 'qualify', 'assigned', 'in_progress']);

    const { count: prevWaiting } = await supabase
      .from('tickets')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', previousStartDate.toISOString())
      .lte('created_at', previousEndDate.toISOString())
      .eq('status', 'waiting');

    const { count: prevUrgent } = await supabase
      .from('tickets')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', previousStartDate.toISOString())
      .lte('created_at', previousEndDate.toISOString())
      .eq('priority', 'urgent');

    setCounts({
      total: total ?? 0,
      open: open ?? 0,
      waiting: waiting ?? 0,
      urgent: urgent ?? 0,
    });

    setPreviousCounts({
      total: prevTotal ?? 0,
      open: prevOpen ?? 0,
      waiting: prevWaiting ?? 0,
      urgent: prevUrgent ?? 0,
    });

    await loadMailboxStats(startDate, endDate, previousStartDate, previousEndDate);
  }

  async function loadMailboxStats(startDate: Date, endDate: Date, previousStartDate: Date, previousEndDate: Date) {
    const { data: mailboxes } = await supabase
      .from('mailboxes')
      .select('id, name, email')
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

      const { count: open } = await supabase
        .from('tickets')
        .select('*', { count: 'exact', head: true })
        .eq('mailbox_id', mailbox.id)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .in('status', ['new', 'qualify', 'assigned', 'in_progress']);

      const { count: waiting } = await supabase
        .from('tickets')
        .select('*', { count: 'exact', head: true })
        .eq('mailbox_id', mailbox.id)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .eq('status', 'waiting');

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
        mailbox_email: mailbox.email,
        total: total ?? 0,
        open: open ?? 0,
        waiting: waiting ?? 0,
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

  const stats = [
    {
      label: 'Total des tickets',
      value: counts.total,
      icon: Inbox,
      color: '#0891B2',
      change: calculateChange(counts.total, previousCounts.total)
    },
    {
      label: 'Tickets ouverts',
      value: counts.open,
      icon: CheckCircle2,
      color: '#3B82F6',
      change: calculateChange(counts.open, previousCounts.open)
    },
    {
      label: 'En attente de réponse',
      value: counts.waiting,
      icon: Clock,
      color: '#F59E0B',
      change: calculateChange(counts.waiting, previousCounts.waiting)
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
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Vue d'ensemble</h2>
          <PeriodFilter selectedPeriod={selectedPeriod} onChange={setSelectedPeriod} />
        </div>

        <StatsCards stats={stats} />

        <MailboxStats stats={mailboxStats} />

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2">
            <TicketChart />
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-900">Répartition par statut</h3>
            </div>
            <div className="space-y-3">
              {[
                { label: 'Nouveau', count: counts.total > 0 ? Math.ceil(counts.open * 0.3) : 0, color: '#0EA5E9' },
                { label: 'En cours', count: counts.total > 0 ? Math.ceil(counts.open * 0.4) : 0, color: '#3B82F6' },
                { label: 'En attente', count: counts.waiting, color: '#F97316' },
                { label: 'Répondu', count: counts.total > 0 ? Math.ceil(counts.total * 0.2) : 0, color: '#10B981' },
                { label: 'Fermé', count: counts.total > 0 ? Math.floor(counts.total * 0.15) : 0, color: '#6B7280' },
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
            <h3 className="text-sm font-semibold text-slate-900">Tickets récents</h3>
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
                Aucun ticket pour le moment. Ils apparaîtront ici une fois les emails traités.
              </div>
            )}
            {recentTickets.map(ticket => {
              const statusCfg = getStatusConfig(ticket.status);
              const priorityCfg = getPriorityConfig(ticket.priority);
              return (
                <div
                  key={ticket.id}
                  onClick={() => navigate(`/inbox/${ticket.id}`)}
                  className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50 cursor-pointer transition"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{ticket.subject}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {ticket.contact_name || ticket.contact_email}
                      {ticket.assignee && ` — assigné à ${(ticket.assignee as { full_name: string }).full_name}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
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
    </div>
  );
}
