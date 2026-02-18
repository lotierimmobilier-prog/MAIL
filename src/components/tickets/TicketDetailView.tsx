import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Hash, Mail } from 'lucide-react';
import Header from '../layout/Header';
import ConversationThread from './ConversationThread';
import TicketMetaPanel from './TicketMetaPanel';
import AttachmentsPanel from './AttachmentsPanel';
import InternalNotes from './InternalNotes';
import DraftComposer from '../drafts/DraftComposer';
import EmailComposer from '../email/EmailComposer';
import AiResponseSuggestions from './AiResponseSuggestions';
import ContactHistorySummary from './ContactHistorySummary';
import LoadingSpinner from '../ui/LoadingSpinner';
import { supabase } from '../../lib/supabase';
import { useMailboxPermissions } from '../../hooks/useMailboxPermissions';
import type { Ticket, Email, Profile, Category, InternalNote, EmailTemplate, Attachment } from '../../lib/types';

export default function TicketDetailView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { canSendMailbox } = useMailboxPermissions();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [emails, setEmails] = useState<Email[]>([]);
  const [notes, setNotes] = useState<InternalNote[]>([]);
  const [agents, setAgents] = useState<Profile[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [composerOpen, setComposerOpen] = useState(false);

  const loadTicket = useCallback(async () => {
    if (!id) return;

    const [ticketRes, emailRes, noteRes, agentRes, catRes, tmplRes] = await Promise.all([
      supabase.from('tickets').select('*, category:categories(*), assignee:profiles!tickets_assignee_id_fkey(*)').eq('id', id).maybeSingle(),
      supabase.from('emails').select('*, attachments(*)').eq('ticket_id', id).order('received_at', { ascending: true }),
      supabase.from('internal_notes').select('*, author:profiles(full_name)').eq('ticket_id', id).order('created_at', { ascending: true }),
      supabase.from('profiles').select('*').in('role', ['admin', 'manager', 'agent']).eq('is_active', true),
      supabase.from('categories').select('*').order('name'),
      supabase.from('email_templates').select('*').eq('is_active', true).order('name'),
    ]);

    if (ticketRes.data) setTicket(ticketRes.data);
    if (emailRes.data) setEmails(emailRes.data);
    if (noteRes.data) setNotes(noteRes.data);
    if (agentRes.data) setAgents(agentRes.data);
    if (catRes.data) setCategories(catRes.data);
    if (tmplRes.data) setTemplates(tmplRes.data);
    setLoading(false);

    const { data: { user } } = await supabase.auth.getUser();
    if (user && ticketRes.data && !ticketRes.data.is_read) {
      await supabase
        .from('tickets')
        .update({
          is_read: true,
          last_read_at: new Date().toISOString(),
          last_read_by: user.id
        })
        .eq('id', id);
    }
  }, [id]);

  useEffect(() => {
    loadTicket();
  }, [loadTicket]);

  const allAttachments = useMemo(() => {
    const attachments: Attachment[] = [];
    emails.forEach(email => {
      if (email.attachments && email.attachments.length > 0) {
        attachments.push(...email.attachments);
      }
    });
    return attachments;
  }, [emails]);

  if (loading) return <LoadingSpinner />;
  if (!ticket) {
    return (
      <div className="min-h-screen">
        <Header title="Ticket introuvable" />
        <div className="p-6 text-center">
          <p className="text-slate-500">Ce ticket n'existe pas ou vous n'y avez pas acces.</p>
          <button onClick={() => navigate('/inbox')} className="mt-4 text-cyan-600 hover:text-cyan-700 text-sm font-medium">
            Retour a la boite de reception
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header title={ticket.subject} subtitle={`Ticket ${ticket.id.slice(0, 8)}`} />

      <div className="p-3 lg:p-6">
        <button
          onClick={() => navigate('/inbox')}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-3 lg:mb-4 transition pl-8 lg:pl-0"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour
        </button>

        <div className="flex items-center gap-2 mb-4 lg:mb-6">
          <Hash className="w-4 h-4 text-slate-400" />
          <span className="text-xs text-slate-400 font-mono">{ticket.id.slice(0, 8)}</span>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 space-y-6">
            <ConversationThread emails={emails} notes={notes} />

            <ContactHistorySummary
              contactEmail={ticket.contact_email}
              contactName={ticket.contact_name}
              currentTicketId={ticket.id}
            />

            {emails.length > 0 && (
              <AiResponseSuggestions
                ticketId={ticket.id}
                onAccept={() => {
                  setComposerOpen(true);
                }}
                onRegenerate={async () => {
                  try {
                    const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/auto-generate-draft`;
                    await fetch(apiUrl, {
                      method: 'POST',
                      headers: {
                        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
                        'Content-Type': 'application/json',
                      },
                      body: JSON.stringify({
                        ticket_id: ticket.id,
                      }),
                    });
                    await loadTicket();
                  } catch (error) {
                    console.error('Failed to regenerate responses:', error);
                  }
                }}
              />
            )}

            {canSendMailbox(ticket.mailbox_id) && (
              <div className="flex justify-end">
                <button
                  onClick={() => setComposerOpen(true)}
                  className="flex items-center gap-2 px-4 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-medium rounded-lg shadow-sm transition"
                >
                  <Mail className="w-4 h-4" />
                  Envoyer un email
                </button>
              </div>
            )}

            <DraftComposer ticket={ticket} emails={emails} templates={templates} onSent={loadTicket} />
            <InternalNotes ticketId={ticket.id} notes={notes} onNoteAdded={loadTicket} />
          </div>

          <div className="space-y-4">
            <TicketMetaPanel
              ticket={ticket}
              agents={agents}
              categories={categories}
              onUpdate={loadTicket}
            />
            <AttachmentsPanel attachments={allAttachments} />
          </div>
        </div>
      </div>

      {composerOpen && (
        <EmailComposer
          ticket={ticket}
          emails={emails}
          onClose={() => setComposerOpen(false)}
          onSent={loadTicket}
        />
      )}
    </div>
  );
}
