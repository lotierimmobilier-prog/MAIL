import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { RotateCcw, Loader2 } from 'lucide-react';
import Modal from '../ui/Modal';
import { supabase } from '../../lib/supabase';
import type { EmailTemplate, TemplateVersion } from '../../lib/types';

interface TemplateHistoryModalProps {
  open: boolean;
  onClose: () => void;
  template: EmailTemplate | null;
  onRollback: () => void;
}

export default function TemplateHistoryModal({ open, onClose, template, onRollback }: TemplateHistoryModalProps) {
  const [versions, setVersions] = useState<TemplateVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [rollingBack, setRollingBack] = useState<string | null>(null);

  useEffect(() => {
    if (open && template) {
      loadVersions();
    }
  }, [open, template]);

  async function loadVersions() {
    if (!template) return;
    setLoading(true);
    const { data } = await supabase
      .from('template_versions')
      .select('*')
      .eq('template_id', template.id)
      .order('version', { ascending: false });

    if (data) setVersions(data);
    setLoading(false);
  }

  async function handleRollback(version: TemplateVersion) {
    if (!template) return;
    setRollingBack(version.id);

    await supabase.from('template_versions').insert({
      template_id: template.id,
      version: template.version,
      name: template.name,
      subject: template.subject,
      body: template.body,
      variables: template.variables,
      change_note: `Rolled back to version ${version.version}`,
    });

    await supabase.from('email_templates').update({
      name: version.name,
      subject: version.subject,
      body: version.body,
      variables: version.variables,
      version: template.version + 1,
      updated_at: new Date().toISOString(),
    }).eq('id', template.id);

    setRollingBack(null);
    onRollback();
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title={`Historique des versions : ${template?.name ?? ''}`} size="lg">
      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-cyan-500" />
        </div>
      ) : versions.length === 0 ? (
        <p className="text-sm text-slate-500 text-center py-8">Aucun historique de versions disponible.</p>
      ) : (
        <div className="space-y-3">
          {versions.map(v => (
            <div key={v.id} className="border border-slate-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                    v{v.version}
                  </span>
                  <span className="text-xs text-slate-500">
                    {format(new Date(v.created_at), 'MMM d, yyyy HH:mm')}
                  </span>
                </div>
                <button
                  onClick={() => handleRollback(v)}
                  disabled={rollingBack !== null}
                  className="flex items-center gap-1 px-2 py-1 text-xs text-cyan-600 hover:text-cyan-700 hover:bg-cyan-50 rounded transition disabled:opacity-50"
                >
                  {rollingBack === v.id ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <RotateCcw className="w-3 h-3" />
                  )}
                  Restaurer
                </button>
              </div>
              {v.change_note && (
                <p className="text-xs text-slate-500 mb-2">{v.change_note}</p>
              )}
              <div className="bg-slate-50 rounded p-3">
                <p className="text-xs text-slate-400 mb-1">Objet : {v.subject || '(aucun)'}</p>
                <pre className="text-xs text-slate-600 whitespace-pre-wrap font-sans line-clamp-4">{v.body}</pre>
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
