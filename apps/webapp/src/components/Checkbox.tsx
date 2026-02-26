import { cn } from "../lib/utils";
import { FaCheck, FaMinus } from "react-icons/fa";

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

interface CheckboxProps {
  checked: boolean;
  onChange: () => void;
  // Renders a dash — used for "select all" when only some rows are selected
  indeterminate?: boolean;
  className?: string;
}

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

const Checkbox = ({ checked, onChange, indeterminate = false, className }: CheckboxProps) => (
  <button
    type="button"
    role="checkbox"
    aria-checked={indeterminate ? "mixed" : checked}
    onClick={(e) => {
      e.stopPropagation();
      onChange();
    }}
    className={cn(
      "w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border transition-all duration-200 ease-out focus:outline-none focus:ring-1 focus:ring-accent/40",
      checked || indeterminate
        ? "bg-accent/20 border-accent/60 shadow-[0_0_0_3px_rgba(var(--accent-raw,145,68,207),0.08)]"
        : "bg-transparent border-tertiary/25 hover:border-tertiary/50 hover:bg-white/[3%]",
      className
    )}
  >
    <span
      className={cn(
        "flex items-center justify-center transition-all duration-150 ease-out",
        checked || indeterminate ? "opacity-100 scale-100" : "opacity-0 scale-50"
      )}
    >
      {indeterminate
        ? <FaMinus size={7} className="text-accent" />
        : <FaCheck size={7} className="text-accent" />}
    </span>
  </button>
);

export default Checkbox;
