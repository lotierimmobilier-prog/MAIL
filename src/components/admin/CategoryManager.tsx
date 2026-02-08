import { useEffect, useState } from 'react';
import { Plus, Edit3, Trash2, X, Sparkles } from 'lucide-react';
import Modal from '../ui/Modal';
import { supabase } from '../../lib/supabase';
import type { Category } from '../../lib/types';

export default function CategoryManager() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [editOpen, setEditOpen] = useState(false);
  const [selected, setSelected] = useState<Category | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#0891B2');
  const [keywords, setKeywords] = useState<string[]>([]);
  const [keywordInput, setKeywordInput] = useState('');
  const [classifying, setClassifying] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    const { data } = await supabase.from('categories').select('*').order('name');
    if (data) setCategories(data);
  }

  function openNew() {
    setSelected(null);
    setName('');
    setDescription('');
    setColor('#0891B2');
    setKeywords([]);
    setKeywordInput('');
    setEditOpen(true);
  }

  function openEdit(cat: Category) {
    setSelected(cat);
    setName(cat.name);
    setDescription(cat.description);
    setColor(cat.color);
    setKeywords((cat as any).keywords || []);
    setKeywordInput('');
    setEditOpen(true);
  }

  async function handleSave() {
    if (!name.trim()) return;
    const payload = { name, description, color, keywords };
    if (selected) {
      await supabase.from('categories').update(payload).eq('id', selected.id);
    } else {
      await supabase.from('categories').insert(payload);
    }
    setEditOpen(false);
    load();
  }

  function addKeyword() {
    const kw = keywordInput.trim().toLowerCase();
    if (kw && !keywords.includes(kw)) {
      setKeywords([...keywords, kw]);
      setKeywordInput('');
    }
  }

  function removeKeyword(kw: string) {
    setKeywords(keywords.filter(k => k !== kw));
  }

  function handleKeywordKeyPress(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      addKeyword();
    }
  }

  async function handleDelete(cat: Category) {
    if (!confirm(`Supprimer la catégorie "${cat.name}" ?`)) return;
    const { error } = await supabase.from('categories').delete().eq('id', cat.id);
    if (error) {
      alert(`Erreur lors de la suppression : ${error.message}`);
    }
    load();
  }

  async function handleBulkClassify() {
    if (!confirm('Classifier automatiquement tous les tickets non catégorisés ?\n\nL\'analyse va examiner le contenu de chaque email pour déterminer la meilleure catégorie en fonction des mots-clés définis.')) {
      return;
    }

    setClassifying(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;

      if (!token) {
        alert('Session expirée, veuillez vous reconnecter');
        return;
      }

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/bulk-classify-tickets`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ forceAll: false })
      });

      if (!response.ok) {
        const result = await response.json();
        alert(`Erreur : ${result.error || 'Erreur inconnue'}`);
        return;
      }

      const result = await response.json();
      alert(`Classification terminée !\n\n${result.message || 'Classification effectuée avec succès'}`);
    } catch (error) {
      console.error('Erreur lors de la classification:', error);
      const errorMessage = error instanceof Error && error.message
        ? error.message
        : 'Erreur de connexion. Vérifiez que la fonction edge est déployée.';
      alert(`Erreur lors de la classification : ${errorMessage}`);
    } finally {
      setClassifying(false);
    }
  }

  const PRESET_COLORS = ['#0891B2', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#EC4899', '#8B5CF6', '#6B7280'];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Catégories</h3>
          <p className="text-sm text-slate-500">Organisez les tickets et modèles par catégorie</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleBulkClassify}
            disabled={classifying || categories.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition"
          >
            <Sparkles className={`w-4 h-4 ${classifying ? 'animate-spin' : ''}`} />
            {classifying ? 'Classification en cours...' : 'Classifier tous les tickets'}
          </button>
          <button onClick={openNew} className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-medium rounded-lg transition">
            <Plus className="w-4 h-4" />
            Ajouter une catégorie
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {categories.map(cat => (
          <div key={cat.id} className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3">
            <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-900">{cat.name}</p>
              {cat.description && <p className="text-xs text-slate-500 truncate">{cat.description}</p>}
            </div>
            <button onClick={() => openEdit(cat)} className="p-1.5 rounded text-slate-400 hover:text-cyan-600 hover:bg-cyan-50 transition">
              <Edit3 className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => handleDelete(cat)} className="p-1.5 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 transition">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
      {categories.length === 0 && (
        <p className="text-sm text-slate-500 text-center py-8">Aucune catégorie pour le moment.</p>
      )}

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title={selected ? 'Modifier la catégorie' : 'Nouvelle catégorie'} size="sm">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Nom</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
            <input type="text" value={description} onChange={e => setDescription(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Mots-cles pour l'IA</label>
            <p className="text-xs text-slate-500 mb-2">Ces mots-cles aident l'IA a categoriser automatiquement les emails</p>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={keywordInput}
                onChange={e => setKeywordInput(e.target.value)}
                onKeyPress={handleKeywordKeyPress}
                placeholder="visite, rendez-vous..."
                className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
              />
              <button
                onClick={addKeyword}
                type="button"
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-lg transition"
              >
                Ajouter
              </button>
            </div>
            {keywords.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {keywords.map(kw => (
                  <span
                    key={kw}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-cyan-50 text-cyan-700 text-xs rounded-full"
                  >
                    {kw}
                    <button
                      onClick={() => removeKeyword(kw)}
                      type="button"
                      className="hover:bg-cyan-100 rounded-full p-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Couleur</label>
            <div className="flex items-center gap-2">
              {PRESET_COLORS.map(c => (
                <button key={c} onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-full border-2 transition ${color === c ? 'border-slate-900 scale-110' : 'border-transparent'}`}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setEditOpen(false)} className="px-4 py-2 text-sm text-slate-600">Annuler</button>
            <button onClick={handleSave} disabled={!name.trim()}
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-medium rounded-lg transition disabled:opacity-50">
              {selected ? 'Enregistrer' : 'Créer'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
