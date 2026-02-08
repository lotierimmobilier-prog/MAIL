import { FileText, Edit3, History, Trash2 } from 'lucide-react';
import Badge from '../ui/Badge';
import { extractTemplateVariables } from '../../lib/constants';
import type { EmailTemplate } from '../../lib/types';

interface TemplateCardProps {
  template: EmailTemplate;
  onEdit: () => void;
  onViewHistory: () => void;
  onDelete?: () => void;
  canManage: boolean;
}

export default function TemplateCard({ template, onEdit, onViewHistory, onDelete, canManage }: TemplateCardProps) {
  const variables = extractTemplateVariables(template.body + ' ' + template.subject);

  return (
    <div className="bg-white rounded-xl border border-slate-200 hover:shadow-md transition-shadow group">
      <div className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-cyan-50 flex items-center justify-center">
              <FileText className="w-4 h-4 text-cyan-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">{template.name}</h3>
              <p className="text-xs text-slate-500">v{template.version}</p>
            </div>
          </div>
          {!template.is_active && (
            <Badge label="Inactif" color="#EF4444" />
          )}
        </div>

        {template.description && (
          <p className="text-sm text-slate-500 mb-3 line-clamp-2">{template.description}</p>
        )}

        {template.subject && (
          <p className="text-xs text-slate-400 mb-2">
            Objet : <span className="text-slate-600">{template.subject}</span>
          </p>
        )}

        <div className="bg-slate-50 rounded-lg p-3 mb-3">
          <pre className="text-xs text-slate-600 whitespace-pre-wrap line-clamp-4 font-sans">
            {template.body}
          </pre>
        </div>

        {variables.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {variables.map(v => (
              <span key={v} className="px-1.5 py-0.5 bg-cyan-50 text-cyan-700 text-xs rounded font-mono">
                {`{{${v}}}`}
              </span>
            ))}
          </div>
        )}

        {template.category && (
          <Badge
            label={(template.category as { name: string; color: string }).name}
            color={(template.category as { name: string; color: string }).color}
          />
        )}
      </div>

      <div className="flex items-center border-t border-slate-100 divide-x divide-slate-100">
        <button
          onClick={onEdit}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium text-slate-500 hover:text-cyan-600 hover:bg-cyan-50/50 transition"
        >
          <Edit3 className="w-3.5 h-3.5" />
          Modifier
        </button>
        <button
          onClick={onViewHistory}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-50 transition"
        >
          <History className="w-3.5 h-3.5" />
          Historique
        </button>
        {canManage && onDelete && (
          <button
            onClick={onDelete}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium text-slate-500 hover:text-red-600 hover:bg-red-50/50 transition"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Supprimer
          </button>
        )}
      </div>
    </div>
  );
}
