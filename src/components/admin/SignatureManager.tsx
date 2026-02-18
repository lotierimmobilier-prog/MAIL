import { useState, useEffect } from 'react';
import { Plus, Trash2, Star, Edit2, Eye, Loader2, PenTool, X, Check } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import TipTapEditor from '../ui/TipTapEditor';
import { useAuth } from '../../contexts/AuthContext';

interface Signature {
  id: string;
  user_id: string;
  name: string;
  html_content: string;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export default function SignatureManager() {
  const { user, isAdmin } = useAuth();
  const [signatures, setSignatures] = useState<Signature[]>([]);
  const [allSignatures, setAllSignatures] = useState<Signature[]>([]);
  const [users, setUsers] = useState<{ id: string; full_name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Signature | null>(null);
  const [creating, setCreating] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [formName, setFormName] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formIsDefault, setFormIsDefault] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);

    const promises: Promise<any>[] = [
      supabase
        .from('user_signatures')
        .select('*')
        .order('created_at', { ascending: false }),
    ];

    if (isAdmin) {
      promises.push(
        supabase.from('profiles').select('id, full_name').order('full_name')
      );
    }

    const results = await Promise.all(promises);
    const sigRes = results[0];

    if (sigRes.data) {
      setAllSignatures(sigRes.data);
      if (isAdmin) {
        setSignatures(sigRes.data);
      } else {
        setSignatures(sigRes.data.filter((s: Signature) => s.user_id === user?.id));
      }
    }

    if (isAdmin && results[1]?.data) {
      setUsers(results[1].data);
    }

