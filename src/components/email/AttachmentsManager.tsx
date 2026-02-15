import { useState, useRef } from 'react';
import { Paperclip, X, FileText, Image as ImageIcon, File, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface Attachment {
  id: string;
  filename: string;
  content_type: string;
  file_size: number;
  storage_path: string;
  file?: File;
}

interface AttachmentsManagerProps {
  attachments: Attachment[];
  onAttachmentsChange: (attachments: Attachment[]) => void;
  maxSize?: number;
  allowedTypes?: string[];
}

export default function AttachmentsManager({
  attachments,
  onAttachmentsChange,
  maxSize = 50 * 1024 * 1024,
  allowedTypes = ['image/*', 'application/pdf', '.doc', '.docx', '.xls', '.xlsx', '.txt', '.csv', '.zip']
}: AttachmentsManagerProps) {
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const getFileIcon = (contentType: string) => {
    if (contentType.startsWith('image/')) return <ImageIcon className="w-4 h-4" />;
    if (contentType === 'application/pdf') return <FileText className="w-4 h-4" />;
    return <File className="w-4 h-4" />;
  };

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFilesChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const totalSize = [...attachments, ...files].reduce((sum, item) => {
      return sum + ('file_size' in item ? item.file_size : item.size);
    }, 0);

    if (totalSize > maxSize) {
      alert(`La taille totale des fichiers ne peut pas dépasser ${formatFileSize(maxSize)}`);
      return;
    }

    setUploading(true);
    try {
      const newAttachments: Attachment[] = [];

      for (const file of files) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
        const filePath = `attachments/${fileName}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('attachments')
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError) {
          console.error('Upload error:', uploadError);
          alert(`Erreur lors du téléchargement de ${file.name}: ${uploadError.message}`);
          continue;
        }

        if (!uploadData) {
          console.error('No upload data returned');
          alert(`Erreur: aucune donnée retournée pour ${file.name}`);
          continue;
        }

        newAttachments.push({
          id: fileName,
          filename: file.name,
          content_type: file.type,
          file_size: file.size,
          storage_path: filePath,
          file
        });
      }

      onAttachmentsChange([...attachments, ...newAttachments]);
    } catch (error) {
      console.error('Error uploading files:', error);
      alert('Erreur lors du téléchargement des fichiers');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveAttachment = async (attachment: Attachment) => {
    try {
      if (attachment.storage_path) {
        await supabase.storage
          .from('attachments')
          .remove([attachment.storage_path]);
      }

      onAttachmentsChange(attachments.filter(a => a.id !== attachment.id));
    } catch (error) {
      console.error('Error removing attachment:', error);
      alert('Erreur lors de la suppression de la pièce jointe');
    }
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget === dropZoneRef.current) {
      setDragging(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    const totalSize = [...attachments, ...files].reduce((sum, item) => {
      return sum + ('file_size' in item ? item.file_size : item.size);
    }, 0);

    if (totalSize > maxSize) {
      alert(`La taille totale des fichiers ne peut pas dépasser ${formatFileSize(maxSize)}`);
      return;
    }

    setUploading(true);
    try {
      const newAttachments: Attachment[] = [];

      for (const file of files) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
        const filePath = `attachments/${fileName}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('attachments')
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError) {
          console.error('Upload error:', uploadError);
          alert(`Erreur lors du téléchargement de ${file.name}: ${uploadError.message}`);
          continue;
        }

        if (!uploadData) {
          console.error('No upload data returned');
          alert(`Erreur: aucune donnée retournée pour ${file.name}`);
          continue;
        }

        newAttachments.push({
          id: fileName,
          filename: file.name,
          content_type: file.type,
          file_size: file.size,
          storage_path: filePath,
          file
        });
      }

      onAttachmentsChange([...attachments, ...newAttachments]);
    } catch (error) {
      console.error('Error uploading files:', error);
      alert('Erreur lors du téléchargement des fichiers');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <div
        ref={dropZoneRef}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-lg p-4 transition-colors ${
          dragging
            ? 'border-cyan-500 bg-cyan-50'
            : 'border-slate-200 bg-slate-50'
        }`}
      >
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleFileSelect}
              disabled={uploading}
              className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition disabled:opacity-50"
            >
              {uploading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Paperclip className="w-4 h-4" />
              )}
              <span>Joindre des fichiers</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={allowedTypes.join(',')}
              onChange={handleFilesChange}
              className="hidden"
            />
          </div>
          <p className="text-xs text-slate-500 text-center">
            ou glissez-déposez vos fichiers ici
          </p>
        </div>

        {dragging && (
          <div className="absolute inset-0 flex items-center justify-center bg-cyan-500/10 rounded-lg pointer-events-none">
            <p className="text-cyan-700 font-medium">Déposez vos fichiers ici</p>
          </div>
        )}
      </div>

      {attachments.length > 0 && (
        <div className="mt-3 space-y-2">
          {attachments.map((attachment) => (
            <div
              key={attachment.id}
              className="flex items-center gap-3 p-2 bg-white border border-slate-200 rounded-lg"
            >
              <div className="flex-shrink-0 text-slate-400">
                {getFileIcon(attachment.content_type)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-900 truncate">{attachment.filename}</p>
                <p className="text-xs text-slate-500">{formatFileSize(attachment.file_size)}</p>
              </div>
              <button
                type="button"
                onClick={() => handleRemoveAttachment(attachment)}
                className="flex-shrink-0 p-1 text-slate-400 hover:text-red-500 rounded transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
          <p className="text-xs text-slate-500">
            Total: {formatFileSize(attachments.reduce((sum, a) => sum + a.file_size, 0))} / {formatFileSize(maxSize)}
          </p>
        </div>
      )}
    </div>
  );
}
