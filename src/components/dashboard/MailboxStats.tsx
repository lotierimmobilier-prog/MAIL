import { Mail, TrendingUp, TrendingDown, Minus } from 'lucide-react';

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

interface MailboxStatsProps {
  stats: MailboxStat[];
}

export default function MailboxStats({ stats }: MailboxStatsProps) {
  if (stats.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="text-sm font-semibold text-slate-900 mb-4">Statistiques par boîte mail</h3>
        <div className="text-center py-8 text-sm text-slate-500">
          Aucune donnée disponible pour cette période
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <h3 className="text-sm font-semibold text-slate-900 mb-4">Statistiques par boîte mail</h3>
      <div className="space-y-3">
        {stats.map(stat => {
          const TrendIcon = stat.change > 0 ? TrendingUp : stat.change < 0 ? TrendingDown : Minus;
          const trendColor = stat.change > 0 ? 'text-emerald-600' : stat.change < 0 ? 'text-red-500' : 'text-slate-400';

          return (
            <div
              key={stat.mailbox_id}
              className="flex items-center gap-3 p-3 rounded-lg border border-slate-100 hover:border-slate-200 transition"
            >
              <div className="w-9 h-9 rounded-lg bg-cyan-50 flex items-center justify-center shrink-0">
                <Mail className="w-4 h-4 text-cyan-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900 truncate">{stat.mailbox_name}</p>
                <p className="text-xs text-slate-500 truncate">{stat.mailbox_email}</p>
              </div>
              <div className="grid grid-cols-4 gap-4 shrink-0">
                <div className="text-center">
                  <p className="text-lg font-bold text-slate-900">{stat.total}</p>
                  <p className="text-xs text-slate-500">Total</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-blue-600">{stat.open}</p>
                  <p className="text-xs text-slate-500">Ouverts</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-amber-600">{stat.waiting}</p>
                  <p className="text-xs text-slate-500">Attente</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-red-600">{stat.urgent}</p>
                  <p className="text-xs text-slate-500">Urgent</p>
                </div>
              </div>
              <div className={`flex items-center gap-1 text-xs font-medium ${trendColor} shrink-0`}>
                <TrendIcon className="w-3 h-3" />
                <span>{Math.abs(stat.change)}%</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
