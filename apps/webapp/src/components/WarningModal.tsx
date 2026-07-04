import { useState, useEffect, useRef, type ReactNode } from "react";
import { FaExclamationTriangle } from "react-icons/fa";
import { cn } from "../lib/utils";
import { Button } from "./Button";

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

// "red"     — destructive actions (delete, remove)
// "primary" — miscellaneous confirmations
// "owner"   — owner-only actions (clear log, etc.)
type DialogColorVariant = "red" | "primary" | "owner";

const colorVariantStyles: Record<
  DialogColorVariant,
  { iconBg: string; btnVariant: "danger" | "primary" | "owner" }
> = {
  red:     { iconBg: "bg-[#A46666]/10", btnVariant: "danger"  },
  primary: { iconBg: "bg-accent/10",    btnVariant: "primary" },
  owner:   { iconBg: "bg-lavender/10",  btnVariant: "owner"   },
};

const defaultIconColor: Record<DialogColorVariant, string> = {
  red:     "text-[#A46666]",
  primary: "text-accent",
  owner:   "text-lavender",
};

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

interface WarningModalProps {
  isOpen: boolean;
  // "confirm" — single click to confirm.
  // "sensitive" — user must type a word before confirming.
  variant?: "confirm" | "sensitive";
  // Color scheme for the icon circle and confirm button.
  colorVariant?: DialogColorVariant;
  // Custom icon node (defaults to FaExclamationTriangle styled per colorVariant).
  icon?: ReactNode;
  title: ReactNode;
  description: string;
  /** Extra content rendered between the description and the action buttons */
  children?: ReactNode;
  confirmLabel?: string;
  // Word the user must type in the sensitive variant to enable confirm (default: "delete")
  confirmWord?: string;
  /** Externally disables the confirm button (combined with AND with internal canConfirm) */
  confirmDisabled?: boolean;
  /** Loading state on the confirm button */
  confirmLoading?: boolean;
  // Legacy: forces "red" colorVariant when true (ignored if colorVariant is set explicitly)
  confirmDanger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

const WarningModal = ({
  isOpen,
  variant = "confirm",
  colorVariant,
  icon,
  title,
  description,
  children,
  confirmLabel = "Delete",
  confirmWord,
  confirmDisabled = false,
  confirmLoading,
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
    (variant === "confirm" || confirmInput.toLowerCase() === word.toLowerCase()) &&
    !confirmDisabled;

  // colorVariant takes priority; legacy confirmDanger + sensitive both fall back to "red"
  const effectiveVariant: DialogColorVariant =
    colorVariant ?? ((confirmDanger || variant === "sensitive") ? "red" : "primary");
  const styles = colorVariantStyles[effectiveVariant];
  const resolvedIcon = icon ?? (
    <FaExclamationTriangle size={15} className={defaultIconColor[effectiveVariant]} />
  );

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
            "bg-panel border border-tertiary/[8%] rounded-2xl p-6 md:p-8 w-full md:w-[440px] mx-4 pointer-events-auto drop-shadow-[0_4px_20px_rgba(0,0,0,0.3)] flex flex-col gap-4 transition-all duration-200",
            animating ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 -translate-y-2"
          )}
        >
          {/* Icon + title on one row */}
          <div className="flex items-center gap-3.5">
            <div className={cn(
              "flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center",
              styles.iconBg
            )}>
              {resolvedIcon}
            </div>
            <h3 className="text-lg leading-tight">{title}</h3>
          </div>

          {/* Description — separate row, not grouped with title */}
          <p className="text-sm text-tertiary leading-relaxed">{description}</p>

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

          {/* Extra content (checkboxes, form fields, etc.) rendered between input and actions */}
          {children}

          {/* Actions */}
          <div className="flex gap-3 mt-1">
            <Button
              variant={styles.btnVariant}
              onClick={onConfirm}
              disabled={!canConfirm}
              loading={confirmLoading}
              className="flex-1 h-auto py-2.5 [transition:opacity_200ms_ease,color_150ms,background-color_150ms,border-color_150ms]"
            >
              {confirmLabel}
            </Button>
            <Button
              variant="secondary"
              onClick={onCancel}
              className="flex-1 h-auto py-2.5"
            >
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </>
  );
};

export default WarningModal;
