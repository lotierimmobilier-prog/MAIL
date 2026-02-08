import { Paperclip, Download, FileText, Image, FileArchive, File } from 'lucide-react';
import { formatFileSize } from '../../lib/constants';
import { supabase } from '../../lib/supabase';
import type { Attachment } from '../../lib/types';

interface AttachmentsPanelProps {
  attachments: Attachment[];
}

function getFileIcon(filename: string) {
  const ext = filename.split('.').pop()?.toLowerCase();

  if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(ext || '')) {
    return Image;
  }
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext || '')) {
    return FileArchive;
  }
  if (['pdf', 'doc', 'docx', 'txt', 'odt'].includes(ext || '')) {
    return FileText;
  }
  return File;
}

export default function AttachmentsPanel({ attachments }: AttachmentsPanelProps) {
  if (attachments.length === 0) {
    return null;
  }

  async function handleDownload(attachment: Attachment) {
    try {
      if (!attachment.storage_path) {
        console.error('Aucun chemin de stockage pour cette pièce jointe');
        return;
      }

      const { data, error } = await supabase.storage
        .from('attachments')
        .download(attachment.storage_path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = attachment.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Erreur lors du téléchargement:', error);
      alert('Impossible de télécharger la pièce jointe');
    }
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-200 bg-slate-50/50">
        <div className="flex items-center gap-2">
          <Paperclip className="w-4 h-4 text-slate-400" />
          <h3 className="text-sm font-semibold text-slate-900">
            Pièces jointes ({attachments.length})
          </h3>
        </div>
      </div>

      <div className="p-4">
        <div className="space-y-2">
          {attachments.map(attachment => {
            const FileIcon = getFileIcon(attachment.filename);

            return (
              <div
                key={attachment.id}
                className="flex items-center gap-3 p-3 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 hover:border-slate-300 transition group"
              >
                <div className="shrink-0 w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center">
                  <FileIcon className="w-4 h-4 text-slate-400" />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">
                    {attachment.filename}
                  </p>
                  <p className="text-xs text-slate-500">
                    {formatFileSize(attachment.size_bytes)}
                    {attachment.content_type && (
                      <span className="ml-2 text-slate-400">
                        {attachment.content_type.split('/')[1]?.toUpperCase()}
                      </span>
                    )}
                  </p>
                </div>

                <button
                  onClick={() => handleDownload(attachment)}
                  className="shrink-0 p-2 text-slate-400 hover:text-cyan-600 hover:bg-white rounded-lg transition opacity-0 group-hover:opacity-100"
                  title="Télécharger"
                >
                  <Download className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
