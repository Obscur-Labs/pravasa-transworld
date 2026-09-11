'use client';
import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useStoredPrefs } from '@/lib/useStoredPrefs';

/** 0 means show everything on one page. */
export const PAGE_SIZES = [10, 25, 50, 100, 0] as const;

/** Remembers the rows-per-page choice for one list, per browser. */
export function usePageSize(listKey: string) {
  const [prefs, update] = useStoredPrefs(`admin:page-size:${listKey}`, { pageSize: 10 });
  return [prefs.pageSize, (pageSize: number) => update({ pageSize })] as const;
}

/**
 * Pages a list that is already loaded. `resetKey` sends it back to page 1 when filters
 * or search change.
 */
export function usePagination<T>(items: T[], listKey: string, resetKey = '') {
  const [pageSize, setPageSize] = usePageSize(listKey);
  const [page, setPage] = useState(1);
  const pages = pageSize ? Math.max(1, Math.ceil(items.length / pageSize)) : 1;

  useEffect(() => { setPage(1); }, [resetKey, pageSize]);

  const current = Math.min(page, pages);
  const pageItems = pageSize ? items.slice((current - 1) * pageSize, current * pageSize) : items;

  return {
    pageItems,
    paginationProps: { page: current, pageSize, total: items.length, onPageChange: setPage, onPageSizeChange: setPageSize },
  };
}

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  className?: string;
}

// Page numbers to show: always first and last, plus the neighbours of the current page.
function pageWindow(page: number, pages: number): (number | 'gap')[] {
  const wanted = new Set([1, pages, page - 1, page, page + 1].filter((p) => p >= 1 && p <= pages));
  const sorted = Array.from(wanted).sort((a, b) => a - b);
  return sorted.flatMap((p, i) => (i > 0 && p - sorted[i - 1] > 1 ? ['gap' as const, p] : [p]));
}

const pageButton = 'min-w-8 h-8 px-2 rounded-lg text-sm font-medium tabular-nums transition-colors disabled:opacity-40 disabled:pointer-events-none';

export function Pagination({ page, pageSize, total, onPageChange, onPageSizeChange, className }: PaginationProps) {
  if (total <= PAGE_SIZES[0]) return null;

  const pages = pageSize ? Math.max(1, Math.ceil(total / pageSize)) : 1;
  const from = pageSize ? (page - 1) * pageSize + 1 : 1;
  const to = pageSize ? Math.min(page * pageSize, total) : total;

  return (
    <div className={cn('flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm text-muted-foreground', className)}>
      <div className="flex items-center gap-3">
        <span className="tabular-nums">{from}-{to} of {total}</span>
        <label className="flex items-center gap-2">
          <span className="hidden sm:inline">Rows</span>
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="h-8 px-2 rounded-lg border border-input bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {PAGE_SIZES.map((size) => <option key={size} value={size}>{size || 'All'}</option>)}
          </select>
        </label>
      </div>

      {pages > 1 && (
        <nav className="flex items-center gap-1" aria-label="Pagination">
          <button type="button" onClick={() => onPageChange(page - 1)} disabled={page === 1} aria-label="Previous page" className={cn(pageButton, 'hover:bg-muted hover:text-foreground')}>
            <ChevronLeft className="w-4 h-4 mx-auto" />
          </button>
          {pageWindow(page, pages).map((p, i) =>
            p === 'gap' ? (
              <span key={`gap-${i}`} className="px-1">...</span>
            ) : (
              <button
                key={p}
                type="button"
                onClick={() => onPageChange(p)}
                aria-current={p === page ? 'page' : undefined}
                className={cn(pageButton, p === page ? 'bg-primary text-primary-foreground' : 'hover:bg-muted hover:text-foreground')}
              >
                {p}
              </button>
            ),
          )}
          <button type="button" onClick={() => onPageChange(page + 1)} disabled={page === pages} aria-label="Next page" className={cn(pageButton, 'hover:bg-muted hover:text-foreground')}>
            <ChevronRight className="w-4 h-4 mx-auto" />
          </button>
        </nav>
      )}
    </div>
  );
}
