import type { TicketStatus, TicketPriority } from './types';

export const TICKET_STATUSES: { value: TicketStatus; label: string; color: string }[] = [
  { value: 'new', label: 'Nouveau', color: '#0EA5E9' },
  { value: 'qualify', label: 'À qualifier', color: '#F59E0B' },
  { value: 'assigned', label: 'Assigné', color: '#8B5CF6' },
  { value: 'in_progress', label: 'En cours', color: '#3B82F6' },
  { value: 'waiting', label: 'En attente', color: '#F97316' },
  { value: 'replied', label: 'Répondu', color: '#10B981' },
  { value: 'closed', label: 'Fermé', color: '#6B7280' },
];

export const TICKET_PRIORITIES: { value: TicketPriority; label: string; color: string }[] = [
  { value: 'low', label: 'Basse', color: '#6B7280' },
  { value: 'medium', label: 'Moyenne', color: '#3B82F6' },
  { value: 'high', label: 'Haute', color: '#F59E0B' },
  { value: 'urgent', label: 'Urgente', color: '#EF4444' },
];

export const SENTIMENT_COLORS: Record<string, string> = {
  positive: '#10B981',
  neutral: '#6B7280',
  negative: '#EF4444',
  mixed: '#F59E0B',
};

export function getStatusConfig(status: TicketStatus | null | undefined) {
  if (!status) return { value: '' as TicketStatus, label: 'Aucun statut', color: '#CBD5E1' };
  return TICKET_STATUSES.find(s => s.value === status) ?? { value: status, label: status, color: '#6B7280' };
}

export function getPriorityConfig(priority: TicketPriority | null | undefined) {
  if (!priority) return { value: '' as TicketPriority, label: 'Aucune priorité', color: '#CBD5E1' };
  return TICKET_PRIORITIES.find(p => p.value === priority) ?? { value: priority, label: priority, color: '#6B7280' };
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function extractTemplateVariables(text: string): string[] {
  const matches = text.match(/\{\{(\w+)\}\}/g);
  if (!matches) return [];
  return [...new Set(matches.map(m => m.replace(/\{\{|\}\}/g, '')))];
}

export function fillTemplateVariables(text: string, values: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (match, key) => values[key] ?? match);
}
