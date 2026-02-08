import { Brain, Target, Zap, Users, MapPin, Phone, Mail, Building } from 'lucide-react';
import Badge from '../ui/Badge';
import { SENTIMENT_COLORS } from '../../lib/constants';
import type { AiClassification } from '../../lib/types';

interface AiInsightsPanelProps {
  classification: AiClassification | null;
  loading?: boolean;
  onRequestClassify?: () => void;
}

export default function AiInsightsPanel({ classification, loading, onRequestClassify }: AiInsightsPanelProps) {
  if (!classification && !loading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center gap-2 mb-3">
          <Brain className="w-4 h-4 text-cyan-600" />
          <h4 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">Analyse IA</h4>
        </div>
        <p className="text-sm text-slate-500 mb-3">Aucune analyse IA disponible pour ce ticket.</p>
        {onRequestClassify && (
          <button
            onClick={onRequestClassify}
            className="w-full px-3 py-2 bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-medium rounded-lg transition"
          >
            Analyser avec l'IA
          </button>
        )}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Brain className="w-4 h-4 text-cyan-600 animate-pulse" />
          <h4 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">Analyse IA</h4>
        </div>
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-4 bg-slate-100 rounded animate-pulse" style={{ width: `${70 + i * 5}%` }} />
          ))}
        </div>
      </div>
    );
  }

  if (!classification) return null;

  const entities = classification.entities as Record<string, string | string[]>;
  const sentimentColor = SENTIMENT_COLORS[classification.sentiment] ?? SENTIMENT_COLORS.neutral;

  const sentimentLabels: Record<string, string> = {
    positive: 'Positif',
    neutral: 'Neutre',
    negative: 'Negatif',
    mixed: 'Mixte',
  };

  const priorityLabels: Record<string, string> = {
    low: 'Faible',
    medium: 'Moyen',
    high: 'Haute',
    urgent: 'Urgent',
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
      <div className="px-5 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-cyan-600" />
          <h4 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">Analyse IA</h4>
        </div>
        <span className="text-xs text-slate-400">
          {Math.round(classification.confidence * 100)}% confiance
        </span>
      </div>

      <div className="px-5 py-3 space-y-2">
        <div className="flex items-center gap-2 text-sm">
          <Target className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-slate-500">Categorie :</span>
          <span className="text-slate-900 font-medium">{classification.category}</span>
          {classification.subcategory && (
            <span className="text-slate-400">/ {classification.subcategory}</span>
          )}
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Zap className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-slate-500">Intention :</span>
          <span className="text-slate-900">{classification.intent}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-slate-500 ml-5">Sentiment :</span>
          <Badge label={sentimentLabels[classification.sentiment] || classification.sentiment} color={sentimentColor} />
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-slate-500 ml-5">Priorite :</span>
          <Badge label={priorityLabels[classification.priority] || classification.priority} color={classification.priority === 'urgent' ? '#EF4444' : '#3B82F6'} />
        </div>
      </div>

      {entities && Object.keys(entities).length > 0 && (
        <div className="px-5 py-3">
          <p className="text-xs font-medium text-slate-500 mb-2">Entites detectees</p>
          <div className="space-y-1.5">
            {entities.name && (
              <EntityRow icon={Users} label="Nom" value={String(entities.name)} />
            )}
            {entities.email && (
              <EntityRow icon={Mail} label="Email" value={String(entities.email)} />
            )}
            {entities.phone && (
              <EntityRow icon={Phone} label="Telephone" value={String(entities.phone)} />
            )}
            {entities.address && (
              <EntityRow icon={MapPin} label="Adresse" value={String(entities.address)} />
            )}
            {entities.property && (
              <EntityRow icon={Building} label="Bien" value={String(entities.property)} />
            )}
          </div>
        </div>
      )}

      {classification.recommended_actions.length > 0 && (
        <div className="px-5 py-3">
          <p className="text-xs font-medium text-slate-500 mb-2">Actions recommandees</p>
          <ul className="space-y-1">
            {classification.recommended_actions.map((action, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className="w-4 h-4 rounded-full bg-cyan-100 text-cyan-600 flex items-center justify-center text-xs font-medium shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <span className="text-slate-700">{action}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function EntityRow({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <Icon className="w-3.5 h-3.5 text-slate-400" />
      <span className="text-slate-500 text-xs">{label} :</span>
      <span className="text-slate-800">{value}</span>
    </div>
  );
}
