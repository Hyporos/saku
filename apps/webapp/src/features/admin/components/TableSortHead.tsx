import { FaChevronUp, FaChevronDown } from "react-icons/fa";
import { cn } from "../../../lib/utils";

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

type SortState = {
  field: string;
  dir: "asc" | "desc";
};

type Props<F extends string> = {
  label: string;
  field: F;
  activeSort: SortState | null | undefined;
  onToggle: (field: F) => void;
};

/**
 * Inline sort-button for table column headers. Renders a chevron that fades
 * in/out when this column is the active sort field.
 */
export function TableSortHead<F extends string>({ label, field, activeSort, onToggle }: Props<F>) {
  const isActive = activeSort?.field === field;

  return (
    <button
      type="button"
      onClick={() => onToggle(field)}
      className="inline-flex items-center gap-1.5 hover:text-white/80 transition-colors"
    >
      {label}
      <span
        className={cn(
          "inline-flex items-center text-accent transition-opacity duration-150",
          isActive ? "opacity-100" : "opacity-0"
        )}
      >
        {isActive && activeSort!.dir === "asc" ? (
          <FaChevronUp size={9} />
        ) : (
          <FaChevronDown size={9} />
        )}
      </span>
    </button>
  );
}
