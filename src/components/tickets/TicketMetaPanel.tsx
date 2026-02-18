import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { User, Tag, Clock, FolderOpen, AlertTriangle, ChevronDown, Paperclip, Download, UserPlus } from 'lucide-react';
import Badge from '../ui/Badge';
import DueDateManager from './DueDateManager';
import ContactFormModal from '../contacts/ContactFormModal';
import { TICKET_STATUSES, TICKET_PRIORITIES, getStatusConfig, getPriorityConfig, formatFileSize } from '../../lib/constants';
import { supabase } from '../../lib/supabase';
import type { Ticket, Profile, Category, Contact } from '../../lib/types';

interface Attachment {
  id: string;
  filename: string;
  size_bytes: number;
  content_type: string;
  email_id: string;
}

interface TicketMetaPanelProps {
  ticket: Ticket;
  agents: Profile[];
  categories: Category[];
  onUpdate: () => void;
}

export default function TicketMetaPanel({ ticket, agents, categories, onUpdate }: TicketMetaPanelProps) {
  const [updating, setUpdating] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [contactExists, setContactExists] = useState<boolean | null>(null);
  const [showContactForm, setShowContactForm] = useState(false);
  const statusCfg = getStatusConfig(ticket.status);
  const priorityCfg = getPriorityConfig(ticket.priority);

  useEffect(() => {
    loadAttachments();
  }, [ticket.id]);

  useEffect(() => {
    if (ticket.contact_email) {
      checkContactExists(ticket.contact_email);
    }
  }, [ticket.contact_email]);

  async function checkContactExists(email: string) {
    const { data } = await supabase
      .from('contacts')
      .select('id')
      .eq('email', email.toLowerCase())
      .maybeSingle();
    setContactExists(!!data);
  }

  async function loadAttachments() {
    const { data: emails } = await supabase
      .from('emails')
      .select('id')
      .eq('ticket_id', ticket.id);

    if (!emails || emails.length === 0) {
      setAttachments([]);
      return;
    }

    const emailIds = emails.map(e => e.id);
    const { data } = await supabase
      .from('attachments')
      .select('*')
      .in('email_id', emailIds)
      .order('created_at', { ascending: false });

    if (data) setAttachments(data);
  }

  async function updateField(field: string, value: string | null) {
    setUpdating(true);
    await supabase.from('tickets').update({ [field]: value, updated_at: new Date().toISOString() }).eq('id', ticket.id);
    onUpdate();
    setUpdating(false);
  }

  function parseContactName() {
    const name = ticket.contact_name || '';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
    }
    return { firstName: name, lastName: '' };
  }

  const prefillContact: Partial<Contact> | undefined = !contactExists && ticket.contact_email ? (() => {
    const { firstName, lastName } = parseContactName();
    return {
      email: ticket.contact_email.toLowerCase(),
      first_name: firstName,
      last_name: lastName,
      company: '',
      phone: '',
      notes: '',
      source: 'manual' as const,
    } as Partial<Contact>;
  })() : undefined;

  return (
    <div className={`space-y-4 ${updating ? 'opacity-70 pointer-events-none' : ''}`}>
      {attachments.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Paperclip className="w-4 h-4 text-slate-400" />
            <h4 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
              Pieces jointes ({attachments.length})
            </h4>
          </div>
          <div className="space-y-2">
            {attachments.map(att => (
              <div
                key={att.id}
                className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg hover:border-cyan-300 transition group"
              >
                <Paperclip className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-700 truncate">{att.filename}</p>
                  <p className="text-xs text-slate-500">{formatFileSize(att.size_bytes)}</p>
                </div>
                <button
                  className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-cyan-100 text-cyan-600 transition"
                  title="Telecharger"
                >
                  <Download className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
        <div className="px-4 py-3">
          <label className="text-xs font-medium text-slate-500 mb-1.5 block">Statut</label>
          <div className="relative">
            <select
              value={ticket.status ?? ''}
              onChange={e => updateField('status', e.target.value || null)}
              className="w-full appearance-none bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 pr-8 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
            >
              <option value="">Aucun statut</option>
              {TICKET_STATUSES.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>
          {ticket.status && (
            <div className="mt-1.5">
              <Badge label={statusCfg.label} color={statusCfg.color} />
            </div>
          )}
        </div>

        <div className="px-4 py-3">
          <label className="text-xs font-medium text-slate-500 mb-1.5 block">Priorite</label>
          <div className="relative">
            <select
              value={ticket.priority ?? ''}
              onChange={e => updateField('priority', e.target.value || null)}
              className="w-full appearance-none bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 pr-8 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
            >
              <option value="">Aucune priorite</option>
              {TICKET_PRIORITIES.map(p => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>
          {ticket.priority && (
            <div className="mt-1.5">
              <Badge label={priorityCfg.label} color={priorityCfg.color} />
            </div>
          )}
        </div>

        <div className="px-4 py-3">
          <label className="text-xs font-medium text-slate-500 mb-1.5 block">Assigne a</label>
          <div className="relative">
            <select
              value={ticket.assignee_id ?? ''}
              onChange={e => updateField('assignee_id', e.target.value || null)}
              className="w-full appearance-none bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 pr-8 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
            >
              <option value="">Non assigne</option>
              {agents.map(a => (
                <option key={a.id} value={a.id}>{a.full_name || a.email}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>
        </div>

        <div className="px-4 py-3">
          <label className="text-xs font-medium text-slate-500 mb-1.5 block">Categorie</label>
          <div className="relative">
            <select
              value={ticket.category_id ?? ''}
              onChange={e => updateField('category_id', e.target.value || null)}
              className="w-full appearance-none bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 pr-8 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
            >
              <option value="">Aucune categorie</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>
        </div>

        <div className="px-4 py-3">
          <label className="text-xs font-medium text-slate-500 mb-1.5 block">Echeance</label>
          <DueDateManager
            dueDate={ticket.due_date}
            onUpdate={(date) => updateField('due_date', date)}
          />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
        <h4 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">Details</h4>
        <div className="space-y-2.5">
          <div className="flex items-center gap-2 text-sm">
            <User className="w-4 h-4 text-slate-400" />
            <span className="text-slate-500">Contact :</span>
            <span className="text-slate-900 font-medium">{ticket.contact_name || ticket.contact_email}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Tag className="w-4 h-4 text-slate-400" />
            <span className="text-slate-500">Email :</span>
            <span className="text-slate-700">{ticket.contact_email}</span>
          </div>

          {contactExists === false && ticket.contact_email && (
            <button
              onClick={() => setShowContactForm(true)}
              className="flex items-center gap-2 w-full px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800 hover:bg-amber-100 transition"
            >
              <UserPlus className="w-4 h-4" />
              <span className="font-medium">Ajouter aux contacts</span>
            </button>
          )}

          {contactExists === true && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-700">
              <User className="w-3.5 h-3.5" />
              Contact enregistre dans l'annuaire
            </div>
          )}

          <div className="flex items-center gap-2 text-sm">
            <FolderOpen className="w-4 h-4 text-slate-400" />
            <span className="text-slate-500">Cree le :</span>
            <span className="text-slate-700">{format(new Date(ticket.created_at), 'MMM d, yyyy HH:mm')}</span>
          </div>
          {ticket.sla_deadline && (
            <div className="flex items-center gap-2 text-sm">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <span className="text-slate-500">SLA :</span>
              <span className="text-amber-600 font-medium">{format(new Date(ticket.sla_deadline), 'MMM d, HH:mm')}</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-sm">
            <Clock className="w-4 h-4 text-slate-400" />
            <span className="text-slate-500">Mis a jour :</span>
            <span className="text-slate-700">{format(new Date(ticket.updated_at), 'MMM d, yyyy HH:mm')}</span>
          </div>
        </div>
      </div>

      {showContactForm && prefillContact && (
        <ContactFormModal
          contact={null}
          prefill={prefillContact}
          onClose={() => setShowContactForm(false)}
          onSaved={() => {
            setShowContactForm(false);
            setContactExists(true);
          }}
        />
      )}
    </div>
  );
}
