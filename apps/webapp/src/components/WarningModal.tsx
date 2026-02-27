import { useState, useEffect, useRef, type ReactNode } from "react";
import { FaExclamationTriangle } from "react-icons/fa";
import { cn } from "../lib/utils";

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

interface WarningModalProps {
  isOpen: boolean;
  // "confirm" — single click to confirm.
  // "sensitive" — user must type "delete" before confirming.
  variant?: "confirm" | "sensitive";
  title: ReactNode;
  description: string;
  confirmLabel?: string;
  // Word the user must type in the sensitive variant to enable confirm (default: "delete")
  confirmWord?: string;
  // When true, styles the icon + confirm button in red instead of the default accent-pink
  confirmDanger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

const WarningModal = ({
  isOpen,
  variant = "confirm",
  title,
  description,
  confirmLabel = "Delete",
  confirmWord,
  confirmDanger = false,
  onConfirm,
  onCancel,
}: WarningModalProps) => {
  const [confirmInput, setConfirmInput] = useState("");
  const [visible, setVisible] = useState(false);
  const [animating, setAnimating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setConfirmInput("");
      setVisible(true);
      // Tiny delay so that CSS transition runs from the initial state
      requestAnimationFrame(() => requestAnimationFrame(() => setAnimating(true)));
      if (variant === "sensitive") {
        setTimeout(() => inputRef.current?.focus(), 80);
      }
    } else {
      setAnimating(false);
      // Keep DOM mounted until exit animation finishes
      const t = setTimeout(() => setVisible(false), 220);
      return () => clearTimeout(t);
    }
  }, [isOpen, variant]);

  if (!visible) return null;

  const word = confirmWord ?? "delete";
  const canConfirm =
    variant === "confirm" || confirmInput.toLowerCase() === word.toLowerCase();
  const useDangerStyle = confirmDanger || variant === "sensitive";

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 bg-black/40 backdrop-blur-[2px] z-[60] transition-opacity duration-200",
          animating ? "opacity-100" : "opacity-0"
        )}
        onClick={onCancel}
      />

      {/* Modal */}
      <div className="fixed inset-0 flex items-center justify-center z-[70] pointer-events-none">
        <div
          className={cn(
            "bg-panel border border-tertiary/[8%] rounded-2xl p-8 w-[440px] pointer-events-auto drop-shadow-[0_4px_20px_rgba(0,0,0,0.3)] flex flex-col gap-5 transition-all duration-200",
            animating ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 -translate-y-2"
          )}
        >
          {/* Icon + title */}
          <div className="flex items-start gap-4">
            <div className={cn(
              "flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center mt-0.5",
              "bg-[#A46666]/10"
            )}>
              <FaExclamationTriangle size={16} className="text-[#A46666]" />
            </div>
            <div>
              <h3 className="text-lg">{title}</h3>
              <p className="text-sm text-tertiary mt-1 leading-relaxed">{description}</p>
            </div>
          </div>

          {/* Sensitive variant — type-to-confirm input */}
          {variant === "sensitive" && (
            <div className="flex flex-col gap-2">
              <label className="text-xs text-tertiary uppercase tracking-wide font-medium">
                Type <span className="text-white font-semibold">{word}</span> to confirm
              </label>
              <input
                ref={inputRef}
                value={confirmInput}
                onChange={(e) => setConfirmInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && canConfirm && onConfirm()}
                className="bg-background border border-tertiary/20 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-accent/40 transition-colors w-full"
                placeholder={word}
                autoComplete="off"
                spellCheck={false}
              />
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 mt-1">
            <button
              onClick={onConfirm}
              disabled={!canConfirm}
              className={cn(
                "flex-1 rounded-lg py-2.5 text-sm transition-colors",
                canConfirm
                  ? useDangerStyle
                    ? "bg-[#A46666]/10 hover:bg-[#A46666]/20 text-[#A46666]"
                    : "bg-accent/15 hover:bg-accent/20 text-accent"
                  : "bg-background/60 text-tertiary/30 cursor-not-allowed"
              )}
            >
              {confirmLabel}
            </button>
            <button
              onClick={onCancel}
              className="flex-1 bg-background hover:bg-background/60 text-tertiary rounded-lg py-2.5 text-sm transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default WarningModal;
