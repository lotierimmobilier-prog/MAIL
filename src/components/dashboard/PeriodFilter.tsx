import { Calendar } from 'lucide-react';

export type Period = 'day' | 'week' | 'quarter' | 'year';

interface PeriodFilterProps {
  selectedPeriod: Period;
  onChange: (period: Period) => void;
}

const periods: { value: Period; label: string }[] = [
  { value: 'day', label: 'Aujourd\'hui' },
  { value: 'week', label: 'Cette semaine' },
  { value: 'quarter', label: 'Ce trimestre' },
  { value: 'year', label: 'Cette année' },
];

export default function PeriodFilter({ selectedPeriod, onChange }: PeriodFilterProps) {
  return (
    <div className="flex items-center gap-2 bg-white rounded-xl border border-slate-200 p-1">
      <div className="flex items-center gap-1.5 px-2 text-slate-600">
        <Calendar className="w-4 h-4" />
        <span className="text-xs font-medium">Période</span>
      </div>
      <div className="flex gap-1">
        {periods.map(period => (
          <button
            key={period.value}
            onClick={() => onChange(period.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              selectedPeriod === period.value
                ? 'bg-cyan-500 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {period.label}
          </button>
        ))}
      </div>
    </div>
  );
}
