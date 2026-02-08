import { useEffect, useState } from 'react';
import { BookOpen, Plus, Link as LinkIcon, FileText, Trash2, Eye, EyeOff, Search, Filter } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { supabase } from '../../lib/supabase';
import Badge from '../ui/Badge';
import Modal from '../ui/Modal';

interface KnowledgeItem {
  id: string;
  title: string;
  type: string;
  category: string;
  content: string;
  file_url: string | null;
  source_url: string | null;
  is_active: boolean;
  created_at: string;
}

export default function KnowledgeBaseManager() {
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterType, setFilterType] = useState('');

  useEffect(() => {
    loadItems();
  }, []);

  async function loadItems() {
    const { data, error } = await supabase
      .from('knowledge_base_items')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Erreur lors du chargement des ressources:', error);
    }

    if (data) setItems(data);
    setLoading(false);
  }

  async function toggleActive(id: string, currentStatus: boolean) {
    await supabase
      .from('knowledge_base_items')
      .update({ is_active: !currentStatus })
      .eq('id', id);

    setItems(prev =>
      prev.map(item =>
        item.id === id ? { ...item, is_active: !currentStatus } : item
      )
    );
  }

  async function deleteItem(id: string) {
    if (!confirm('Supprimer cet élément de la base de connaissances ?')) return;
    await supabase.from('knowledge_base_items').delete().eq('id', id);
    setItems(prev => prev.filter(item => item.id !== id));
  }

  const filteredItems = items.filter(item => {
    const matchesSearch =
      !searchQuery ||
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.content.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory = !filterCategory || item.category === filterCategory;
    const matchesType = !filterType || item.type === filterType;

    return matchesSearch && matchesCategory && matchesType;
  });

  const categories = [...new Set(items.map(i => i.category))];
  const types = [...new Set(items.map(i => i.type))];

  return (
    <div className="flex-1 flex flex-col bg-slate-50">
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Base de connaissances</h2>
            <p className="text-sm text-slate-600 mt-1">
              Documents et ressources utilisés par l'IA pour générer les réponses
            </p>
          </div>
          <button
            onClick={() => {
              console.log('Bouton cliqué - Ouverture du modal');
              setShowAddModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            Ajouter une ressource
          </button>
        </div>

        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Rechercher..."
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
            />
          </div>

          <select
            value={filterCategory}
            onChange={e => setFilterCategory(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
          >
            <option value="">Toutes les catégories</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
          >
            <option value="">Tous les types</option>
            {types.map(type => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="text-center py-12 text-slate-500">Chargement...</div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-12">
            <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-600 font-medium">Aucun élément trouvé</p>
            <p className="text-sm text-slate-500 mt-1">
              {searchQuery || filterCategory || filterType
                ? 'Essayez de modifier vos filtres'
                : 'Ajoutez des documents et ressources pour enrichir la base de connaissances'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredItems.map(item => (
              <div
                key={item.id}
                className={`bg-white rounded-xl border border-slate-200 p-5 transition ${
                  !item.is_active ? 'opacity-60' : ''
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {item.type === 'url' ? (
                      <LinkIcon className="w-4 h-4 text-blue-500" />
                    ) : (
                      <FileText className="w-4 h-4 text-emerald-500" />
                    )}
                    <Badge label={item.category} color="#64748b" />
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => toggleActive(item.id, item.is_active)}
                      className="p-1.5 text-slate-400 hover:text-cyan-600 rounded transition"
                      title={item.is_active ? 'Désactiver' : 'Activer'}
                    >
                      {item.is_active ? (
                        <Eye className="w-4 h-4" />
                      ) : (
                        <EyeOff className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      onClick={() => deleteItem(item.id)}
                      className="p-1.5 text-slate-400 hover:text-red-600 rounded transition"
                      title="Supprimer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <h3 className="font-semibold text-slate-900 mb-2">{item.title}</h3>

                {item.source_url && (
                  <a
                    href={item.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:underline block mb-2 truncate"
                  >
                    {item.source_url}
                  </a>
                )}

                <p className="text-sm text-slate-600 line-clamp-3 mb-3">
                  {item.content || 'Aucun contenu disponible'}
                </p>

                <p className="text-xs text-slate-400">
                  Ajouté {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {showAddModal && (
        <AddKnowledgeModal
          onClose={() => setShowAddModal(false)}
          onAdded={() => {
            setShowAddModal(false);
            loadItems();
          }}
        />
      )}
    </div>
  );
}

function AddKnowledgeModal({
  onClose,
  onAdded,
}: {
  onClose: () => void;
  onAdded: () => void;
}) {
  const [type, setType] = useState<'url' | 'document'>('url');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('general');
  const [sourceUrl, setSourceUrl] = useState('');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    console.log('Modal AddKnowledge monté');
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.user) {
        alert('Vous devez être connecté pour ajouter une ressource');
        setSaving(false);
        return;
      }

      const { error } = await supabase.from('knowledge_base_items').insert({
        title,
        type,
        category,
        content,
        source_url: type === 'url' ? sourceUrl : null,
        created_by: session.session.user.id,
      });

      if (error) {
        console.error('Erreur lors de l\'ajout de la ressource:', error);
        alert('Erreur lors de l\'ajout de la ressource: ' + error.message);
        setSaving(false);
        return;
      }

      setSaving(false);
      onAdded();
    } catch (error) {
      console.error('Erreur:', error);
      alert('Une erreur est survenue lors de l\'ajout de la ressource');
      setSaving(false);
    }
  }

  return (
    <Modal open={true} title="Ajouter une ressource" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Type de ressource
          </label>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setType('url')}
              className={`flex-1 px-4 py-3 border-2 rounded-lg text-sm font-medium transition ${
                type === 'url'
                  ? 'border-cyan-500 bg-cyan-50 text-cyan-700'
                  : 'border-slate-200 text-slate-600 hover:border-slate-300'
              }`}
            >
              <LinkIcon className="w-4 h-4 mx-auto mb-1" />
              Lien web
            </button>
            <button
              type="button"
              onClick={() => setType('document')}
              className={`flex-1 px-4 py-3 border-2 rounded-lg text-sm font-medium transition ${
                type === 'document'
                  ? 'border-cyan-500 bg-cyan-50 text-cyan-700'
                  : 'border-slate-200 text-slate-600 hover:border-slate-300'
              }`}
            >
              <FileText className="w-4 h-4 mx-auto mb-1" />
              Document texte
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Titre *
          </label>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            required
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
            placeholder="Ex: Guide de procédure SAV"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Catégorie *
          </label>
          <select
            value={category}
            onChange={e => setCategory(e.target.value)}
            required
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
          >
            <option value="general">Général</option>
            <option value="technique">Technique</option>
            <option value="commercial">Commercial</option>
            <option value="juridique">Juridique</option>
            <option value="rh">Ressources Humaines</option>
            <option value="support">Support client</option>
          </select>
        </div>

        {type === 'url' && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              URL source *
            </label>
            <input
              type="url"
              value={sourceUrl}
              onChange={e => setSourceUrl(e.target.value)}
              required
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
              placeholder="https://example.com/documentation"
            />
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Contenu *
          </label>
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            required
            rows={8}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
            placeholder="Collez ici le contenu textuel du document ou de la page web..."
          />
          <p className="text-xs text-slate-500 mt-1">
            L'IA utilisera ce contenu pour contextualiser ses réponses
          </p>
        </div>

        <div className="flex gap-3 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition text-sm font-medium"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition text-sm font-medium disabled:opacity-50"
          >
            {saving ? 'Ajout en cours...' : 'Ajouter'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
