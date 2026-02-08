import { useState } from 'react';
import { Calendar, Clock, AlertCircle, CheckCircle } from 'lucide-react';
import { format, isPast, differenceInDays, isToday, isTomorrow } from 'date-fns';
import { fr } from 'date-fns/locale';

interface DueDateManagerProps {
  dueDate: string | null;
  onUpdate: (date: string | null) => void;
}

export default function DueDateManager({ dueDate, onUpdate }: DueDateManagerProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [selectedDate, setSelectedDate] = useState(
    dueDate ? format(new Date(dueDate), 'yyyy-MM-dd') : ''
  );

  function getDueDateStatus(date: string | null) {
    if (!date) return null;

    const dueDateObj = new Date(date);
    const now = new Date();

    if (isPast(dueDateObj) && !isToday(dueDateObj)) {
      return {
        status: 'overdue',
        label: 'En retard',
        color: 'text-red-600',
        bgColor: 'bg-red-50',
        borderColor: 'border-red-200',
        icon: AlertCircle,
      };
    }

    if (isToday(dueDateObj)) {
      return {
        status: 'today',
        label: "Aujourd'hui",
        color: 'text-orange-600',
        bgColor: 'bg-orange-50',
        borderColor: 'border-orange-200',
        icon: Clock,
      };
    }

    if (isTomorrow(dueDateObj)) {
      return {
        status: 'tomorrow',
        label: 'Demain',
        color: 'text-orange-600',
        bgColor: 'bg-orange-50',
        borderColor: 'border-orange-200',
        icon: Clock,
      };
    }

    const daysLeft = differenceInDays(dueDateObj, now);

    if (daysLeft <= 3) {
      return {
        status: 'soon',
        label: `Dans ${daysLeft} jour${daysLeft > 1 ? 's' : ''}`,
        color: 'text-orange-600',
        bgColor: 'bg-orange-50',
        borderColor: 'border-orange-200',
        icon: Clock,
      };
    }

    return {
      status: 'ok',
      label: `Dans ${daysLeft} jours`,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50',
      borderColor: 'border-emerald-200',
      icon: CheckCircle,
    };
  }

  function handleSave() {
    if (selectedDate) {
      onUpdate(new Date(selectedDate).toISOString());
    } else {
      onUpdate(null);
    }
    setIsEditing(false);
  }

  function handleClear() {
    setSelectedDate('');
    onUpdate(null);
    setIsEditing(false);
  }

  const status = getDueDateStatus(dueDate);

  if (isEditing) {
    return (
      <div className="space-y-3">
        <label className="block text-sm font-medium text-slate-700">
          Date d'échéance
        </label>
        <input
          type="date"
          value={selectedDate}
          onChange={e => setSelectedDate(e.target.value)}
          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
        />
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            className="flex-1 px-3 py-1.5 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition text-xs font-medium"
          >
            Enregistrer
          </button>
          {dueDate && (
            <button
              onClick={handleClear}
              className="px-3 py-1.5 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition text-xs font-medium"
            >
              Supprimer
            </button>
          )}
          <button
            onClick={() => setIsEditing(false)}
            className="px-3 py-1.5 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition text-xs font-medium"
          >
            Annuler
          </button>
        </div>
      </div>
    );
  }

  if (!dueDate) {
    return (
      <button
        onClick={() => setIsEditing(true)}
        className="w-full flex items-center gap-2 px-3 py-2 border border-dashed border-slate-300 text-slate-600 rounded-lg hover:border-cyan-500 hover:text-cyan-600 hover:bg-cyan-50 transition text-sm"
      >
        <Calendar className="w-4 h-4" />
        Définir une échéance
      </button>
    );
  }

  const StatusIcon = status?.icon || Calendar;

  return (
    <button
      onClick={() => setIsEditing(true)}
      className={`w-full flex items-center gap-2 px-3 py-2 border rounded-lg transition text-sm ${
        status?.bgColor
      } ${status?.borderColor} ${status?.color}`}
    >
      <StatusIcon className="w-4 h-4" />
      <div className="flex-1 text-left">
        <div className="font-medium">{status?.label}</div>
        <div className="text-xs opacity-75">
          {format(new Date(dueDate), 'dd MMMM yyyy', { locale: fr })}
        </div>
      </div>
    </button>
  );
}
