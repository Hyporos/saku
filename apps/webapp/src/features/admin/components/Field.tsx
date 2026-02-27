import type { ReactNode } from "react";

interface FieldProps {
  label: string;
  children: ReactNode;
  hint?: string;
}

export const Field = ({ label, children, hint }: FieldProps) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-xs text-tertiary uppercase tracking-wide font-medium">
      {label}
    </label>
    {children}
    {hint && <p className="text-xs text-tertiary/50">{hint}</p>}
  </div>
);
