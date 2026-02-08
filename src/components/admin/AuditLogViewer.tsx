import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Shield, ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { AuditLogEntry } from '../../lib/types';

export default function AuditLogViewer() {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 20;

  useEffect(() => { load(); }, [page]);

  async function load() {
    const { data } = await supabase
      .from('audit_log')
      .select('*, user:profiles(full_name, email)')
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (data) setEntries(data);
  }

  return (
    <div>
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-slate-900">Journal d'audit</h3>
        <p className="text-sm text-slate-500">Suivre toutes les actions critiques du système</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Heure</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Utilisateur</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Action</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Ressource</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Détails</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {entries.map(entry => {
              const user = entry.user as { full_name: string; email: string } | undefined;
              return (
                <tr key={entry.id} className="hover:bg-slate-50 transition">
                  <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                    {format(new Date(entry.created_at), 'MMM d, HH:mm:ss')}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700">
                    {user?.full_name || user?.email || 'Système'}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-medium px-2 py-0.5 bg-slate-100 text-slate-700 rounded">
                      {entry.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-500">
                    {entry.resource_type}
                    {entry.resource_id && (
                      <span className="text-xs text-slate-400 ml-1">#{entry.resource_id.slice(0, 8)}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400 max-w-xs truncate">
                    {JSON.stringify(entry.details)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {entries.length === 0 && (
          <div className="px-4 py-8 text-center">
            <Shield className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-500">Aucune entrée dans le journal d'audit pour le moment.</p>
          </div>
        )}
      </div>

      <div className="flex items-center justify-center gap-2 mt-4">
        <button
          onClick={() => setPage(Math.max(0, page - 1))}
          disabled={page === 0}
          className="p-2 rounded-lg text-slate-400 hover:text-slate-600 disabled:opacity-30"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-sm text-slate-500">Page {page + 1}</span>
        <button
          onClick={() => setPage(page + 1)}
          disabled={entries.length < PAGE_SIZE}
          className="p-2 rounded-lg text-slate-400 hover:text-slate-600 disabled:opacity-30"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
