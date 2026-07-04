import { useEffect, useState, type ReactNode } from "react";
import { FaTimes } from "react-icons/fa";
import { cn } from "../lib/utils";
import { Button } from "./Button";

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

interface DrawerProps {
  /** Controls whether the drawer is open */
  isOpen: boolean;
  /** Called when backdrop is clicked or close button is pressed */
  onClose: () => void;
  /** Drawer heading */
  title: ReactNode;
  /** Optional subtitle displayed beneath the title */
  subtitle?: ReactNode;
  /** Content rendered in the body (scrollable) */
  children: ReactNode;
  /** Content rendered in the sticky footer strip */
  footer?: ReactNode;
}

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

/**
 * Right-anchored slide-in drawer panel.
 *
 * Manages its own mount/animate lifecycle so consumers only need to toggle `isOpen`.
 * Footer is rendered in a fixed-height strip at the bottom; body scrolls independently.
 */
const Drawer = ({ isOpen, onClose, title, subtitle, children, footer }: DrawerProps) => {
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
          "fixed inset-0 bg-background/60 backdrop-blur-sm z-40 transition-opacity duration-300",
          animating ? "opacity-100" : "opacity-0"
        )}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={cn(
          "fixed right-0 top-0 h-full w-full md:w-[420px] bg-panel border-l border-tertiary/[8%] z-50 overflow-y-auto flex flex-col transition-transform duration-300",
          animating ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex justify-between items-center px-5 md:px-8 py-5 md:py-6 border-b border-tertiary/[8%] flex-shrink-0">
          <div>
            <h2 className="text-xl">{title}</h2>
            {subtitle && (
              <p className="text-tertiary text-sm mt-0.5">{subtitle}</p>
            )}
          </div>
          <Button variant="tertiary" size="mobile" onClick={onClose} aria-label="Close">
            <FaTimes size={16} />
          </Button>
        </div>

        {/* Body */}
        <div className="flex flex-col gap-5 px-5 md:px-8 py-5 md:py-6 flex-1">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="flex gap-3 px-5 md:px-8 py-5 md:py-6 border-t border-tertiary/[8%] flex-shrink-0">
            {footer}
          </div>
        )}
      </div>
    </>
  );
};

export default Drawer;
