import { useState, useEffect, useRef } from 'react';
import { Users } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Contact } from '../../lib/types';

interface ContactAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export default function ContactAutocomplete({ value, onChange, placeholder, className }: ContactAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<Contact[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(-1);
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
    <div className="relative">
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
  );
}
