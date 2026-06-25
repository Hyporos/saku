import { Button } from "../../../components/Button";

interface PaginationProps {
  page: number;
  total: number;
  pageCount: number;
  onPrev: () => void;
  onNext: () => void;
}

export const Pagination = ({ page, total, pageCount, onPrev, onNext }: PaginationProps) => (
  <div className="flex items-center justify-between px-6 py-3 border-t border-tertiary/[6%]">
    <span className="text-xs text-tertiary/40">
      {total === 0 ? "No results" : `Page ${page} of ${pageCount}`}
    </span>
    <div className="flex gap-2">
      <Button
        variant={page <= 1 ? "tertiary" : "secondary"}
        size="sm"
        disabled={page <= 1}
        onClick={onPrev}
      >
        Prev
      </Button>
      <Button
        variant={page >= pageCount ? "tertiary" : "secondary"}
        size="sm"
        disabled={page >= pageCount}
        onClick={onNext}
      >
        Next
      </Button>
    </div>
  </div>
);
