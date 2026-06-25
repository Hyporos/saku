import { useState, useEffect } from "react";
import { FaTrash } from "react-icons/fa";
import { cn } from "../../../lib/utils";
import { Button } from "../../../components/Button";

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

interface BatchPopupProps {
  count: number;
  onDelete: () => void;
  onClear: () => void;
}

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

// Floating bottom-right popup that appears when rows are selected.
// Notification toasts (z-[200]) always render above this (z-[190]).
export const BatchPopup = ({ count, onDelete, onClear }: BatchPopupProps) => {
  const isActive = count > 0;
  const [mounted, setMounted] = useState(isActive);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isActive) {
      setMounted(true);
      requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
    } else {
      setVisible(false);
      const t = setTimeout(() => setMounted(false), 220);
      return () => clearTimeout(t);
    }
  }, [isActive]);

  if (!mounted) return null;

  return (
    <div
      className={cn(
        "fixed bottom-5 left-1/2 -translate-x-1/2 z-[190] bg-panel border border-tertiary/[10%] rounded-xl px-6 py-3 drop-shadow-[0_4px_24px_rgba(0,0,0,0.55)] flex items-center gap-6 transition-all duration-200",
        visible ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-2 scale-95"
      )}
    >
      <span className="text-sm text-accent font-medium tabular-nums">{count} selected</span>
      <div className="w-px h-4 bg-tertiary/20" />
      <Button
        variant="danger"
        onClick={onDelete}
        icon={<FaTrash size={11} style={{ marginBottom: "1px" }} />}
        className="h-auto py-0 border-0 bg-transparent text-sm hover:bg-transparent"
      >
        Delete Selected
      </Button>
      <div className="w-px h-4 bg-tertiary/20" />
      <Button
        variant="tertiary"
        onClick={onClear}
        className="h-auto py-0 border-0 text-sm"
      >
        Clear
      </Button>
    </div>
  );
};
