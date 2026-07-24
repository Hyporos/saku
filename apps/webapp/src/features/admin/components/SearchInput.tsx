import { FaSearch } from "react-icons/fa";
import { cn } from "../../../lib/utils";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Overrides the default input sizing (`flex-1 min-w-0`). */
  inputClassName?: string;
}

/**
 * Search icon + text input, meant to sit inside a ListPanel filter bar alongside
 * optional trailing controls (date pickers, filter dropdowns).
 */
export const SearchInput = ({ value, onChange, placeholder, inputClassName }: SearchInputProps) => (
  <>
    <FaSearch size={13} className="text-tertiary/50 flex-shrink-0 mb-0.5" />
    <input
      type="text"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "bg-transparent text-sm text-white placeholder-tertiary/40 focus:outline-none",
        inputClassName ?? "flex-1 min-w-0"
      )}
    />
  </>
);
