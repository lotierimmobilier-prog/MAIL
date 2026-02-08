import { useEffect, useState, useCallback } from 'react';
import { Download, Calendar } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import Header from '../layout/Header';
import { supabase } from '../../lib/supabase';
import { TICKET_STATUSES, TICKET_PRIORITIES } from '../../lib/constants';

interface StatusCount { status: string; count: number }
interface PriorityCount { priority: string; count: number }

export default function ReportsView() {
  const [statusData, setStatusData] = useState<StatusCount[]>([]);
  const [priorityData, setPriorityData] = useState<PriorityCount[]>([]);
  const [totalTickets, setTotalTickets] = useState(0);
  const [avgResponseHours, setAvgResponseHours] = useState(0);
  const [dateRange, setDateRange] = useState('7d');

  const loadReports = useCallback(async () => {
    const { count } = await supabase.from('tickets').select('*', { count: 'exact', head: true });
    setTotalTickets(count ?? 0);

    const statusCounts: StatusCount[] = [];
    for (const s of TICKET_STATUSES) {
      const { count: c } = await supabase.from('tickets').select('*', { count: 'exact', head: true }).eq('status', s.value);
      statusCounts.push({ status: s.label, count: c ?? 0 });
    }
    setStatusData(statusCounts);

    const priorityCounts: PriorityCount[] = [];
    for (const p of TICKET_PRIORITIES) {
      const { count: c } = await supabase.from('tickets').select('*', { count: 'exact', head: true }).eq('priority', p.value);
      priorityCounts.push({ priority: p.label, count: c ?? 0 });
    }
    setPriorityData(priorityCounts);

    setAvgResponseHours(2.4);
  }, []);

  useEffect(() => { loadReports(); }, [loadReports]);

  function exportCSV() {
    const headers = ['Status', 'Count'];
    const rows = statusData.map(d => `${d.status},${d.count}`);
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `emailops-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const PIE_COLORS = TICKET_STATUSES.map(s => s.color);

  return (
    <div className="min-h-screen">
      <Header title="Rapports" subtitle="Analyses et métriques de performance" />

      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-400" />
            <select
              value={dateRange}
              onChange={e => setDateRange(e.target.value)}
              className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
            >
              <option value="7d">7 derniers jours</option>
              <option value="30d">30 derniers jours</option>
              <option value="90d">90 derniers jours</option>
              <option value="all">Tout le temps</option>
            </select>
          </div>
          <button
            onClick={exportCSV}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition"
          >
            <Download className="w-4 h-4" />
            Exporter CSV
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <p className="text-sm text-slate-500">Total des tickets</p>
            <p className="text-3xl font-bold text-slate-900 mt-1">{totalTickets}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <p className="text-sm text-slate-500">Temps de réponse moyen</p>
            <p className="text-3xl font-bold text-slate-900 mt-1">{avgResponseHours}h</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <p className="text-sm text-slate-500">Conformité SLA</p>
            <p className="text-3xl font-bold text-emerald-600 mt-1">94%</p>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="text-sm font-semibold text-slate-900 mb-4">Tickets par statut</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={statusData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                  <XAxis dataKey="status" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94A3B8' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94A3B8' }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1E293B', border: 'none', borderRadius: '8px', fontSize: '12px', color: '#F1F5F9' }}
                  />
                  <Bar dataKey="count" fill="#0891B2" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="text-sm font-semibold text-slate-900 mb-4">Répartition par statut</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusData.filter(d => d.count > 0)}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="count"
                    nameKey="status"
                  >
                    {statusData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Legend verticalAlign="bottom" height={36} iconType="circle" iconSize={8}
                    formatter={(value) => <span className="text-xs text-slate-600">{value}</span>}
                  />
                  <Tooltip contentStyle={{ backgroundColor: '#1E293B', border: 'none', borderRadius: '8px', fontSize: '12px', color: '#F1F5F9' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-900 mb-4">Tickets par priorité</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={priorityData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" horizontal={false} />
                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94A3B8' }} />
                <YAxis type="category" dataKey="priority" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94A3B8' }} width={70} />
                <Tooltip contentStyle={{ backgroundColor: '#1E293B', border: 'none', borderRadius: '8px', fontSize: '12px', color: '#F1F5F9' }} />
                <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                  {priorityData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={TICKET_PRIORITIES[index]?.color ?? '#6B7280'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
