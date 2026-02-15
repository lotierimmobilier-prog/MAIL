import { useRef, useState, useEffect } from 'react';
import { Bold, Italic, Underline, Link2, Image, List, ListOrdered, AlignLeft, AlignCenter, AlignRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: string;
  allowImages?: boolean;
}

export default function RichTextEditor({
  value,
  onChange,
  placeholder = 'Écrivez votre message...',
  minHeight = '200px',
  allowImages = true
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value;
    }
  }, [value]);

  const handleInput = () => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const execCommand = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
    handleInput();
  };

  const handleImageUpload = async (file: File) => {
    if (!allowImages) return;

    try {
      setUploading(true);

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

      if (data?.publicUrl) {
        const img = `<img src="${data.publicUrl}" alt="${file.name}" style="max-width: 100%; height: auto;" />`;
        document.execCommand('insertHTML', false, img);
        handleInput();
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      alert('Erreur lors du téléchargement de l\'image');
    } finally {
      setUploading(false);
    }
  };

  const handleImageSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      handleImageUpload(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const insertLink = () => {
    const url = prompt('Entrez l\'URL:');
    if (url) {
      execCommand('createLink', url);
    }
  };

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
      <div className="flex items-center gap-1 p-2 border-b border-slate-200 bg-slate-50 flex-wrap">
        <button
          type="button"
          onClick={() => execCommand('bold')}
          className="p-2 hover:bg-slate-200 rounded transition"
          title="Gras"
        >
          <Bold className="w-4 h-4 text-slate-600" />
        </button>
        <button
          type="button"
          onClick={() => execCommand('italic')}
          className="p-2 hover:bg-slate-200 rounded transition"
          title="Italique"
        >
          <Italic className="w-4 h-4 text-slate-600" />
        </button>
        <button
          type="button"
          onClick={() => execCommand('underline')}
          className="p-2 hover:bg-slate-200 rounded transition"
          title="Souligné"
        >
          <Underline className="w-4 h-4 text-slate-600" />
        </button>

        <div className="w-px h-6 bg-slate-300 mx-1" />

        <button
          type="button"
          onClick={() => execCommand('justifyLeft')}
          className="p-2 hover:bg-slate-200 rounded transition"
          title="Aligner à gauche"
        >
          <AlignLeft className="w-4 h-4 text-slate-600" />
        </button>
        <button
          type="button"
          onClick={() => execCommand('justifyCenter')}
          className="p-2 hover:bg-slate-200 rounded transition"
          title="Centrer"
        >
          <AlignCenter className="w-4 h-4 text-slate-600" />
        </button>
        <button
          type="button"
          onClick={() => execCommand('justifyRight')}
          className="p-2 hover:bg-slate-200 rounded transition"
          title="Aligner à droite"
        >
          <AlignRight className="w-4 h-4 text-slate-600" />
        </button>

        <div className="w-px h-6 bg-slate-300 mx-1" />

        <button
          type="button"
          onClick={() => execCommand('insertUnorderedList')}
          className="p-2 hover:bg-slate-200 rounded transition"
          title="Liste à puces"
        >
          <List className="w-4 h-4 text-slate-600" />
        </button>
        <button
          type="button"
          onClick={() => execCommand('insertOrderedList')}
          className="p-2 hover:bg-slate-200 rounded transition"
          title="Liste numérotée"
        >
          <ListOrdered className="w-4 h-4 text-slate-600" />
        </button>

        <div className="w-px h-6 bg-slate-300 mx-1" />

        <button
          type="button"
          onClick={insertLink}
          className="p-2 hover:bg-slate-200 rounded transition"
          title="Insérer un lien"
        >
          <Link2 className="w-4 h-4 text-slate-600" />
        </button>

        {allowImages && (
          <>
            <button
              type="button"
              onClick={handleImageSelect}
              disabled={uploading}
              className="p-2 hover:bg-slate-200 rounded transition disabled:opacity-50"
              title="Insérer une image"
            >
              <Image className="w-4 h-4 text-slate-600" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
          </>
        )}
      </div>

      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        onPaste={(e) => {
          e.preventDefault();
          const text = e.clipboardData.getData('text/plain');
          document.execCommand('insertText', false, text);
        }}
        className="p-4 outline-none prose prose-sm max-w-none"
        style={{ minHeight }}
        data-placeholder={placeholder}
      />

      <style>{`
        [contenteditable][data-placeholder]:empty:before {
          content: attr(data-placeholder);
          color: #94a3b8;
          cursor: text;
        }
        [contenteditable] {
          white-space: pre-wrap;
          word-wrap: break-word;
        }
      `}</style>
    </div>
  );
}
