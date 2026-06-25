import type { ReactNode } from "react";
import { FaPlus } from "react-icons/fa";
import type { Section } from "../types";
import { useAdminContext } from "../context";
import { Button } from "../../../components/Button";

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
    <div className="flex justify-between items-center px-6 h-[70px]">
      <div className="flex items-center gap-3">
        <h2 className="text-xl">{title}</h2>
        <span className="bg-background text-tertiary text-xs rounded-full px-2.5 py-0.5 border border-tertiary/20">
          {count}
        </span>
      </div>
      <div className="flex items-center gap-2">
        {extra}
        {canCreate && (
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
