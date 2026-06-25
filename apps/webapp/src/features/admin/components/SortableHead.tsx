import type { ReactNode } from "react";
import { FaChevronUp, FaChevronDown } from "react-icons/fa";
import { cn } from "../../../lib/utils";
import Checkbox from "../../../components/Checkbox";
import type { SortState } from "../types";

interface ColDef {
  label: ReactNode;
  field?: string;
  className?: string;
}

interface SortableHeadProps {
  cols: ColDef[];
  sort: SortState | null;
  onSort: (field: string) => void;
  onSelectAll?: () => void;
  allSelected?: boolean;
  someSelected?: boolean;
  theadClassName?: string;
}

export const SortableHead = ({
  cols,
  sort,
  onSort,
  onSelectAll,
  allSelected,
  someSelected,
  theadClassName,
}: SortableHeadProps) => (
  <thead className={theadClassName}>
    <tr className="border-t border-tertiary/[6%]">
      {onSelectAll !== undefined && (
        <th className="pl-6 pr-2 py-3 w-10">
          <Checkbox
            checked={!!allSelected}
            onChange={onSelectAll}
            indeterminate={!allSelected && !!someSelected}
          />
        </th>
      )}
      {cols.map(({ label, field, className: colClass }, idx) => (
        <th
          key={field ?? idx}
          onClick={() => field && onSort(field)}
          className={cn(
            "text-left text-xs text-tertiary/50 font-medium uppercase tracking-wide px-6 py-3 select-none",
            colClass,
            field && "cursor-pointer hover:text-white transition-colors group"
          )}
        >
          {/* Always render the chevron slot to prevent layout shift when it appears */}
          <span className="inline-flex items-center gap-1.5">
            {label}
            <span
              className={cn(
                "inline-flex items-center leading-none transition-all duration-150",
                field && sort?.field === field ? "opacity-100" : "opacity-0",
                "group-hover:text-white text-tertiary/50"
              )}
            >
              {sort?.field === field && sort?.dir === "asc"
                ? <FaChevronUp size={9} />
                : <FaChevronDown size={9} />}
            </span>
          </span>
        </th>
      ))}
      <th className="px-6 py-3" />
    </tr>
  </thead>
);
