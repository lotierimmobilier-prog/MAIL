import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const data = [
  { date: 'Mon', tickets: 24, resolved: 18 },
  { date: 'Tue', tickets: 31, resolved: 25 },
  { date: 'Wed', tickets: 28, resolved: 22 },
  { date: 'Thu', tickets: 35, resolved: 30 },
  { date: 'Fri', tickets: 42, resolved: 35 },
  { date: 'Sat', tickets: 15, resolved: 14 },
  { date: 'Sun', tickets: 12, resolved: 10 },
];

export default function TicketChart() {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Volume de tickets</h3>
          <p className="text-xs text-slate-500 mt-0.5">Nouveaux vs résolus cette semaine</p>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-cyan-500" />
            <span className="text-slate-500">Nouveaux</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span className="text-slate-500">Résolus</span>
          </div>
        </div>
      </div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%" minWidth={300} minHeight={200}>
          <AreaChart data={data}>
            <defs>
              <linearGradient id="ticketGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#0891B2" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#0891B2" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="resolvedGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10B981" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
            <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94A3B8' }} />
            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94A3B8' }} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1E293B',
                border: 'none',
                borderRadius: '8px',
                fontSize: '12px',
                color: '#F1F5F9',
              }}
            />
            <Area type="monotone" dataKey="tickets" stroke="#0891B2" strokeWidth={2} fill="url(#ticketGrad)" />
            <Area type="monotone" dataKey="resolved" stroke="#10B981" strokeWidth={2} fill="url(#resolvedGrad)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
