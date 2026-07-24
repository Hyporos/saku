import type { ReactNode } from "react";

interface EmptyStateProps {
  icon: ReactNode;
  message: string;
}

/** Centered icon + message, sized to fill the table scroll area. */
export const EmptyState = ({ icon, message }: EmptyStateProps) => (
  <div className="h-full flex flex-col items-center justify-center gap-3 text-tertiary/50">
    {icon}
    <p className="text-sm">{message}</p>
  </div>
);
