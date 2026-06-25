import { type ReactNode, type ButtonHTMLAttributes } from "react";
import { FaSpinner } from "react-icons/fa";
import { cn } from "../lib/utils";

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

type ButtonVariant = "secondary" | "primary" | "danger" | "owner" | "tertiary" | "success" | "inline";
type ButtonSize    = "sm" | "md" | "lg" | "full" | "mobile";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Icon rendered to the left of the label */
  icon?: ReactNode;
  /** Displays a spinning spinner and disables the button during async operations */
  loading?: boolean;
  /** Marks the button as toggled/active — sets aria-pressed and adds a subtle active ring */
  pressed?: boolean;
}

const variantClasses: Record<ButtonVariant, string> = {
  secondary: "bg-transparent border-tertiary/20 hover:border-tertiary/40 text-tertiary hover:text-white active:bg-tertiary/[8%] focus-visible:ring-1 focus-visible:ring-tertiary/40",
  primary:   "bg-accent/10 hover:bg-accent/15 border-accent/40 text-accent active:bg-accent/25 focus-visible:ring-1 focus-visible:ring-accent/50",
  danger:    "bg-[#A46666]/15 hover:bg-[#A46666]/30 border-[#A46666]/30 hover:border-[#A46666]/50 text-[#C87070] active:bg-[#A46666]/40 focus-visible:ring-1 focus-visible:ring-[#A46666]/50",
  owner:     "bg-lavender/10 hover:bg-lavender/15 border-lavender/40 text-lavender active:bg-lavender/25 focus-visible:ring-1 focus-visible:ring-lavender/50",
  tertiary:  "bg-transparent border-transparent text-tertiary hover:text-white active:text-white/80 focus-visible:ring-1 focus-visible:ring-tertiary/40",
  success:   "bg-[#669A68]/10 hover:bg-[#669A68]/15 border-[#669A68]/40 text-[#669A68] active:bg-[#669A68]/25 focus-visible:ring-1 focus-visible:ring-[#669A68]/50",
  // No bg/border/padding — sizing comes from content; colors passed via className
  inline:    "bg-transparent border-transparent active:scale-[1.05] [transition:color_150ms,transform_100ms_ease-out]",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm:     "h-[30px] px-3 text-xs",
  md:     "h-[36px] px-4 text-sm",
  lg:     "h-[42px] px-5 text-sm",
  full:   "w-full h-[36px] px-4 text-sm",
  mobile: "h-7 w-7 p-0 shrink-0 text-xs",
};

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

/**
 * General-purpose button.
 *
 * Variants:  secondary (default) | primary | danger | owner | tertiary (ghost) | success | inline (no chrome)
 * Sizes:     sm | md (default) | lg | full | mobile (icon-only square)
 * Props:     icon — node rendered left of label
 *            loading — shows spinner, disables interaction
 *            pressed — aria-pressed toggle state (for toggle buttons)
 */
export const Button = ({
  variant = "secondary",
  size = "md",
  icon,
  loading,
  pressed,
  children,
  className,
  disabled,
  ...rest
}: ButtonProps) => (
  <button
    disabled={disabled || loading}
    aria-pressed={pressed}
    className={cn(
      "relative inline-flex items-center justify-center gap-2 rounded-lg border transition-colors",
      "focus:outline-none focus-visible:ring-offset-0",
      "disabled:opacity-40 disabled:cursor-default disabled:pointer-events-none",
      variantClasses[variant],
      variant === "inline" ? "p-0 h-auto w-auto leading-none" : sizeClasses[size],
      className
    )}
    {...rest}
  >
    <span
      className={cn(
        "inline-flex items-center justify-center w-full gap-2 transition-opacity duration-150",
        loading ? "opacity-0" : "opacity-100"
      )}
    >
      {icon && <span className="mb-0.5 shrink-0">{icon}</span>}
      {children}
    </span>

    {loading && (
      <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <FaSpinner className="animate-spin" size={14} />
      </span>
    )}
  </button>
);
