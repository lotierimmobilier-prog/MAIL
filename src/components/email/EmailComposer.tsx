import { useState, useEffect } from 'react';
import { X, Send, Sparkles, Loader2, Brain, PenTool } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import TipTapEditor, { juice } from '../ui/TipTapEditor';
import AttachmentsManager from './AttachmentsManager';
import type { Ticket, Email } from '../../lib/types';

interface EmailComposerProps {
  ticket: Ticket;
  emails: Email[];
  onClose: () => void;
  onSent: () => void;
}

export default function EmailComposer({ ticket, emails, onClose, onSent }: EmailComposerProps) {
  const [to, setTo] = useState(ticket.contact_email);
  const [subject, setSubject] = useState(`Re: ${ticket.subject}`);
  const [body, setBody] = useState('');
  const [aiIdea, setAiIdea] = useState('');
  const [sending, setSending] = useState(false);
  const [generatingDraft, setGeneratingDraft] = useState(false);
  const [generatingSuggestion, setGeneratingSuggestion] = useState(false);
  const [suggestionInfo, setSuggestionInfo] = useState<any>(null);
  const [attachments, setAttachments] = useState<any[]>([]);
  const [signatures, setSignatures] = useState<any[]>([]);
  const [selectedSignature, setSelectedSignature] = useState<string | null>(null);

  useEffect(() => {
    handleSuggestResponse();
    loadSignatures();
  }, []);

  async function loadSignatures() {
    const { data } = await supabase
      .from('user_signatures')
      .select('*')
      .eq('is_active', true)
      .order('is_default', { ascending: false });

    if (data && data.length > 0) {
      setSignatures(data);
      const defaultSig = data.find(s => s.is_default);
      if (defaultSig) {
        setSelectedSignature(defaultSig.id);
      }
    }
  }

  function insertSignature(htmlBody: string): string {
    if (!selectedSignature) return htmlBody;

    const signature = signatures.find(s => s.id === selectedSignature);
    if (!signature) return htmlBody;

    return `${htmlBody}<br/><br/>${signature.html_content}`;
  }

  async function handleImageUpload(file: File): Promise<string> {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
    const filePath = `signatures/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('attachments')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) throw uploadError;

    const { data } = supabase.storage
      .from('attachments')
      .getPublicUrl(filePath);

    return data.publicUrl;
  }

  async function handleSuggestResponse() {
    setGeneratingSuggestion(true);
    setSuggestionInfo(null);
    try {
      const latestInboundEmail = emails
        .filter(e => e.direction === 'inbound')
        .sort((a, b) => new Date(b.received_at).getTime() - new Date(a.received_at).getTime())[0];

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/suggest-response`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ticket_id: ticket.id,
          ticket_subject: ticket.subject,
          ticket_body: latestInboundEmail?.body_text || '',
          contact_email: ticket.contact_email,
          contact_name: ticket.contact_name,
          category_id: ticket.category_id,
          mailbox_id: ticket.mailbox_id,
        })
      });

      const result = await response.json();

      if (!response.ok) {
        alert(result.error || 'Erreur lors de la suggestion de réponse');
        return;
      }

      setBody(result.suggested_response || '');
      setSuggestionInfo({
        reasoning: result.reasoning,
        key_points: result.key_points,
        alternative_approaches: result.alternative_approaches,
        confidence: result.confidence
      });
    } catch (error) {
      alert('Erreur lors de la suggestion de réponse');
      console.error(error);
    } finally {
      setGeneratingSuggestion(false);
    }
  }

  async function handleGenerateDraft() {
    if (!aiIdea.trim()) {
      alert('Veuillez entrer une idée pour générer le brouillon');
      return;
    }

    setGeneratingDraft(true);
    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-draft`;

      const conversationForAI = emails
        .sort((a, b) => new Date(a.received_at).getTime() - new Date(b.received_at).getTime())
        .map(email => ({
          direction: email.direction,
          from_name: email.from_name,
          body_text: email.body_text || email.body_html?.replace(/<[^>]*>/g, '') || '',
          received_at: email.received_at
        }));

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ticket_subject: ticket.subject,
          contact_name: ticket.contact_name,
          contact_email: ticket.contact_email,
          conversation: conversationForAI,
          tone: 'professional',
          user_instruction: aiIdea,
        })
      });

      const result = await response.json();

      if (!response.ok) {
        alert(result.error || 'Erreur lors de la génération du brouillon');
        return;
      }

      setBody(result.draft || '');
      setAiIdea('');
    } catch (error) {
      alert('Erreur lors de la génération du brouillon');
      console.error(error);
    } finally {
      setGeneratingDraft(false);
    }
  }

  async function handleSend() {
    if (!to || !subject || !body) {
      alert('Veuillez remplir tous les champs');
      return;
    }

    setSending(true);
    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-email`;
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        alert('Session expirée. Veuillez vous reconnecter.');
        return;
      }

      const latestInboundEmail = emails
        .filter(e => e.direction === 'inbound')
        .sort((a, b) => new Date(b.received_at).getTime() - new Date(a.received_at).getTime())[0];

      const htmlWithSignature = insertSignature(body);
      const inlineHtml = juice(htmlWithSignature);

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mailboxId: ticket.mailbox_id,
          to: to,
          subject: subject,
          body: inlineHtml,
          ticketId: ticket.id,
          inReplyToMessageId: latestInboundEmail?.message_id,
          attachments: attachments.map(a => ({
            filename: a.filename,
            content_type: a.content_type,
            storage_path: a.storage_path
          }))
        })
      });

      const result = await response.json();

      if (!response.ok) {
        console.error('Erreur envoi email:', result);
        alert(`Erreur: ${result.error || 'Erreur lors de l\'envoi de l\'email'}`);
        return;
      }

      console.log('Email envoyé:', result);
      alert('Email envoyé avec succès');
      onSent();
      onClose();
    } catch (error) {
      console.error('Exception envoi email:', error);
      alert(`Erreur: ${error instanceof Error ? error.message : 'Erreur lors de l\'envoi de l\'email'}`);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[95vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">Composer un email</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="text-sm font-semibold text-emerald-900 mb-1">Suggestion intelligente par IA</h3>
                <p className="text-xs text-emerald-700">
                  L'IA analyse la conversation, l'historique du contact et les modeles pour suggerer une reponse
                </p>
              </div>
              <button
                onClick={handleSuggestResponse}
                disabled={generatingSuggestion}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-sm font-medium rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
              >
                {generatingSuggestion ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Analyse...
                  </>
                ) : (
                  <>
                    <Brain className="w-4 h-4" />
                    Suggerer
                  </>
                )}
              </button>
            </div>
            {suggestionInfo && (
              <div className="mt-3 pt-3 border-t border-emerald-200 space-y-2">
                <div>
                  <p className="text-xs font-medium text-emerald-900 mb-1">Raisonnement:</p>
                  <p className="text-xs text-emerald-700">{suggestionInfo.reasoning}</p>
                </div>
                {suggestionInfo.key_points && suggestionInfo.key_points.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-emerald-900 mb-1">Points cles:</p>
                    <ul className="text-xs text-emerald-700 list-disc list-inside space-y-0.5">
                      {suggestionInfo.key_points.map((point: string, idx: number) => (
                        <li key={idx}>{point}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <p className="text-xs font-medium text-emerald-900">Confiance:</p>
                  <div className="flex-1 bg-emerald-200 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-emerald-600 h-full"
                      style={{ width: `${(suggestionInfo.confidence || 0) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-emerald-700">{Math.round((suggestionInfo.confidence || 0) * 100)}%</span>
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Destinataire</label>
            <input
              type="email"
              value={to}
              onChange={e => setTo(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
              placeholder="destinataire@exemple.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Objet</label>
            <input
              type="text"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
              placeholder="Objet de l'email"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-sm font-medium text-slate-700">Idée pour l'IA</label>
              <button
                onClick={handleGenerateDraft}
                disabled={generatingDraft || !aiIdea.trim()}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white text-xs font-medium rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {generatingDraft ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Génération...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    Générer le brouillon
                  </>
                )}
              </button>
            </div>
            <textarea
              value={aiIdea}
              onChange={e => setAiIdea(e.target.value)}
              className="w-full px-3 py-2 bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
              placeholder="Décrivez brièvement l'idée du message que vous souhaitez envoyer, l'IA générera un brouillon complet..."
              rows={2}
            />
            <p className="text-xs text-slate-500 mt-1">
              Exemple: "Confirmer la visite prévue demain à 14h" ou "Expliquer les documents manquants"
            </p>
          </div>

          {signatures.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Signature</label>
              <div className="flex items-center gap-2">
                <PenTool className="w-4 h-4 text-slate-400" />
                <select
                  value={selectedSignature || ''}
                  onChange={(e) => setSelectedSignature(e.target.value || null)}
                  className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                >
                  <option value="">Aucune signature</option>
                  {signatures.map(sig => (
                    <option key={sig.id} value={sig.id}>
                      {sig.name} {sig.is_default && '(par défaut)'}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Message</label>
            <TipTapEditor
              content={body}
              onChange={setBody}
              placeholder="Tapez votre message ici..."
              minHeight="300px"
              onImageUpload={handleImageUpload}
              showHtmlMode={true}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Pièces jointes</label>
            <AttachmentsManager
              attachments={attachments}
              onAttachmentsChange={setAttachments}
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50">
          <button
            onClick={onClose}
            disabled={sending}
            className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 transition disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            onClick={handleSend}
            disabled={sending || !to || !subject || !body}
            className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-medium rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Envoi...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Envoyer
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
