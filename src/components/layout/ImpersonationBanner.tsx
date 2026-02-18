import { ArrowLeftCircle, Eye } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export default function ImpersonationBanner() {
  const { impersonating, stopImpersonation } = useAuth();

  if (!impersonating) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[60] bg-amber-500 text-amber-950">
      <div className="flex items-center justify-between px-4 py-2">
        <div className="flex items-center gap-3">
          <Eye className="w-4 h-4" />
          <span className="text-sm font-medium">
            Vous visualisez l'application en tant que : <strong>{impersonating.fullName}</strong> ({impersonating.email}) - Role : {impersonating.role}
          </span>
        </div>
        <button
          onClick={stopImpersonation}
          className="flex items-center gap-2 px-3 py-1.5 bg-amber-700 hover:bg-amber-800 text-white text-sm font-medium rounded-lg transition"
        >
          <ArrowLeftCircle className="w-4 h-4" />
          Revenir a mon compte
        </button>
      </div>
    </div>
  );
}