    setLoading(false);
  }

  function startCreate() {
    setCreating(true);
    setEditing(null);
    setFormName('');
    setFormContent('');
    setFormIsDefault(false);
    setSelectedUserId(user?.id || '');
  }

  function startEdit(sig: Signature) {
    setEditing(sig);
    setCreating(false);
    setFormName(sig.name);
    setFormContent(sig.html_content);
    setFormIsDefault(sig.is_default);
    setSelectedUserId(sig.user_id);
  }

  function cancelForm() {
    setCreating(false);
    setEditing(null);
    setFormName('');
    setFormContent('');
    setFormIsDefault(false);
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

  async function handleSave() {
    if (!formName.trim()) {
      alert('Veuillez donner un nom a la signature');
      return;
    }

    setSaving(true);

    const payload = {
      name: formName.trim(),
      html_content: formContent,
      is_default: formIsDefault,
      is_active: true,
      user_id: isAdmin ? selectedUserId : user?.id,
    };

    if (editing) {
      const { error } = await supabase
        .from('user_signatures')
        .update(payload)
        .eq('id', editing.id);

      if (error) {
        alert('Erreur: ' + error.message);
        setSaving(false);
        return;
      }
    } else {
      const { error } = await supabase
        .from('user_signatures')
        .insert(payload);

      if (error) {
        alert('Erreur: ' + error.message);
        setSaving(false);
        return;
      }
    }

    setSaving(false);
    cancelForm();
    loadData();
  }

  async function handleDelete(id: string) {
    if (!confirm('Supprimer cette signature ?')) return;

    await supabase.from('user_signatures').delete().eq('id', id);
    loadData();
  }

  async function handleSetDefault(id: string) {
    await supabase
      .from('user_signatures')
      .update({ is_default: true })
      .eq('id', id);
    loadData();
  }

  async function handleToggleActive(sig: Signature) {
    await supabase
      .from('user_signatures')
      .update({ is_active: !sig.is_active })
      .eq('id', sig.id);
    loadData();
  }

  const displaySignatures = isAdmin
    ? (selectedUserId ? signatures.filter(s => s.user_id === selectedUserId) : signatures)
    : signatures;

  const getUserName = (userId: string) => {
    const u = users.find(u => u.id === userId);
    return u?.full_name || 'Utilisateur';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-cyan-600" />
      </div>
    );
  }

  if (creating || editing) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">
            {editing ? 'Modifier la signature' : 'Nouvelle signature'}
          </h3>
          <button
            onClick={cancelForm}
            className="p-2 hover:bg-slate-100 rounded-lg transition"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="space-y-4">
          {isAdmin && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Utilisateur</label>
              <select
                value={selectedUserId}
                onChange={e => setSelectedUserId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
              >
                <option value="">Choisir un utilisateur</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.full_name}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Nom de la signature</label>
            <input
              type="text"
              value={formName}
              onChange={e => setFormName(e.target.value)}
              placeholder="Ex: Signature professionnelle, Signature avec logo..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Contenu de la signature (HTML)
            </label>
            <p className="text-xs text-slate-500 mb-2">
              Utilisez l'editeur ci-dessous pour creer votre signature. Vous pouvez ajouter des images, du texte formate, des liens et des tableaux.
            </p>
            <TipTapEditor
              content={formContent}
              onChange={setFormContent}
              placeholder="Creez votre signature ici..."
              minHeight="200px"
              onImageUpload={handleImageUpload}
              showHtmlMode={true}
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isDefault"
              checked={formIsDefault}
              onChange={e => setFormIsDefault(e.target.checked)}
              className="w-4 h-4 text-cyan-600 border-slate-300 rounded focus:ring-cyan-500"
            />
            <label htmlFor="isDefault" className="text-sm text-slate-700">
              Definir comme signature par defaut
            </label>
          </div>
        </div>

        {formContent && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Apercu</label>
            <div
              className="border border-slate-200 rounded-lg p-4 bg-white prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: formContent }}
            />
          </div>
        )}

        <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
          <button
            onClick={cancelForm}
            className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 transition"
          >
            Annuler
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !formName.trim()}
            className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-medium rounded-lg transition disabled:opacity-50"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Enregistrement...
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                {editing ? 'Mettre a jour' : 'Creer la signature'}
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Signatures email</h3>
          <p className="text-sm text-slate-500 mt-1">
            Gerez les signatures HTML qui seront ajoutees automatiquement sous chaque email envoye.
          </p>
        </div>
        <button
          onClick={startCreate}
          className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-medium rounded-lg transition"
        >
          <Plus className="w-4 h-4" />
          Nouvelle signature
        </button>
      </div>

      {signatures.length === 0 ? (
        <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-300">
          <PenTool className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-500">Aucune signature configuree</p>
          <p className="text-xs text-slate-400 mt-1">Creez votre premiere signature email</p>
        </div>
      ) : (
        <div className="space-y-3">
          {displaySignatures.map(sig => (
            <div
              key={sig.id}
              className={`border rounded-xl p-4 transition ${
                sig.is_active ? 'border-slate-200 bg-white' : 'border-slate-100 bg-slate-50 opacity-60'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="text-sm font-semibold text-slate-900">{sig.name}</h4>
                    {sig.is_default && (
                      <span className="flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-700 text-xs font-medium rounded-full">
                        <Star className="w-3 h-3 fill-current" />
                        Par defaut
                      </span>
                    )}
                    {!sig.is_active && (
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-xs font-medium rounded-full">
                        Inactive
                      </span>
                    )}
                    {isAdmin && (
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-xs rounded-full">
                        {getUserName(sig.user_id)}
                      </span>
                    )}
                  </div>

                  {previewId === sig.id ? (
                    <div className="mt-3">
                      <div
                        className="border border-slate-200 rounded-lg p-4 bg-white prose prose-sm max-w-none"
                        dangerouslySetInnerHTML={{ __html: sig.html_content }}
                      />
                      <button
                        onClick={() => setPreviewId(null)}
                        className="mt-2 text-xs text-slate-500 hover:text-slate-700 transition"
                      >
                        Masquer l'apercu
                      </button>
                    </div>
                  ) : (
                    <div
                      className="text-xs text-slate-500 line-clamp-2 mt-1"
                      dangerouslySetInnerHTML={{
                        __html: sig.html_content.replace(/<img[^>]*>/g, '[image]').substring(0, 200)
                      }}
                    />
                  )}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => setPreviewId(previewId === sig.id ? null : sig.id)}
                    className="p-2 text-slate-400 hover:text-cyan-600 hover:bg-cyan-50 rounded-lg transition"
                    title="Apercu"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => startEdit(sig)}
                    className="p-2 text-slate-400 hover:text-cyan-600 hover:bg-cyan-50 rounded-lg transition"
                    title="Modifier"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  {!sig.is_default && (
                    <button
                      onClick={() => handleSetDefault(sig.id)}
                      className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition"
                      title="Definir par defaut"
                    >
                      <Star className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => handleToggleActive(sig)}
                    className={`px-2 py-1 text-xs font-medium rounded-lg transition ${
                      sig.is_active
                        ? 'text-slate-600 hover:bg-slate-100'
                        : 'text-emerald-600 hover:bg-emerald-50'
                    }`}
                  >
                    {sig.is_active ? 'Desactiver' : 'Activer'}
                  </button>
                  <button
                    onClick={() => handleDelete(sig.id)}
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                    title="Supprimer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
