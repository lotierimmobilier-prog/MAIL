import { useState, useEffect, useRef } from 'react';
import { Search, Sparkles, X, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface SearchResult {
  email_id: string;
  subject: string;
  sender_email: string;
  content_preview: string;
  similarity: number;
  created_at: string;
}

interface AiSearchBarProps {
  onResultClick?: (emailId: string) => void;
}

export default function AiSearchBar({ onResultClick }: AiSearchBarProps) {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (query.length > 2) {
      loadSuggestions();
    } else {
      setSuggestions([]);
    }
  }, [query]);

  async function loadSuggestions() {
    const { data } = await supabase
      .from('search_history')
      .select('query')
      .ilike('query', `${query}%`)
      .order('created_at', { ascending: false })
      .limit(3);

    if (data) {
      const uniqueQueries = Array.from(new Set(data.map(d => d.query)));
      setSuggestions(uniqueQueries.slice(0, 3));
    }
  }

  async function handleSearch() {
    if (!query.trim() || isSearching) return;

    setIsSearching(true);
    setShowResults(true);

    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/semantic-search`;
      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          threshold: 0.5,
          limit: 10,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setResults(data.results || []);
      } else {
        console.error('Search failed:', await response.text());
        setResults([]);
      }
    } catch (error) {
      console.error('Search error:', error);
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      handleSearch();
    } else if (e.key === 'Escape') {
      setShowResults(false);
    }
  }

  function handleResultClick(emailId: string) {
    setShowResults(false);
    setQuery('');
    onResultClick?.(emailId);
  }

  function clearSearch() {
    setQuery('');
    setResults([]);
    setShowResults(false);
  }

  return (
    <div ref={searchRef} className="relative w-full max-w-2xl">
      <div className="relative">
        <div className="absolute inset-y-0 left-0 flex items-center pl-4">
          <Sparkles className="w-5 h-5 text-purple-500" />
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => results.length > 0 && setShowResults(true)}
          placeholder="Rechercher un email (ex: facture client Dupont, compromis notaire...)"
          className="w-full pl-12 pr-12 py-3 rounded-xl border border-slate-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-100 transition text-sm"
        />
        {query && (
          <button
            onClick={clearSearch}
            className="absolute inset-y-0 right-12 flex items-center pr-2 text-slate-400 hover:text-slate-600"
          >
            <X className="w-4 h-4" />
          </button>
        )}
        <button
          onClick={handleSearch}
          disabled={isSearching || !query.trim()}
          className="absolute inset-y-0 right-0 flex items-center pr-4 text-purple-600 hover:text-purple-700 disabled:opacity-50"
        >
          {isSearching ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Search className="w-5 h-5" />
          )}
        </button>
      </div>

      {showResults && (results.length > 0 || suggestions.length > 0) && (
        <div className="absolute z-50 w-full mt-2 bg-white rounded-xl border border-slate-200 shadow-xl max-h-96 overflow-y-auto">
          {suggestions.length > 0 && results.length === 0 && (
            <div className="p-2">
              <p className="text-xs font-medium text-slate-500 px-3 py-2">Suggestions</p>
              {suggestions.map((suggestion, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setQuery(suggestion);
                    handleSearch();
                  }}
                  className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 rounded-lg transition flex items-center gap-2"
                >
                  <Search className="w-4 h-4 text-slate-400" />
                  {suggestion}
                </button>
              ))}
            </div>
          )}

          {results.length > 0 && (
            <div className="p-2">
              <p className="text-xs font-medium text-slate-500 px-3 py-2">
                {results.length} résultat{results.length > 1 ? 's' : ''} trouvé{results.length > 1 ? 's' : ''}
              </p>
              {results.map((result) => (
                <button
                  key={result.email_id}
                  onClick={() => handleResultClick(result.email_id)}
                  className="w-full text-left px-3 py-2.5 hover:bg-slate-50 rounded-lg transition border-b border-slate-100 last:border-0"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">
                        {result.subject || '(Sans objet)'}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        De: {result.sender_email}
                      </p>
                      <p className="text-xs text-slate-600 mt-1 line-clamp-2">
                        {result.content_preview}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="text-xs font-medium text-purple-600">
                        {Math.round(result.similarity * 100)}% pertinent
                      </span>
                      <span className="text-xs text-slate-400">
                        {new Date(result.created_at).toLocaleDateString('fr-FR')}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {results.length === 0 && suggestions.length === 0 && !isSearching && (
            <div className="p-6 text-center text-sm text-slate-500">
              Aucun résultat trouvé
            </div>
          )}
        </div>
      )}
    </div>
  );
}
