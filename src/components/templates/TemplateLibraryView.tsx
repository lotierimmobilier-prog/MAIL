import { useEffect, useState } from 'react';
import { Plus, Search, FileText } from 'lucide-react';
import Header from '../layout/Header';
import TemplateCard from './TemplateCard';
import TemplateEditorModal from './TemplateEditorModal';
import TemplateHistoryModal from './TemplateHistoryModal';
import EmptyState from '../ui/EmptyState';
import LoadingSpinner from '../ui/LoadingSpinner';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { EmailTemplate, Category } from '../../lib/types';

export default function TemplateLibraryView() {
  const { canManage } = useAuth();
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const [tmplRes, catRes] = await Promise.all([
      supabase.from('email_templates').select('*, category:categories(name, color)').order('name'),
      supabase.from('categories').select('*').order('name'),
    ]);
    if (tmplRes.data) setTemplates(tmplRes.data);
    if (catRes.data) setCategories(catRes.data);
    setLoading(false);
  }

  const filtered = templates.filter(t => {
    if (search) {
      const q = search.toLowerCase();
      if (!t.name.toLowerCase().includes(q) && !t.description.toLowerCase().includes(q) && !t.body.toLowerCase().includes(q)) return false;
    }
    if (filterCategory && t.category_id !== filterCategory) return false;
    return true;
  });

  function handleEdit(template: EmailTemplate) {
    setSelectedTemplate(template);
    setEditorOpen(true);
  }

  function handleHistory(template: EmailTemplate) {
    setSelectedTemplate(template);
    setHistoryOpen(true);
  }

  async function handleDelete(template: EmailTemplate) {
    if (!confirm(`Supprimer le modèle "${template.name}" ?`)) return;
    await supabase.from('email_templates').delete().eq('id', template.id);
    loadData();
  }

  function handleNew() {
    setSelectedTemplate(null);
    setEditorOpen(true);
  }

  return (
    <div className="min-h-screen">
      <Header title="Bibliothèque de modèles" subtitle={`${filtered.length} modèle${filtered.length !== 1 ? 's' : ''}`} />

      <div className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Rechercher des modèles..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition"
            />
          </div>
          <select
            value={filterCategory}
            onChange={e => setFilterCategory(e.target.value)}
            className="px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
          >
            <option value="">Toutes les catégories</option>
            {categories.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <button
            onClick={handleNew}
            className="flex items-center gap-2 px-4 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-medium rounded-lg transition shrink-0"
          >
            <Plus className="w-4 h-4" />
            Nouveau modèle
          </button>
        </div>

        {loading ? (
          <LoadingSpinner />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="Aucun modèle"
            description="Créez des modèles d'email réutilisables pour accélérer votre flux de travail."
            action={{ label: 'Créer un modèle', onClick: handleNew }}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map(t => (
              <TemplateCard
                key={t.id}
                template={t}
                onEdit={() => handleEdit(t)}
                onViewHistory={() => handleHistory(t)}
                onDelete={() => handleDelete(t)}
                canManage={canManage}
              />
            ))}
          </div>
        )}
      </div>

      <TemplateEditorModal
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        template={selectedTemplate}
        categories={categories}
        onSaved={loadData}
      />

      <TemplateHistoryModal
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        template={selectedTemplate}
        onRollback={loadData}
      />
    </div>
  );
}
