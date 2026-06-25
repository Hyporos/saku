import { useState, useEffect, type ReactNode } from "react";
import { FaTimes, FaFilter } from "react-icons/fa";
import { cn } from "../../../lib/utils";
import { Button } from "../../../components/Button";

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

interface FilterSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  // Dot indicator shown on the trigger button when at least one filter is active
  hasActiveFilters?: boolean;
  // When provided, a pinned "Clear Filters" footer button is shown
  onClear?: () => void;
  children: ReactNode;
}

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

// Right-side sliding panel for mobile filter controls.
// Renders above admin navigation (z-[100]) at z-[110].
export const FilterSidebar = ({
  isOpen,
  onClose,
  title = "Filters",
  hasActiveFilters = false,
  onClear,
  children,
}: FilterSidebarProps) => {
  const [mounted, setMounted] = useState(false);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setMounted(true);
      requestAnimationFrame(() => requestAnimationFrame(() => setAnimating(true)));
    } else {
      setAnimating(false);
      const t = setTimeout(() => setMounted(false), 300);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  if (!mounted) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 bg-black/60 z-[105] transition-opacity duration-300",
          animating ? "opacity-100" : "opacity-0"
        )}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={cn(
          "fixed right-0 top-0 h-full w-[280px] bg-panel border-l border-tertiary/[6%] z-[110] flex flex-col transition-transform duration-300",
          animating ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-tertiary/[8%] flex-shrink-0">
          <div className="flex items-center gap-2">
            <FaFilter size={11} className="text-tertiary/60" />
            <h3 className="text-sm font-medium">{title}</h3>
            {hasActiveFilters && (
              <span className="w-1.5 h-1.5 rounded-full bg-accent flex-shrink-0" />
            )}
          </div>
          <Button variant="inline" onClick={onClose} className="text-tertiary/60 hover:text-white p-1">
            <FaTimes size={14} />
          </Button>
        </div>

        {/* Filter controls — passed as children */}
        <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-5">
          {children}
        </div>

        {/* Clear Filters — pinned at bottom, same container style as Log out / Refresh */}
        {onClear && (
          <div className="border-t border-tertiary/[8%] p-4 flex-shrink-0">
            <Button
              variant="secondary"
              size="full"
              icon={<FaTimes size={11} />}
              onClick={() => { onClear!(); onClose(); }}
            >
              Clear Filters
            </Button>
          </div>
        )}
      </div>
    </>
  );
};

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

// Trigger button rendered inline in the filter bar row — icon only, square.
export const FilterTrigger = ({
  onClick,
  hasActiveFilters = false,
  className,
}: {
  onClick: () => void;
  hasActiveFilters?: boolean;
  className?: string;
}) => (
  <Button
    variant="secondary"
    size="mobile"
    onClick={onClick}
    title="Filters"
    className={cn("relative flex-shrink-0", className)}
  >
    <FaFilter size={12} />
    {hasActiveFilters && (
      <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-accent" />
    )}
  </Button>
);
