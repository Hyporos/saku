interface PaginationProps {
  page: number;
  total: number;
  pageCount: number;
  onPrev: () => void;
  onNext: () => void;
}

export const Pagination = ({ page, total, pageCount, onPrev, onNext }: PaginationProps) => (
  <div className="flex items-center justify-between px-6 py-3 border-t border-tertiary/[6%]">
    <span className="text-xs text-tertiary">
      {total === 0 ? "No results" : `Page ${page} of ${pageCount}`}
    </span>
    <div className="flex gap-3">
      <button
        disabled={page <= 1}
        onClick={onPrev}
        className="text-xs text-tertiary hover:text-white disabled:opacity-30 disabled:hover:text-tertiary transition-colors px-3 py-1.5 rounded-lg bg-background/60 border border-tertiary/20 hover:bg-background/100 hover:border-accent/40 disabled:hover:bg-background/60 disabled:hover:border-tertiary/20"
      >
        Prev
      </button>
      <button
        disabled={page >= pageCount}
        onClick={onNext}
        className="text-xs text-tertiary hover:text-white disabled:opacity-30 disabled:hover:text-tertiary transition-colors px-3 py-1.5 rounded-lg bg-background/60 border border-tertiary/20 hover:bg-background/100 hover:border-accent/40 disabled:hover:bg-background/60 disabled:hover:border-tertiary/20"
      >
        Next
      </button>
    </div>
  </div>
);
