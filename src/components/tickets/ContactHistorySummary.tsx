import { useState, useEffect } from 'react';
import { History, ChevronDown, ChevronUp, Mail, ArrowDownLeft, ArrowUpRight, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '../../lib/supabase';

interface HistoryTicket {
  id: string;
  subject: string;
  status: string | null;
  created_at: string;
  emails: {
    id: string;
    subject: string;
    direction: string;
    from_name: string;
    from_address: string;
    body_text: string;
    received_at: string;
  }[];
}

interface ContactHistorySummaryProps {
  contactEmail: string;
  contactName: string;
  currentTicketId: string;
}

export default function ContactHistorySummary({ contactEmail, contactName, currentTicketId }: ContactHistorySummaryProps) {
  const [history, setHistory] = useState<HistoryTicket[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [expandedTicketId, setExpandedTicketId] = useState<string | null>(null);

  useEffect(() => {
    setLoaded(false);
    setHistory([]);
    setExpanded(false);
  }, [contactEmail]);

  async function loadHistory() {
    if (loaded) {
      setExpanded(!expanded);
      return;
    }

    setLoading(true);
    const { data } = await supabase
      .from('tickets')
      .select(`
        id,
        subject,
        status,
        created_at,
        emails(
          id,
          subject,
          direction,
          from_name,
          from_address,
          body_text,
          received_at
        )
      `)
      .eq('contact_email', contactEmail)
      .neq('id', currentTicketId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (data) {
      setHistory(data as unknown as HistoryTicket[]);
    }
    setLoaded(true);
    setExpanded(true);
    setLoading(false);
  }

  const totalEmails = history.reduce((sum, t) => sum + (t.emails?.length || 0), 0);

  const statusLabel = (s: string | null) => {
    switch (s) {
      case 'open': return 'Ouvert';
      case 'replied': return 'Repondu';
      case 'closed': return 'Ferme';
      case 'pending': return 'En attente';
      default: return s || 'Inconnu';
    }
  };

  const statusColor = (s: string | null) => {
    switch (s) {
      case 'open': return 'bg-blue-100 text-blue-700';
      case 'replied': return 'bg-emerald-100 text-emerald-700';
      case 'closed': return 'bg-slate-100 text-slate-600';
      case 'pending': return 'bg-amber-100 text-amber-700';
      default: return 'bg-slate-100 text-slate-600';
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <button
        onClick={loadHistory}
        disabled={loading}
        className="flex items-center justify-between w-full px-5 py-3.5 text-left hover:bg-slate-50 transition"
      >
        <div className="flex items-center gap-2.5">
          {loading ? (
            <Loader2 className="w-4 h-4 text-cyan-600 animate-spin" />
          ) : (
            <History className="w-4 h-4 text-cyan-600" />
          )}
          <span className="text-sm font-medium text-slate-900">
            Historique des echanges avec {contactName || contactEmail}
          </span>
          {loaded && (
            <span className="text-xs text-slate-500">
              ({history.length} ticket{history.length !== 1 ? 's' : ''}, {totalEmails} email{totalEmails !== 1 ? 's' : ''})
            </span>
          )}
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-slate-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-slate-400" />
        )}
      </button>

      {expanded && loaded && (
        <div className="border-t border-slate-100">
          {history.length === 0 ? (
            <div className="px-5 py-6 text-center text-sm text-slate-500">
              Aucun autre echange avec ce contact.
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {history.map(ticket => (
                <div key={ticket.id} className="group">
                  <button
                    onClick={() => setExpandedTicketId(expandedTicketId === ticket.id ? null : ticket.id)}
                    className="flex items-center gap-3 w-full px-5 py-3 text-left hover:bg-slate-50 transition"
                  >
                    <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{ticket.subject}</p>
                      <p className="text-xs text-slate-500">
                        {format(new Date(ticket.created_at), 'dd/MM/yyyy')} - {ticket.emails?.length || 0} message{(ticket.emails?.length || 0) !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <span className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${statusColor(ticket.status)}`}>
                      {statusLabel(ticket.status)}
                    </span>
                    {expandedTicketId === ticket.id ? (
                      <ChevronUp className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    )}
                  </button>

                  {expandedTicketId === ticket.id && ticket.emails && (
                    <div className="px-5 pb-3 space-y-2 ml-9">
                      {ticket.emails
                        .sort((a, b) => new Date(a.received_at).getTime() - new Date(b.received_at).getTime())
                        .map(email => (
                        <div
                          key={email.id}
                          className={`px-3 py-2.5 rounded-lg border text-sm ${
                            email.direction === 'inbound'
                              ? 'bg-slate-50 border-slate-200'
                              : 'bg-cyan-50/50 border-cyan-200'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            {email.direction === 'inbound' ? (
                              <ArrowDownLeft className="w-3.5 h-3.5 text-slate-500" />
                            ) : (
                              <ArrowUpRight className="w-3.5 h-3.5 text-cyan-600" />
                            )}
                            <span className="text-xs font-medium text-slate-700">
                              {email.from_name || email.from_address}
                            </span>
                            <span className="text-xs text-slate-400 ml-auto">
                              {format(new Date(email.received_at), 'dd/MM/yyyy HH:mm')}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 line-clamp-3 whitespace-pre-line">
                            {(email.body_text || '').substring(0, 300)}{(email.body_text || '').length > 300 ? '...' : ''}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
