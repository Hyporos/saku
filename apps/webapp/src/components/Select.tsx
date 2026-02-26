import { useState, useRef, useEffect } from "react";
import { FaChevronDown } from "react-icons/fa";
import { cn } from "../lib/utils";

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

export interface SelectOption {
  label: string;
  value: string;
  // CSS color string — shown as a small circle in the "color" variant
  color?: string;
  // URL — shown as a small avatar image in the "icon" variant
  iconUrl?: string;
}

interface SelectProps {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  // "plain" — text only; "color" — colored circle per option; "icon" — small image per option
  variant?: "plain" | "color" | "icon";
  align?: "left" | "right";
  placeholder?: string;
  className?: string;
}

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

const Select = ({
  options,
  value,
  onChange,
  variant = "plain",
  align = "left",
  placeholder,
  className,
}: SelectProps) => {
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(false);
  const [animating, setAnimating] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Animation lifecycle — same pattern as DatePicker/WarningModal
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

  return (
    <div ref={ref} className={cn("relative inline-block", className)}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "inline-flex items-center gap-2.5 bg-background border rounded-lg px-3 py-1.5 text-sm text-white transition-colors focus:outline-none cursor-pointer w-full",
          open ? "border-accent/40" : "border-tertiary/20 hover:border-tertiary/40"
        )}
      >
        {variant === "color" && selected?.color && (
          <span
            className="w-3.5 h-3.5 mb-0.5 rounded-full flex-shrink-0 border border-white/10"
            style={{ backgroundColor: selected.color }}
          />
        )}
        {variant === "icon" && selected?.iconUrl && (
          <img
            src={selected.iconUrl}
            alt=""
            className="w-4 h-4 rounded-full object-cover flex-shrink-0"
          />
        )}
        <span className="flex-1 text-left">{selected?.label ?? placeholder ?? "Select…"}</span>
        <FaChevronDown
          size={9}
          className={cn(
            "flex-shrink-0 text-tertiary/50 transition-transform duration-150",
            open && "rotate-180"
          )}
        />
      </button>

      {/* Dropdown */}
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
                  className="w-3.5 h-3.5 mb-0.5 rounded-full flex-shrink-0 border border-white/10"
                  style={{ backgroundColor: opt.color }}
                />
              )}
              {variant === "icon" && opt.iconUrl && (
                <img
                  src={opt.iconUrl}
                  alt=""
                  className="w-5 h-5 rounded-full object-cover flex-shrink-0"
                />
              )}
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default Select;
