import { useState, useRef, useEffect } from "react";
import { cn } from "../lib/utils";

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

// Strip diacritics for accent-insensitive matching
const stripAccents = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

interface AutocompleteInputProps {
  value: string;
  onChange: (value: string) => void;
  suggestions: string[];
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  autoFocus?: boolean;
  requireSelection?: boolean;
}

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

const AutocompleteInput = ({
  value,
  onChange,
  suggestions,
  placeholder,
  className,
  inputClassName,
  onKeyDown,
  autoFocus,
  requireSelection = false,
}: AutocompleteInputProps) => {
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const ref = useRef<HTMLDivElement>(null);

  // Filter suggestions by the current input, accent-insensitive, max 8 results
  const matches = value.trim()
    ? suggestions
        .filter((s) =>
          stripAccents(s).toLowerCase().includes(stripAccents(value).toLowerCase())
        )
        .slice(0, 8)
    : [];

  const shouldOpen = open && matches.length > 0;

  // Animation lifecycle
  useEffect(() => {
    if (shouldOpen) {
      setVisible(true);
      requestAnimationFrame(() => requestAnimationFrame(() => setAnimating(true)));
    } else {
      setAnimating(false);
      const t = setTimeout(() => setVisible(false), 180);
      return () => clearTimeout(t);
    }
  }, [shouldOpen]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const pick = (name: string) => {
    onChange(name);
    setOpen(false);
    setHighlighted(-1);
  };

  const isExactSuggestion = (candidate: string) =>
    suggestions.some((s) => stripAccents(s).toLowerCase() === stripAccents(candidate).toLowerCase());

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" && shouldOpen) {
      e.preventDefault();
      setHighlighted((h) => Math.min(h + 1, matches.length - 1));
    } else if (e.key === "ArrowUp" && shouldOpen) {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      if (shouldOpen && highlighted >= 0) {
        e.preventDefault();
        pick(matches[highlighted]);
      } else if (requireSelection && value.trim() && !isExactSuggestion(value.trim())) {
        e.preventDefault();
        if (matches[0]) pick(matches[0]);
        else onChange("");
      }
    } else if (e.key === "Escape" && shouldOpen) {
      setOpen(false);
    } else {
      onKeyDown?.(e);
    }
  };

  // Highlight the matching portion of the suggestion label
  const highlight = (label: string) => {
    const query = stripAccents(value).toLowerCase();
    const stripped = stripAccents(label);
    const idx = stripped.toLowerCase().indexOf(query);
    if (idx === -1 || !query) return <span>{label}</span>;
    return (
      <span>
        {label.slice(0, idx)}
        <span className="text-accent">{label.slice(idx, idx + value.length)}</span>
        {label.slice(idx + value.length)}
      </span>
    );
  };

  return (
    <div ref={ref} className={cn("relative", className)}>
      <input
        type="text"
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); setHighlighted(-1); }}
        onBlur={() => {
          if (requireSelection && value.trim() && !isExactSuggestion(value.trim())) {
            setOpen(false);
            return;
          }
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoComplete="off"
        autoFocus={autoFocus}
        className={inputClassName}
      />
      {visible && (
        <div
          className={cn(
            "absolute left-0 right-0 top-full mt-1.5 z-50 bg-panel border border-tertiary/[8%] rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden transition-all duration-[180ms]",
            animating ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 -translate-y-1"
          )}
        >
          {matches.map((name, i) => (
            <button
              key={name}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); pick(name); }}
              onMouseEnter={() => setHighlighted(i)}
              className={cn(
                "w-full text-left px-4 py-2 text-sm transition-colors",
                i === highlighted ? "bg-accent/15 text-white" : "text-tertiary hover:bg-background/60 hover:text-white"
              )}
            >
              {highlight(name)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default AutocompleteInput;
