import { useState, useEffect } from 'react';
import { X, Send, Loader2, Sparkles, PenTool } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import TipTapEditor, { juice } from '../ui/TipTapEditor';
import AttachmentsManager from './AttachmentsManager';
import type { Mailbox } from '../../lib/types';

interface NewEmailModalProps {
  onClose: () => void;
  onSent: () => void;
}

export default function NewEmailModal({ onClose, onSent }: NewEmailModalProps) {
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [selectedMailbox, setSelectedMailbox] = useState('');
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [idea, setIdea] = useState('');
  const [generating, setGenerating] = useState(false);
  const [attachments, setAttachments] = useState<any[]>([]);
  const [signatures, setSignatures] = useState<any[]>([]);
  const [selectedSignature, setSelectedSignature] = useState<string | null>(null);

  useEffect(() => {
    async function loadMailboxes() {
      const { data } = await supabase
        .from('mailboxes')
        .select('*')
        .eq('is_active', true)
        .order('name');
      if (data) {
        setMailboxes(data);
        if (data.length > 0) setSelectedMailbox(data[0].id);
      }
    }
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
    loadMailboxes();
    loadSignatures();
  }, []);

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

  async function handleGenerateFromIdea() {
    if (!idea.trim()) {
      alert('Veuillez entrer une idée pour le message');
      return;
    }

    setGenerating(true);
    try {
      const mailbox = mailboxes.find(mb => mb.id === selectedMailbox);
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-email-from-idea`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          idea,
          tone: mailbox?.tone || 'professional',
          signature: mailbox?.signature || '',
        })
      });

      const result = await response.json();

      if (!response.ok) {
        console.error('Erreur génération email:', result);
        alert(`Erreur: ${result.error || 'Erreur lors de la génération de l\'email'}`);
        return;
      }

      setSubject(result.subject || '');
      setBody(result.body || '');
    } catch (error) {
      console.error('Exception génération email:', error);
      alert(`Erreur: ${error instanceof Error ? error.message : 'Erreur lors de la génération de l\'email'}`);
    } finally {
      setGenerating(false);
    }
  }

  async function handleSend() {
    if (!to || !subject || !body || !selectedMailbox) {
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

      const htmlWithSignature = insertSignature(body);
      const inlineHtml = juice(htmlWithSignature);

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mailboxId: selectedMailbox,
          to,
          subject,
          body: inlineHtml,
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
          <h2 className="text-lg font-semibold text-slate-900">Nouveau message</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Boîte mail d'envoi</label>
            <select
              value={selectedMailbox}
              onChange={e => setSelectedMailbox(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
            >
              {mailboxes.map(mb => (
                <option key={mb.id} value={mb.id}>
                  {mb.name} ({mb.email_address})
                </option>
              ))}
            </select>
          </div>

          <div className="bg-gradient-to-br from-violet-50 to-fuchsia-50 border border-violet-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-semibold text-violet-900">Idee pour l'IA</label>
              <button
                onClick={handleGenerateFromIdea}
                disabled={generating || !idea.trim()}
                className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 text-white text-xs font-medium rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {generating ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Generation...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    Generer le brouillon
                  </>
                )}
              </button>
            </div>
            <textarea
              value={idea}
              onChange={e => setIdea(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-violet-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 font-sans resize-none"
              placeholder="Decrivez brievement l'idee du message que vous souhaitez envoyer, l'IA generera un brouillon complet..."
              rows={3}
            />
            <p className="text-xs text-violet-700 mt-2">
              Exemple: "Confirmer la visite prevue demain a 14h" ou "Expliquer les documents manquants"
            </p>
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
            disabled={sending || !to || !subject || !body || !selectedMailbox}
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
