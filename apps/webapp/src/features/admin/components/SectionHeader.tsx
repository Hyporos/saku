import type { ReactNode } from "react";
import { FaPlus, FaSpinner } from "react-icons/fa";
import type { Section } from "../types";
import { useAdminContext } from "../context";
import { Button } from "../../../components/Button";

interface SectionHeaderProps {
  title: string;
  count: number;
  /** Shows a spinner beside the count. */
  loading?: boolean;
  canCreate?: boolean;
  createSection?: Section;
  /** Extra controls rendered before the default create button (or as the sole action). */
  extra?: ReactNode;
}

export const SectionHeader = ({
  title,
  count,
  loading = false,
  canCreate = true,
  createSection,
  extra,
}: SectionHeaderProps) => {
  const { openCreate } = useAdminContext();

  return (
    <div className="flex justify-between items-center px-6 h-[70px] flex-shrink-0">
      <div className="flex items-center gap-3">
        <h2 className="text-xl">{title}</h2>
        <span className="bg-background text-tertiary text-xs rounded-full px-2.5 py-0.5 border border-tertiary/20">
          {count}
        </span>
        {loading && <FaSpinner size={13} className="animate-spin text-tertiary/40 mt-0.5" />}
      </div>
      <div className="flex items-center gap-2">
        {extra}
        {canCreate && createSection && (
          <Button
            variant="primary"
            size="mobile"
            onClick={() => openCreate(createSection)}
            className="md:h-[30px] md:w-auto md:px-3"
          >
            <FaPlus size={11} className="mb-px shrink-0" />
            <span className="hidden md:inline">Add New</span>
          </Button>
        )}
      </div>
    </div>
  );
};
