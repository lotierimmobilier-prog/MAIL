import { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export default function SettingsManager() {
  const [syncInterval, setSyncInterval] = useState(600);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    const { data } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'mailbox_sync_interval_seconds')
      .maybeSingle();

    if (data?.value) {
      setSyncInterval(parseInt(data.value as string));
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .maybeSingle();

      await supabase
        .from('system_settings')
        .update({
          value: syncInterval.toString(),
          updated_at: new Date().toISOString(),
          updated_by: profile?.id
        })
        .eq('key', 'mailbox_sync_interval_seconds');

      alert('Paramètres enregistrés avec succès. Rechargez la page pour appliquer les changements.');
    } catch (error) {
      alert('Erreur lors de l\'enregistrement des paramètres');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-slate-900">Paramètres système</h3>
        <p className="text-sm text-slate-500">Configuration générale de l'application</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-6">
        <div>
          <h4 className="text-sm font-semibold text-slate-900 mb-4">Synchronisation des boîtes mail</h4>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-2">
                Intervalle de synchronisation automatique
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min="60"
                  max="3600"
                  step="60"
                  value={syncInterval}
                  onChange={(e) => setSyncInterval(parseInt(e.target.value))}
                  className="w-32 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                />
                <span className="text-sm text-slate-600">secondes</span>
                <span className="text-sm text-slate-500">
                  ({Math.round(syncInterval / 60)} minute{syncInterval !== 60 ? 's' : ''})
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-2">
                Fréquence à laquelle le système vérifie les nouvelles emails dans toutes les boîtes mail actives
              </p>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-xs text-blue-800">
                <strong>Note :</strong> Après modification, rechargez la page pour appliquer le nouvel intervalle.
                Les intervalles recommandés sont entre 5 et 30 minutes (300-1800 secondes).
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-4 border-t border-slate-200">
          <button
            onClick={handleSave}
            disabled={saving || syncInterval < 60}
            className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-medium rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  );
}
