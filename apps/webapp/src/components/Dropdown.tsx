import { useState, useRef, useEffect } from "react";
import { FaChevronDown } from "react-icons/fa";
import { cn } from "../lib/utils";
import { Button } from "./Button";

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

interface DropdownOption {
  label: string;
  value: string;
  /** CSS color string — shown as a small dot in the "color" variant */
  color?: string;
  /** URL — shown as a small avatar image in the "icon" variant */
  iconUrl?: string;
}

interface DropdownProps {
  options: DropdownOption[];
  value: string;
  onChange: (value: string) => void;
  /** "plain" — text only; "color" — colored dot per option; "icon" — small avatar per option */
  variant?: "plain" | "color" | "icon";
  /** Aligns the dropdown panel to the left or right edge of the trigger */
  align?: "left" | "right";
  placeholder?: string;
  className?: string;
  /** Reduces trigger height to match compact DatePicker / filter-bar density */
  compact?: boolean;
  /**
   * When true the label renders as text-tertiary when the default (first) option is selected
   * and as white text when any other option is selected — useful for "All X" style filters.
   */
  subtle?: boolean;
}

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

/**
 * Dropdown — single-select with an animated panel that opens downwards.
 *
 * Trigger uses Button secondary styling. Supports plain / color-dot / icon-avatar variants.
 * The `subtle` flag dims the label when the first ("all") option is selected, making it
 * visually quiet until a real filter value is chosen.
 *
 * Usage:
 *   <Dropdown options={actorOptions} value={filter ?? "all"} onChange={setFilter} subtle />
 */
const Dropdown = ({
  options,
  value,
  onChange,
  variant = "plain",
  align = "left",
  placeholder,
  className,
  compact,
  subtle,
}: DropdownProps) => {
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(false);
  const [animating, setAnimating] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Open/close animation lifecycle
  useEffect(() => {
    if (open) {
      setVisible(true);
      requestAnimationFrame(() => requestAnimationFrame(() => setAnimating(true)));
    } else {
      setAnimating(false);
      const t = setTimeout(() => setVisible(false), 180);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const selected = options.find((o) => o.value === value);
  const isDefault = value === options[0]?.value;

  return (
    <div ref={ref} className={cn("relative inline-block", className)}>

      {/* Trigger — Button secondary base */}
      <Button
        type="button"
        variant="secondary"
        size={compact ? "sm" : "md"}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "w-full justify-between gap-2.5",
          open && "bg-tertiary/[8%] border-tertiary/40 text-white",
          subtle && isDefault && !open && "text-tertiary",
          subtle && !isDefault && !open && "text-white",
        )}
      >
        {/* Left decoration: color dot or avatar */}
        {variant === "color" && selected?.color && (
          <span
            className="w-3.5 h-3.5 mb-0.5 rounded-full flex-shrink-0 border border-white/10"
            style={{ backgroundColor: selected.color }}
          />
        )}
        {variant === "icon" && selected?.iconUrl && (
          <img src={selected.iconUrl} alt="" className="w-4 h-4 rounded-full object-cover flex-shrink-0" />
        )}

        {/* Label */}
        <span className="flex-1 text-left text-sm truncate">
          {selected?.label ?? placeholder ?? "Select…"}
        </span>

        {/* Chevron — always at far right, inherits button text color */}
        <FaChevronDown
          size={9}
          className={cn(
            "flex-shrink-0 ml-auto text-current opacity-50 transition-all duration-150",
            open && "rotate-180 opacity-80"
          )}
        />
      </Button>

      {/* Panel */}
      {visible && (
        <div
          className={cn(
            "absolute top-full mt-1 z-50 bg-panel border border-tertiary/[8%] rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] py-1 min-w-full transition-all duration-[180ms]",
            align === "right" ? "right-0 origin-top-right" : "left-0 origin-top-left",
            animating ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 -translate-y-1"
          )}
        >
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className={cn(
                "w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors",
                opt.value === value
                  ? "text-accent bg-accent/10"
                  : "text-tertiary hover:text-white hover:bg-background/60"
              )}
            >
              {variant === "color" && opt.color && (
                <span
                  className="w-3.5 h-3.5 rounded-full flex-shrink-0 border border-white/10"
                  style={{ backgroundColor: opt.color }}
                />
              )}
              {variant === "icon" && opt.iconUrl && (
                <img src={opt.iconUrl} alt="" className="w-5 h-5 rounded-full object-cover flex-shrink-0" />
              )}
              {opt.label}
            </button>
          ))}
        </div>
      )}

    </div>
  );
};

export default Dropdown;
