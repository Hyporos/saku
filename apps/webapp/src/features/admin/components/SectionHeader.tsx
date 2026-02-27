import type { ReactNode } from "react";
import { FaPlus } from "react-icons/fa";
import type { Section } from "../types";
import { useAdminContext } from "../context";

interface SectionHeaderProps {
  title: string;
  count: number;
  canCreate?: boolean;
  createSection: Section;
  extra?: ReactNode;
}

export const SectionHeader = ({
  title,
  count,
  canCreate = true,
  createSection,
  extra,
}: SectionHeaderProps) => {
  const { openCreate } = useAdminContext();

  return (
    <div className="flex justify-between items-center px-6 py-5">
      <div className="flex items-center gap-3">
        <h2 className="text-xl">{title}</h2>
        <span className="bg-background text-tertiary text-xs rounded-full px-2.5 py-0.5 border border-tertiary/20">
          {count}
        </span>
      </div>
      <div className="flex items-center gap-2">
        {extra}
        {canCreate && (
          <button
            onClick={() => openCreate(createSection)}
            className="flex items-center gap-2 bg-accent/10 hover:bg-accent/15 text-accent text-sm rounded-lg px-4 py-1.5 transition-colors"
          >
            <FaPlus size={11} style={{ marginBottom: "1px" }} />
            Add New
          </button>
        )}
      </div>
    </div>
  );
};
