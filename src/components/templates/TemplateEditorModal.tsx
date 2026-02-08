import { useState, useEffect } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import Modal from '../ui/Modal';
import { supabase } from '../../lib/supabase';
import { extractTemplateVariables } from '../../lib/constants';
import type { EmailTemplate, Category } from '../../lib/types';

interface TemplateEditorModalProps {
  open: boolean;
  onClose: () => void;
  template: EmailTemplate | null;
  categories: Category[];
  onSaved: () => void;
}

export default function TemplateEditorModal({ open, onClose, template, categories, onSaved }: TemplateEditorModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [changeNote, setChangeNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');

  useEffect(() => {
    if (template) {
      setName(template.name);
      setDescription(template.description);
      setSubject(template.subject);
      setBody(template.body);
      setCategoryId(template.category_id ?? '');
      setChangeNote('');
    } else {
      setName('');
      setDescription('');
      setSubject('');
      setBody('');
      setCategoryId('');
      setChangeNote('');
    }
  }, [template, open]);

  async function handleSave() {
    if (!name.trim() || !body.trim()) return;

    setSaving(true);
    const variables = extractTemplateVariables(body + ' ' + subject);

    if (template) {
      const newVersion = template.version + 1;

      await supabase.from('template_versions').insert({
        template_id: template.id,
        version: template.version,
        name: template.name,
        subject: template.subject,
        body: template.body,
        variables: template.variables,
        change_note: changeNote,
      });

      await supabase.from('email_templates').update({
        name,
        description,
        subject,
        body,
        category_id: categoryId || null,
        variables,
        version: newVersion,
        updated_at: new Date().toISOString(),
      }).eq('id', template.id);
    } else {
      await supabase.from('email_templates').insert({
        name,
        description,
        subject,
        body,
        category_id: categoryId || null,
        variables,
      });
    }

    setSaving(false);
    onSaved();
    onClose();
  }

  async function handleAiGenerate() {
    if (!aiPrompt.trim()) return;
    setAiGenerating(true);
    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-template`;
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt: aiPrompt }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.name) setName(data.name);
        if (data.subject) setSubject(data.subject);
        if (data.body) setBody(data.body);
        if (data.description) setDescription(data.description);
      }
    } catch {
      // Edge function may not be deployed yet
    }
    setAiGenerating(false);
  }

  return (
    <Modal open={open} onClose={onClose} title={template ? 'Modifier le modèle' : 'Nouveau modèle'} size="lg">
      <div className="space-y-4">
        <div className="bg-cyan-50 rounded-lg p-4 border border-cyan-100">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-cyan-600" />
            <span className="text-sm font-medium text-cyan-800">Générateur de modèles IA</span>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={aiPrompt}
              onChange={e => setAiPrompt(e.target.value)}
              placeholder="Décrivez le modèle dont vous avez besoin (ex: 'Email de bienvenue pour nouveaux locataires')"
              className="flex-1 px-3 py-2 bg-white border border-cyan-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
            />
            <button
              onClick={handleAiGenerate}
              disabled={aiGenerating || !aiPrompt.trim()}
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-medium rounded-lg transition disabled:opacity-50"
            >
              {aiGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Générer'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Nom du modèle</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
              placeholder="ex: Email de bienvenue"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Catégorie</label>
            <select
              value={categoryId}
              onChange={e => setCategoryId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
            >
              <option value="">Aucune catégorie</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
          <input
            type="text"
            value={description}
            onChange={e => setDescription(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
            placeholder="Brève description de l'objectif de ce modèle"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Ligne d'objet</label>
          <input
            type="text"
            value={subject}
            onChange={e => setSubject(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
            placeholder="Objet de l'email (supporte les {{variables}})"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Corps</label>
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            rows={10}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 font-mono"
            placeholder="Corps du modèle. Utilisez {{nom_variable}} pour les valeurs dynamiques."
          />
          {body && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {extractTemplateVariables(body + ' ' + subject).map(v => (
                <span key={v} className="px-1.5 py-0.5 bg-cyan-50 text-cyan-700 text-xs rounded font-mono">
                  {`{{${v}}}`}
                </span>
              ))}
            </div>
          )}
        </div>

        {template && (
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Note de modification</label>
            <input
              type="text"
              value={changeNote}
              onChange={e => setChangeNote(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
              placeholder="Décrivez ce qui a changé (pour l'historique des versions)"
            />
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 transition"
          >
            Annuler
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !name.trim() || !body.trim()}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-medium rounded-lg transition disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : template ? 'Enregistrer les modifications' : 'Créer le modèle'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
