import { useState } from 'react';
import { Send, Sparkles, FileText, Loader2 } from 'lucide-react';
import type { Ticket, Email, EmailTemplate } from '../../lib/types';
import { supabase } from '../../lib/supabase';
import { fillTemplateVariables, extractTemplateVariables } from '../../lib/constants';

interface DraftComposerProps {
  ticket: Ticket;
  emails: Email[];
  templates: EmailTemplate[];
  onSent: () => void;
}

export default function DraftComposer({ ticket, emails, templates, onSent }: DraftComposerProps) {
  const [body, setBody] = useState('');
  const [subject, setSubject] = useState(`Re: ${ticket.subject}`);
  const [sending, setSending] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [missingVars, setMissingVars] = useState<string[]>([]);
  const [aiError, setAiError] = useState('');

  async function handleSend() {
    if (!body.trim()) return;

    const vars = extractTemplateVariables(body);
    if (vars.length > 0) {
      setMissingVars(vars);
      return;
    }

    setSending(true);
    await supabase.from('emails').insert({
      ticket_id: ticket.id,
      mailbox_id: ticket.mailbox_id,
      from_address: 'agent@company.com',
      from_name: 'Support Agent',
      to_addresses: [ticket.contact_email],
      subject,
      body_text: body,
      direction: 'outbound',
      sent_at: new Date().toISOString(),
    });

    await supabase.from('tickets').update({
      status: 'replied',
      last_message_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', ticket.id);

    setBody('');
    setSending(false);
    onSent();
  }

  async function handleAiDraft() {
    setGenerating(true);
    setAiError('');
    try {
      const conversation = emails.map(e => ({
        direction: e.direction,
        from_name: e.from_name,
        body_text: e.body_text,
        received_at: e.received_at,
      }));

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-draft`;
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ticket_subject: ticket.subject,
          contact_name: ticket.contact_name,
          contact_email: ticket.contact_email,
          conversation,
        }),
      });
      const data = await res.json();
      if (res.ok && data.draft) {
        setBody(data.draft);
      } else {
        setAiError(data.error || 'Erreur lors de la generation');
      }
    } catch {
      setAiError('Impossible de contacter le service IA');
    }
    setGenerating(false);
  }

  function insertTemplate(template: EmailTemplate) {
    const values: Record<string, string> = {
      client_name: ticket.contact_name || ticket.contact_email,
      date: new Date().toLocaleDateString('fr-FR'),
    };
    const filled = fillTemplateVariables(template.body, values);
    setBody(filled);
    if (template.subject) setSubject(fillTemplateVariables(template.subject, values));
    setShowTemplates(false);

    const remaining = extractTemplateVariables(filled);
    if (remaining.length > 0) setMissingVars(remaining);
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200">
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
        <h4 className="text-sm font-semibold text-slate-900">Repondre</h4>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowTemplates(!showTemplates)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 rounded-lg transition"
          >
            <FileText className="w-3.5 h-3.5" />
            Modeles
          </button>
          <button
            onClick={handleAiDraft}
            disabled={generating}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-cyan-600 hover:text-cyan-700 bg-cyan-50 hover:bg-cyan-100 rounded-lg transition disabled:opacity-50"
          >
            {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            Reponse IA
          </button>
        </div>
      </div>

      {showTemplates && templates.length > 0 && (
        <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
          <p className="text-xs text-slate-500 mb-2">Choisir un modele :</p>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {templates.map(t => (
              <button
                key={t.id}
                onClick={() => insertTemplate(t)}
                className="w-full text-left px-3 py-2 rounded-lg text-sm text-slate-700 hover:bg-white hover:shadow-sm transition"
              >
                <span className="font-medium">{t.name}</span>
                {t.description && <span className="text-slate-400 ml-2">- {t.description}</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {missingVars.length > 0 && (
        <div className="px-5 py-2 bg-amber-50 border-b border-amber-200 text-xs text-amber-700">
          Variables manquantes : {missingVars.map(v => `{{${v}}}`).join(', ')}. Veuillez les remplir avant d'envoyer.
        </div>
      )}

      {aiError && (
        <div className="px-5 py-2 bg-red-50 border-b border-red-200 text-xs text-red-700">
          {aiError}
        </div>
      )}

      <div className="px-5 py-3">
        <input
          type="text"
          value={subject}
          onChange={e => setSubject(e.target.value)}
          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 mb-3 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
          placeholder="Objet"
        />
        <textarea
          value={body}
          onChange={e => { setBody(e.target.value); setMissingVars([]); setAiError(''); }}
          rows={8}
          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 resize-none focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
          placeholder="Redigez votre reponse..."
        />
      </div>

      <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100">
        <p className="text-xs text-slate-400">A : {ticket.contact_email}</p>
        <button
          onClick={handleSend}
          disabled={!body.trim() || sending}
          className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-medium rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          Envoyer
        </button>
      </div>
    </div>
  );
}
