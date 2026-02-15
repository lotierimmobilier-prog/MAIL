import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Underline } from '@tiptap/extension-underline';
import { TextAlign } from '@tiptap/extension-text-align';
import { Link } from '@tiptap/extension-link';
import { Image } from '@tiptap/extension-image';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { useState, useEffect, useCallback } from 'react';
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  List, ListOrdered, Quote, Minus, Image as ImageIcon,
  Link2, Table as TableIcon, Code, Undo, Redo,
  Type, Palette, Heading1, Heading2, Heading3
} from 'lucide-react';
import DOMPurify from 'dompurify';
import juice from 'juice';

interface TipTapEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: string;
  onImageUpload?: (file: File) => Promise<string>;
  showHtmlMode?: boolean;
}

export default function TipTapEditor({
  content,
  onChange,
  placeholder = 'Écrivez votre message...',
  minHeight = '300px',
  onImageUpload,
  showHtmlMode = true
}: TipTapEditorProps) {
  const [showHtml, setShowHtml] = useState(false);
  const [htmlContent, setHtmlContent] = useState('');
  const [textColor, setTextColor] = useState('#000000');
  const [bgColor, setBgColor] = useState('#ffffff');

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Underline,
      TextStyle,
      Color,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          target: '_blank',
          rel: 'noopener noreferrer',
        },
      }),
      Image.configure({
        inline: true,
        allowBase64: true,
      }),
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: content,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      const sanitized = DOMPurify.sanitize(html, {
        ALLOWED_TAGS: [
          'p', 'br', 'strong', 'em', 'u', 's', 'h1', 'h2', 'h3',
          'ul', 'ol', 'li', 'blockquote', 'a', 'img', 'hr',
          'table', 'thead', 'tbody', 'tr', 'th', 'td', 'span', 'div'
        ],
        ALLOWED_ATTR: [
          'href', 'target', 'rel', 'src', 'alt', 'title',
          'style', 'class', 'align', 'width', 'height',
          'colspan', 'rowspan', 'color'
        ],
        ALLOW_DATA_ATTR: false,
      });
      onChange(sanitized);
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none p-4',
        style: `min-height: ${minHeight}`,
      },
    },
  });

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  useEffect(() => {
    if (editor && showHtml) {
      setHtmlContent(editor.getHTML());
    }
  }, [showHtml, editor]);

  const toggleHtmlMode = () => {
    if (showHtml && editor) {
      const sanitized = DOMPurify.sanitize(htmlContent);
      editor.commands.setContent(sanitized);
      onChange(sanitized);
    }
    setShowHtml(!showHtml);
  };

  const addLink = useCallback(() => {
    if (!editor) return;
    const url = window.prompt('Entrez l\'URL:');
    if (url) {
      editor.chain().focus().setLink({ href: url }).run();
    }
  }, [editor]);

  const addImage = useCallback(async () => {
    if (!editor) return;

    if (onImageUpload) {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) {
          try {
            const url = await onImageUpload(file);
            editor.chain().focus().setImage({ src: url }).run();
          } catch (error) {
            console.error('Error uploading image:', error);
            alert('Erreur lors du téléchargement de l\'image');
          }
        }
      };
      input.click();
    } else {
      const url = window.prompt('Entrez l\'URL de l\'image:');
      if (url) {
        editor.chain().focus().setImage({ src: url }).run();
      }
    }
  }, [editor, onImageUpload]);

  const insertTable = useCallback(() => {
    if (!editor) return;
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  }, [editor]);

  const setTextColorHandler = useCallback(() => {
    if (!editor) return;
    editor.chain().focus().setColor(textColor).run();
  }, [editor, textColor]);

  const setBgColorHandler = useCallback(() => {
    if (!editor) return;
    editor.chain().focus().toggleHighlight({ color: bgColor }).run();
  }, [editor, bgColor]);

  const exportToInlineStyles = () => {
    if (!editor) return '';
    const html = editor.getHTML();

    const wrappedHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          p { margin: 0 0 1em 0; }
          h1, h2, h3 { margin: 1em 0 0.5em 0; font-weight: bold; }
          h1 { font-size: 24px; }
          h2 { font-size: 20px; }
          h3 { font-size: 18px; }
          ul, ol { margin: 0 0 1em 0; padding-left: 2em; }
          blockquote { border-left: 3px solid #ccc; margin: 1em 0; padding-left: 1em; color: #666; }
          table { border-collapse: collapse; width: 100%; margin: 1em 0; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f5f5f5; font-weight: bold; }
          a { color: #0066cc; text-decoration: none; }
          img { max-width: 100%; height: auto; }
        </style>
      </head>
      <body>${html}</body>
      </html>
    `;

    return juice(wrappedHtml);
  };

  if (!editor) {
    return null;
  }

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
      {!showHtml && (
        <div className="flex flex-wrap items-center gap-0.5 p-2 border-b border-slate-200 bg-slate-50">
          <button
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
            className="p-2 hover:bg-slate-200 rounded transition disabled:opacity-30"
            title="Annuler"
          >
            <Undo className="w-4 h-4 text-slate-600" />
          </button>
          <button
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
            className="p-2 hover:bg-slate-200 rounded transition disabled:opacity-30"
            title="Rétablir"
          >
            <Redo className="w-4 h-4 text-slate-600" />
          </button>

          <div className="w-px h-6 bg-slate-300 mx-1" />

          <button
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            className={`p-2 hover:bg-slate-200 rounded transition ${editor.isActive('heading', { level: 1 }) ? 'bg-slate-200' : ''}`}
            title="Titre 1"
          >
            <Heading1 className="w-4 h-4 text-slate-600" />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            className={`p-2 hover:bg-slate-200 rounded transition ${editor.isActive('heading', { level: 2 }) ? 'bg-slate-200' : ''}`}
            title="Titre 2"
          >
            <Heading2 className="w-4 h-4 text-slate-600" />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            className={`p-2 hover:bg-slate-200 rounded transition ${editor.isActive('heading', { level: 3 }) ? 'bg-slate-200' : ''}`}
            title="Titre 3"
          >
            <Heading3 className="w-4 h-4 text-slate-600" />
          </button>

          <div className="w-px h-6 bg-slate-300 mx-1" />

          <button
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={`p-2 hover:bg-slate-200 rounded transition ${editor.isActive('bold') ? 'bg-slate-200' : ''}`}
            title="Gras"
          >
            <Bold className="w-4 h-4 text-slate-600" />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={`p-2 hover:bg-slate-200 rounded transition ${editor.isActive('italic') ? 'bg-slate-200' : ''}`}
            title="Italique"
          >
            <Italic className="w-4 h-4 text-slate-600" />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            className={`p-2 hover:bg-slate-200 rounded transition ${editor.isActive('underline') ? 'bg-slate-200' : ''}`}
            title="Souligné"
          >
            <UnderlineIcon className="w-4 h-4 text-slate-600" />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleStrike().run()}
            className={`p-2 hover:bg-slate-200 rounded transition ${editor.isActive('strike') ? 'bg-slate-200' : ''}`}
            title="Barré"
          >
            <Strikethrough className="w-4 h-4 text-slate-600" />
          </button>

          <div className="w-px h-6 bg-slate-300 mx-1" />

          <div className="flex items-center gap-1">
            <input
              type="color"
              value={textColor}
              onChange={(e) => setTextColor(e.target.value)}
              className="w-6 h-6 rounded cursor-pointer"
              title="Couleur du texte"
            />
            <button
              onClick={setTextColorHandler}
              className="p-2 hover:bg-slate-200 rounded transition"
              title="Appliquer couleur texte"
            >
              <Type className="w-4 h-4 text-slate-600" />
            </button>
          </div>

          <div className="w-px h-6 bg-slate-300 mx-1" />

          <button
            onClick={() => editor.chain().focus().setTextAlign('left').run()}
            className={`p-2 hover:bg-slate-200 rounded transition ${editor.isActive({ textAlign: 'left' }) ? 'bg-slate-200' : ''}`}
            title="Aligner à gauche"
          >
            <AlignLeft className="w-4 h-4 text-slate-600" />
          </button>
          <button
            onClick={() => editor.chain().focus().setTextAlign('center').run()}
            className={`p-2 hover:bg-slate-200 rounded transition ${editor.isActive({ textAlign: 'center' }) ? 'bg-slate-200' : ''}`}
            title="Centrer"
          >
            <AlignCenter className="w-4 h-4 text-slate-600" />
          </button>
          <button
            onClick={() => editor.chain().focus().setTextAlign('right').run()}
            className={`p-2 hover:bg-slate-200 rounded transition ${editor.isActive({ textAlign: 'right' }) ? 'bg-slate-200' : ''}`}
            title="Aligner à droite"
          >
            <AlignRight className="w-4 h-4 text-slate-600" />
          </button>
          <button
            onClick={() => editor.chain().focus().setTextAlign('justify').run()}
            className={`p-2 hover:bg-slate-200 rounded transition ${editor.isActive({ textAlign: 'justify' }) ? 'bg-slate-200' : ''}`}
            title="Justifier"
          >
            <AlignJustify className="w-4 h-4 text-slate-600" />
          </button>

          <div className="w-px h-6 bg-slate-300 mx-1" />

          <button
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={`p-2 hover:bg-slate-200 rounded transition ${editor.isActive('bulletList') ? 'bg-slate-200' : ''}`}
            title="Liste à puces"
          >
            <List className="w-4 h-4 text-slate-600" />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={`p-2 hover:bg-slate-200 rounded transition ${editor.isActive('orderedList') ? 'bg-slate-200' : ''}`}
            title="Liste numérotée"
          >
            <ListOrdered className="w-4 h-4 text-slate-600" />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            className={`p-2 hover:bg-slate-200 rounded transition ${editor.isActive('blockquote') ? 'bg-slate-200' : ''}`}
            title="Citation"
          >
            <Quote className="w-4 h-4 text-slate-600" />
          </button>

          <div className="w-px h-6 bg-slate-300 mx-1" />

          <button
            onClick={addLink}
            className="p-2 hover:bg-slate-200 rounded transition"
            title="Insérer un lien"
          >
            <Link2 className="w-4 h-4 text-slate-600" />
          </button>
          <button
            onClick={addImage}
            className="p-2 hover:bg-slate-200 rounded transition"
            title="Insérer une image"
          >
            <ImageIcon className="w-4 h-4 text-slate-600" />
          </button>
          <button
            onClick={insertTable}
            className="p-2 hover:bg-slate-200 rounded transition"
            title="Insérer un tableau"
          >
            <TableIcon className="w-4 h-4 text-slate-600" />
          </button>
          <button
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
            className="p-2 hover:bg-slate-200 rounded transition"
            title="Ligne horizontale"
          >
            <Minus className="w-4 h-4 text-slate-600" />
          </button>

          {showHtmlMode && (
            <>
              <div className="w-px h-6 bg-slate-300 mx-1" />
              <button
                onClick={toggleHtmlMode}
                className="p-2 hover:bg-slate-200 rounded transition"
                title="Mode HTML"
              >
                <Code className="w-4 h-4 text-slate-600" />
              </button>
            </>
          )}
        </div>
      )}

      {showHtml ? (
        <div className="p-4">
          <textarea
            value={htmlContent}
            onChange={(e) => setHtmlContent(e.target.value)}
            className="w-full h-96 p-4 bg-slate-900 text-green-400 font-mono text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
            spellCheck={false}
          />
          <div className="flex justify-end gap-2 mt-2">
            <button
              onClick={toggleHtmlMode}
              className="px-4 py-2 text-sm bg-slate-600 hover:bg-slate-700 text-white rounded-lg transition"
            >
              Retour à l'éditeur
            </button>
          </div>
        </div>
      ) : (
        <EditorContent editor={editor} />
      )}

      <style>{`
        .ProseMirror {
          outline: none;
        }
        .ProseMirror p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          color: #94a3b8;
          pointer-events: none;
          height: 0;
        }
        .ProseMirror table {
          border-collapse: collapse;
          table-layout: fixed;
          width: 100%;
          margin: 1em 0;
          overflow: hidden;
        }
        .ProseMirror td, .ProseMirror th {
          min-width: 1em;
          border: 2px solid #cbd5e1;
          padding: 8px 12px;
          vertical-align: top;
          box-sizing: border-box;
          position: relative;
        }
        .ProseMirror th {
          font-weight: bold;
          text-align: left;
          background-color: #f8fafc;
        }
        .ProseMirror .selectedCell:after {
          z-index: 2;
          position: absolute;
          content: "";
          left: 0;
          right: 0;
          top: 0;
          bottom: 0;
          background: rgba(200, 200, 255, 0.4);
          pointer-events: none;
        }
      `}</style>
    </div>
  );
}

export { juice };
