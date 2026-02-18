import { useState, useEffect, useRef } from 'react';
import { Users, Search, BookUser, ChevronLeft, ChevronRight, X, Building2, Mail } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Contact } from '../../lib/types';

interface ContactAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

const PICKER_PAGE_SIZE = 15;

export default function ContactAutocomplete({ value, onChange, placeholder, className }: ContactAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<Contact[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const [showPicker, setShowPicker] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current && !inputRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleInputChange(val: string) {
    onChange(val);
    setHighlightIdx(-1);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (val.trim().length < 2) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }
    debounceRef.current = setTimeout(() => searchContacts(val.trim()), 200);
  }

  async function searchContacts(query: string) {
    const s = `%${query}%`;
    const { data } = await supabase
      .from('contacts')
      .select('*')
      .or(`email.ilike.${s},first_name.ilike.${s},last_name.ilike.${s},company.ilike.${s}`)
      .order('email_count', { ascending: false })
      .limit(8);

    if (data && data.length > 0) {
      setSuggestions(data);
      setShowDropdown(true);
    } else {
      setSuggestions([]);
      setShowDropdown(false);
    }
  }

  function selectContact(contact: Contact) {
    onChange(contact.email);
    setShowDropdown(false);
    setShowPicker(false);
    setSuggestions([]);
    inputRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!showDropdown || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIdx(prev => Math.min(prev + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIdx(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && highlightIdx >= 0) {
      e.preventDefault();
      selectContact(suggestions[highlightIdx]);
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
    }
  }

  function contactLabel(c: Contact) {
    const name = [c.first_name, c.last_name].filter(Boolean).join(' ');
    return name || c.company || c.email;
  }

  return (
    <>
      <div className="relative flex items-center gap-2">
        <div className="relative flex-1">
          <input
            ref={inputRef}
            type="email"
            value={value}
            onChange={e => handleInputChange(e.target.value)}
            onFocus={() => { if (suggestions.length > 0) setShowDropdown(true); }}
            onKeyDown={handleKeyDown}
            placeholder={placeholder || 'destinataire@exemple.com'}
            className={className || 'w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500'}
          />

          {showDropdown && suggestions.length > 0 && (
            <div
              ref={dropdownRef}
              className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-64 overflow-y-auto"
            >
              {suggestions.map((contact, idx) => (
                <button
                  key={contact.id}
                  onClick={() => selectContact(contact)}
                  className={`w-full text-left px-3 py-2.5 flex items-center gap-3 transition ${
                    idx === highlightIdx ? 'bg-cyan-50' : 'hover:bg-slate-50'
                  } ${idx > 0 ? 'border-t border-slate-50' : ''}`}
                >
                  <div className="w-8 h-8 rounded-full bg-cyan-100 text-cyan-700 flex items-center justify-center text-xs font-semibold shrink-0">
                    {(contact.first_name?.[0] || contact.email[0] || '?').toUpperCase()}
                    {(contact.last_name?.[0] || '').toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-900 truncate">{contactLabel(contact)}</p>
                    <p className="text-xs text-slate-500 truncate">{contact.email}</p>
                  </div>
                  {contact.company && (
                    <span className="text-xs text-slate-400 truncate max-w-[120px]">{contact.company}</span>
                  )}
                </button>
              ))}
              <div className="px-3 py-2 border-t border-slate-100 text-xs text-slate-400 flex items-center gap-1.5">
                <Users className="w-3 h-3" />
                {suggestions.length} resultat(s)
              </div>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => setShowPicker(true)}
          className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-cyan-700 bg-cyan-50 border border-cyan-200 rounded-lg hover:bg-cyan-100 transition shrink-0"
          title="Parcourir l'annuaire"
        >
          <BookUser className="w-4 h-4" />
          Annuaire
        </button>
      </div>

      {showPicker && (
        <ContactPickerModal
          onSelect={selectContact}
          onClose={() => setShowPicker(false)}
        />
      )}
    </>
  );
}

function ContactPickerModal({ onSelect, onClose }: { onSelect: (c: Contact) => void; onClose: () => void }) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    loadContacts();
  }, [page]);

  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      setPage(0);
      loadContacts();
    }, 250);
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

    const { data, count } = await query
      .order('last_name', { ascending: true })
      .order('first_name', { ascending: true })
      .range(page * PICKER_PAGE_SIZE, (page + 1) * PICKER_PAGE_SIZE - 1);

    if (data) {
      setContacts(data);
      setTotal(count || 0);
    }
    setLoading(false);
  }

  const totalPages = Math.ceil(total / PICKER_PAGE_SIZE);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <BookUser className="w-5 h-5 text-cyan-600" />
            <h3 className="text-base font-semibold text-slate-900">Annuaire</h3>
            <span className="text-xs text-slate-400 ml-1">{total} contact{total !== 1 ? 's' : ''}</span>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg transition">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        <div className="px-5 py-3 border-b border-slate-100">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher un contact..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
              autoFocus
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-5 h-5 border-2 border-cyan-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : contacts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <Users className="w-10 h-10 mb-2" />
              <p className="text-sm">Aucun contact trouve</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {contacts.map(contact => (
                <button
                  key={contact.id}
                  onClick={() => onSelect(contact)}
                  className="w-full text-left px-5 py-3 flex items-center gap-3 hover:bg-cyan-50/50 transition group"
                >
                  <div className="w-9 h-9 rounded-full bg-cyan-100 text-cyan-700 flex items-center justify-center text-sm font-semibold shrink-0 group-hover:bg-cyan-200 transition">
                    {(contact.first_name?.[0] || contact.email[0] || '?').toUpperCase()}
                    {(contact.last_name?.[0] || '').toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-900 truncate">
                      {contact.first_name || contact.last_name
                        ? `${contact.first_name} ${contact.last_name}`.trim()
                        : contact.email}
                    </p>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="flex items-center gap-1 text-xs text-slate-500 truncate">
                        <Mail className="w-3 h-3" />
                        {contact.email}
                      </span>
                      {contact.company && (
                        <span className="flex items-center gap-1 text-xs text-slate-400 truncate">
                          <Building2 className="w-3 h-3" />
                          {contact.company}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-cyan-600 font-medium opacity-0 group-hover:opacity-100 transition shrink-0">
                    Selectionner
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-2.5 border-t border-slate-100 bg-slate-50 rounded-b-xl">
            <p className="text-xs text-slate-500">
              {page * PICKER_PAGE_SIZE + 1}-{Math.min((page + 1) * PICKER_PAGE_SIZE, total)} sur {total}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="p-1 rounded hover:bg-slate-200 transition disabled:opacity-30"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs text-slate-600 px-1.5">{page + 1}/{totalPages}</span>
              <button
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="p-1 rounded hover:bg-slate-200 transition disabled:opacity-30"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
