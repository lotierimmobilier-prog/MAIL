import { format } from 'date-fns';
import { useState, useMemo } from 'react';
import { ArrowDownLeft, ArrowUpRight, Paperclip, Code, FileText, StickyNote } from 'lucide-react';
import type { Email, InternalNote } from '../../lib/types';
import { formatFileSize } from '../../lib/constants';
import { cleanEmailHtml, extractTextFromHtml } from '../../lib/emailUtils';

interface ConversationThreadProps {
  emails: Email[];
  notes?: InternalNote[];
}

type ConversationItem =
  | { type: 'email'; data: Email; timestamp: string }
  | { type: 'note'; data: InternalNote; timestamp: string };

export default function ConversationThread({ emails, notes = [] }: ConversationThreadProps) {
  const [viewModes, setViewModes] = useState<Record<string, 'html' | 'text' | 'raw'>>({});

  const conversationItems = useMemo(() => {
    const items: ConversationItem[] = [
      ...emails.map(email => ({
        type: 'email' as const,
        data: email,
        timestamp: email.received_at
      })),
      ...notes.map(note => ({
        type: 'note' as const,
        data: note,
        timestamp: note.created_at
      }))
    ];
    return items.sort((a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  }, [emails, notes]);

  function toggleViewMode(emailId: string) {
    setViewModes(prev => {
      const current = prev[emailId] || 'html';
      const next = current === 'html' ? 'text' : current === 'text' ? 'raw' : 'html';
      return { ...prev, [emailId]: next };
    });
  }

  return (
    <div className="space-y-4">
      {conversationItems.map((item, index) => {
        if (item.type === 'note') {
          const note = item.data;
          const author = note.author as { full_name: string } | undefined;

          return (
            <div
              key={`note-${note.id}`}
              className="bg-amber-50 rounded-xl border border-amber-200 overflow-hidden"
            >
              <div className="flex items-start gap-3 px-5 py-3.5 border-b border-amber-100 bg-amber-100/50">
                <div className="mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center shrink-0 bg-amber-200">
                  <StickyNote className="w-3.5 h-3.5 text-amber-700" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-amber-900">
                      {author?.full_name || 'Utilisateur'}
                    </span>
                    <span className="text-xs px-1.5 py-0.5 rounded font-medium bg-amber-200 text-amber-700">
                      Note interne
                    </span>
                  </div>
                  <p className="text-xs text-amber-600 mt-0.5">
                    Visible uniquement par l'équipe
                  </p>
                </div>
                <span className="text-xs text-amber-500 shrink-0">
                  {format(new Date(note.created_at), 'MMM d, yyyy HH:mm')}
                </span>
              </div>
              <div className="px-5 py-4">
                <pre className="text-sm text-amber-900 whitespace-pre-wrap font-sans leading-relaxed">
                  {note.content}
                </pre>
              </div>
            </div>
          );
        }

        const email = item.data;
        const isInbound = email.direction === 'inbound';
        const DirectionIcon = isInbound ? ArrowDownLeft : ArrowUpRight;
        const viewMode = viewModes[email.id] || 'html';

        return (
          <div
            key={`email-${email.id}`}
            className={`bg-white rounded-xl border ${
              isInbound ? 'border-slate-200' : 'border-cyan-200 bg-cyan-50/30'
            } overflow-hidden`}
          >
            <div className="flex items-start gap-3 px-5 py-3.5 border-b border-slate-100">
              <div
                className={`mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                  isInbound ? 'bg-slate-100' : 'bg-cyan-100'
                }`}
              >
                <DirectionIcon className={`w-3.5 h-3.5 ${isInbound ? 'text-slate-500' : 'text-cyan-600'}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-900">
                    {email.from_name || email.from_address}
                  </span>
                  <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                    isInbound ? 'bg-slate-100 text-slate-500' : 'bg-cyan-100 text-cyan-600'
                  }`}>
                    {isInbound ? 'Reçu' : 'Envoyé'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  To: {email.to_addresses?.join(', ')}
                  {email.cc_addresses?.length > 0 && ` | CC: ${email.cc_addresses.join(', ')}`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 shrink-0">
                  {format(new Date(email.received_at), 'MMM d, yyyy HH:mm')}
                </span>
                {email.body_html && (
                  <button
                    onClick={() => toggleViewMode(email.id)}
                    className="flex items-center gap-1 px-2 py-1 text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded transition"
                    title={viewMode === 'html' ? 'Voir le texte brut' : viewMode === 'text' ? 'Voir le HTML brut' : 'Voir le HTML nettoyé'}
                  >
                    {viewMode === 'html' ? (
                      <>
                        <FileText className="w-3 h-3" />
                        <span>Texte</span>
                      </>
                    ) : viewMode === 'text' ? (
                      <>
                        <Code className="w-3 h-3" />
                        <span>HTML</span>
                      </>
                    ) : (
                      <>
                        <FileText className="w-3 h-3" />
                        <span>Propre</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>

            <div className="px-5 py-4">
              {viewMode === 'raw' && email.body_html ? (
                <pre className="text-xs text-slate-600 whitespace-pre-wrap font-mono bg-slate-50 p-3 rounded border border-slate-200 overflow-x-auto">
                  {email.body_html}
                </pre>
              ) : viewMode === 'text' && email.body_html ? (
                <pre className="text-sm text-slate-700 whitespace-pre-wrap font-sans leading-relaxed">
                  {extractTextFromHtml(email.body_html) || email.body_text || 'Aucun contenu'}
                </pre>
              ) : email.body_html ? (
                <div
                  className="prose prose-sm max-w-none text-slate-700 prose-headings:text-slate-900 prose-a:text-cyan-600 prose-p:my-2"
                  dangerouslySetInnerHTML={{
                    __html: cleanEmailHtml(email.body_html)
                  }}
                />
              ) : (
                <pre className="text-sm text-slate-700 whitespace-pre-wrap font-sans leading-relaxed">
                  {email.body_text || 'Aucun contenu'}
                </pre>
              )}
            </div>

            {email.attachments && email.attachments.length > 0 && (
              <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50">
                <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-2">
                  <Paperclip className="w-3 h-3" />
                  <span>{email.attachments.length} pièce{email.attachments.length > 1 ? 's' : ''} jointe{email.attachments.length > 1 ? 's' : ''}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {email.attachments.map(att => (
                    <div
                      key={att.id}
                      className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs hover:border-cyan-300 transition cursor-pointer"
                    >
                      <Paperclip className="w-3 h-3 text-slate-400" />
                      <span className="text-slate-700 font-medium">{att.filename}</span>
                      <span className="text-slate-400">{formatFileSize(att.size_bytes)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
