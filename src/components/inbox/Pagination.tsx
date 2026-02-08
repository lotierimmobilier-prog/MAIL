import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

const PAGE_SIZE_OPTIONS = [25, 50, 100] as const;

interface PaginationProps {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

export default function Pagination({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const start = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, totalItems);

  const pages = buildPageNumbers(currentPage, totalPages);

  return (
    <div className="bg-white border-t border-slate-200 px-5 py-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <span className="text-xs text-slate-500">
          {totalItems === 0
            ? 'Aucun resultat'
            : `${start}-${end} sur ${totalItems}`}
        </span>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-slate-400">Afficher</span>
          <select
            value={pageSize}
            onChange={e => onPageSizeChange(Number(e.target.value))}
            className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-md text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
          >
            {PAGE_SIZE_OPTIONS.map(size => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
          <span className="text-xs text-slate-400">par page</span>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <NavButton
          onClick={() => onPageChange(1)}
          disabled={currentPage <= 1}
          label="Premiere page"
        >
          <ChevronsLeft className="w-3.5 h-3.5" />
        </NavButton>

        <NavButton
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          label="Page precedente"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </NavButton>

        {pages.map((p, i) =>
          p === '...' ? (
            <span key={`ellipsis-${i}`} className="w-8 text-center text-xs text-slate-400">
              ...
            </span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p as number)}
              className={`w-8 h-8 rounded-lg text-xs font-medium transition ${
                p === currentPage
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {p}
            </button>
          )
        )}

        <NavButton
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          label="Page suivante"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </NavButton>

        <NavButton
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage >= totalPages}
          label="Derniere page"
        >
          <ChevronsRight className="w-3.5 h-3.5" />
        </NavButton>
      </div>
    </div>
  );
}

function NavButton({
  onClick,
  disabled,
  label,
  children,
}: {
  onClick: () => void;
  disabled: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 transition disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent"
    >
      {children}
    </button>
  );
}

function buildPageNumbers(current: number, total: number): (number | '...')[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const pages: (number | '...')[] = [1];

  if (current > 3) {
    pages.push('...');
  }

  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);

  for (let i = start; i <= end; i++) {
    pages.push(i);
  }

  if (current < total - 2) {
    pages.push('...');
  }

  pages.push(total);

  return pages;
}
