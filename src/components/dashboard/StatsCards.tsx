import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface StatCard {
  label: string;
  value: string | number;
  change?: number;
  icon: LucideIcon;
  color: string;
}

export default function StatsCards({ stats }: { stats: StatCard[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map(stat => {
        const TrendIcon = stat.change && stat.change > 0 ? TrendingUp : stat.change && stat.change < 0 ? TrendingDown : Minus;
        const trendColor = stat.change && stat.change > 0 ? 'text-emerald-600' : stat.change && stat.change < 0 ? 'text-red-500' : 'text-slate-400';

        return (
          <div key={stat.label} className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: `${stat.color}12` }}
              >
                <stat.icon className="w-5 h-5" style={{ color: stat.color }} />
              </div>
              {stat.change !== undefined && (
                <div className={`flex items-center gap-1 text-xs font-medium ${trendColor}`}>
                  <TrendIcon className="w-3 h-3" />
                  <span>{Math.abs(stat.change)}%</span>
                </div>
              )}
            </div>
            <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
            <p className="text-sm text-slate-500 mt-0.5">{stat.label}</p>
          </div>
        );
      })}
    </div>
  );
}
