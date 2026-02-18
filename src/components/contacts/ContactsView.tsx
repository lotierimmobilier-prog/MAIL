import { useState, useEffect, useRef } from 'react';
import {
  Users, Search, Plus, Upload, Download, Trash2, Edit3,
  X, Loader2, Mail, Phone, Building2, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Contact } from '../../lib/types';
import ContactFormModal from './ContactFormModal';
import CsvImportModal from './CsvImportModal';

const PAGE_SIZE = 25;

export default function ContactsView() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    loadContacts();
  }, [page]);

  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      setPage(0);
      loadContacts();
    }, 300);
    return () => { if (searchTimeout.current) clearTimeout(searchTimeout.current); };
  }, [search]);

  async function loadContacts() {
    setLoading(true);
    let query = supabase
      .from('contacts')
      .select('*', { count: 'exact' });

    if (search.trim()) {
      const s = `%${search.trim()}%`;
      query = query.or(`email.ilike.${s},first_name.ilike.${s},last_name.ilike.${s},company.ilike.${s},phone.ilike.${s}`);
    }

    const { data, count, error } = await query
      .order('last_name', { ascending: true })
      .order('first_name', { ascending: true })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (!error && data) {
      setContacts(data);
      setTotal(count || 0);
    }
    setLoading(false);
  }

  async function handleDelete() {
    if (selectedIds.size === 0) return;
    if (!confirm(`Supprimer ${selectedIds.size} contact(s) ?`)) return;

    setDeleting(true);
    const { error } = await supabase
      .from('contacts')
      .delete()
      .in('id', Array.from(selectedIds));

    if (error) {
      alert('Erreur lors de la suppression');
    } else {
      setSelectedIds(new Set());
      loadContacts();
    }
    setDeleting(false);
  }

  function handleExportCsv() {
    const headers = ['Email', 'Prenom', 'Nom', 'Societe', 'Telephone', 'Notes', 'Source'];
    const rows = contacts.map(c => [
      c.email, c.first_name, c.last_name, c.company, c.phone, c.notes, c.source
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${(v || '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `contacts_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function toggleSelect(id: string) {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  }

  function toggleAll() {
    if (selectedIds.size === contacts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(contacts.map(c => c.id)));
    }
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  function sourceLabel(s: string) {
    switch (s) {
      case 'manual': return 'Manuel';
      case 'csv_import': return 'Import CSV';
      case 'auto_sync': return 'Auto';
      case 'ai_extracted': return 'IA';
      default: return s;
    }
  }

  function sourceColor(s: string) {
    switch (s) {
      case 'manual': return 'bg-slate-100 text-slate-700';
      case 'csv_import': return 'bg-blue-100 text-blue-700';
      case 'auto_sync': return 'bg-emerald-100 text-emerald-700';
      case 'ai_extracted': return 'bg-amber-100 text-amber-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  }

  return (
    <div className="space-y-4 lg:space-y-6 p-3 lg:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="pl-8 lg:pl-0">
          <h1 className="text-xl lg:text-2xl font-bold text-slate-900">Annuaire</h1>
          <p className="text-sm text-slate-500 mt-1">
            {total} contact{total !== 1 ? 's' : ''} au total
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowImport(true)}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition"
          >
            <Upload className="w-4 h-4" />
            <span className="hidden sm:inline">Importer CSV</span>
          </button>
          <button
            onClick={handleExportCsv}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Exporter</span>
          </button>
          <button
            onClick={() => { setEditingContact(null); setShowForm(true); }}
            className="flex items-center gap-2 px-3 lg:px-4 py-2 text-sm font-medium text-white bg-cyan-600 hover:bg-cyan-700 rounded-lg transition"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Nouveau contact</span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher un contact (nom, email, societe, telephone)..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
            />
          </div>
          {selectedIds.size > 0 && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition disabled:opacity-50"
            >
              {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              Supprimer ({selectedIds.size})
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        ) : contacts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <Users className="w-12 h-12 mb-3" />
            <p className="text-sm font-medium">Aucun contact trouve</p>
            <p className="text-xs mt-1">Ajoutez des contacts manuellement ou importez un fichier CSV</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 text-left">
                  <th className="px-3 lg:px-4 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === contacts.length && contacts.length > 0}
                      onChange={toggleAll}
                      className="rounded border-slate-300"
                    />
                  </th>
                  <th className="px-3 lg:px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Contact</th>
                  <th className="px-3 lg:px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">Societe</th>
                  <th className="px-3 lg:px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden lg:table-cell">Telephone</th>
                  <th className="px-3 lg:px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden sm:table-cell">Source</th>
                  <th className="px-3 lg:px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden sm:table-cell">Emails</th>
                  <th className="px-3 lg:px-4 py-3 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {contacts.map(contact => (
                  <tr
                    key={contact.id}
                    className="hover:bg-slate-50/50 transition group"
                  >
                    <td className="px-3 lg:px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(contact.id)}
                        onChange={() => toggleSelect(contact.id)}
                        className="rounded border-slate-300"
                      />
                    </td>
                    <td className="px-3 lg:px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 lg:w-9 lg:h-9 rounded-full bg-cyan-100 text-cyan-700 flex items-center justify-center text-xs lg:text-sm font-semibold shrink-0">
                          {(contact.first_name?.[0] || contact.email[0] || '?').toUpperCase()}
                          {(contact.last_name?.[0] || '').toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-900 truncate">
                            {contact.first_name || contact.last_name
                              ? `${contact.first_name} ${contact.last_name}`.trim()
                              : contact.email}
                          </p>
                          <div className="flex items-center gap-1 text-xs text-slate-500">
                            <Mail className="w-3 h-3" />
                            <span className="truncate max-w-[120px] lg:max-w-none">{contact.email}</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 lg:px-4 py-3 hidden md:table-cell">
                      {contact.company && (
                        <div className="flex items-center gap-1.5 text-sm text-slate-600">
                          <Building2 className="w-3.5 h-3.5 text-slate-400" />
                          <span className="truncate max-w-[180px]">{contact.company}</span>
                        </div>
                      )}
                    </td>
                    <td className="px-3 lg:px-4 py-3 hidden lg:table-cell">
                      {contact.phone && (
                        <div className="flex items-center gap-1.5 text-sm text-slate-600">
                          <Phone className="w-3.5 h-3.5 text-slate-400" />
                          <span>{contact.phone}</span>
                        </div>
                      )}
                    </td>
                    <td className="px-3 lg:px-4 py-3 hidden sm:table-cell">
                      <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${sourceColor(contact.source)}`}>
                        {sourceLabel(contact.source)}
                      </span>
                    </td>
                    <td className="px-3 lg:px-4 py-3 text-sm text-slate-600 text-center hidden sm:table-cell">
                      {contact.email_count}
                    </td>
                    <td className="px-3 lg:px-4 py-3">
                      <button
                        onClick={() => { setEditingContact(contact); setShowForm(true); }}
                        className="p-1.5 text-slate-400 hover:text-cyan-600 hover:bg-cyan-50 rounded-lg transition sm:opacity-0 sm:group-hover:opacity-100"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
            <p className="text-xs text-slate-500">
              {page * PAGE_SIZE + 1}-{Math.min((page + 1) * PAGE_SIZE, total)} sur {total}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="p-1.5 rounded-lg hover:bg-slate-100 transition disabled:opacity-30"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs text-slate-600 px-2">
                {page + 1} / {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="p-1.5 rounded-lg hover:bg-slate-100 transition disabled:opacity-30"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {showForm && (
        <ContactFormModal
          contact={editingContact}
          onClose={() => { setShowForm(false); setEditingContact(null); }}
          onSaved={() => { setShowForm(false); setEditingContact(null); loadContacts(); }}
        />
      )}

      {showImport && (
        <CsvImportModal
          onClose={() => setShowImport(false)}
          onImported={() => { setShowImport(false); loadContacts(); }}
        />
      )}
    </div>
  );
}
