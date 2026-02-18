import { Search, RefreshCw, Trash2 } from 'lucide-react';
import NotificationCenter from '../notifications/NotificationCenter';
import { useSyncProgress } from '../../hooks/useSyncProgress';

interface HeaderProps {
  title: string;
  subtitle?: string;
}

export default function Header({ title, subtitle }: HeaderProps) {
  const syncProgress = useSyncProgress();

  const handleClearCache = () => {
    if (confirm('Voulez-vous vraiment vider le cache ? Cette action rechargera la page.')) {
      localStorage.clear();
      sessionStorage.clear();
      window.location.reload();
    }
  };

  return (
    <header className="h-14 lg:h-16 bg-white border-b border-slate-200 flex items-center justify-between px-3 lg:px-6 shrink-0">
      <div className="pl-10 lg:pl-0">
        <h1 className="text-base lg:text-lg font-semibold text-slate-900">{title}</h1>
        {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-2 lg:gap-4">
        <div className="relative hidden lg:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Rechercher..."
            className="pl-9 pr-4 py-2 w-64 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition"
          />
        </div>

        {syncProgress.isSyncing && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-cyan-50 border border-cyan-200 rounded-lg">
            <RefreshCw className="w-4 h-4 text-cyan-600 animate-spin" />
            <div className="flex flex-col">
              <span className="text-xs font-medium text-cyan-900">
                Synchronisation {syncProgress.progress}%
              </span>
              {syncProgress.mailboxName && (
                <span className="text-xs text-cyan-600">
                  {syncProgress.mailboxName}
                </span>
              )}
            </div>
          </div>
        )}

        <button
          onClick={handleClearCache}
          className="p-2 hover:bg-slate-100 rounded-lg transition-colors group relative"
          title="Vider le cache"
        >
          <Trash2 className="w-5 h-5 text-slate-600 group-hover:text-red-600 transition-colors" />
          <span className="absolute -bottom-8 right-0 bg-slate-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
            Vider le cache
          </span>
        </button>

        <NotificationCenter />

        <div className="w-8 h-8 rounded-full bg-cyan-600 flex items-center justify-center text-white text-xs font-medium">
          A
        </div>
      </div>
    </header>
  );
}
