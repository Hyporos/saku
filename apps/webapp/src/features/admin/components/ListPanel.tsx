import type { ReactNode } from "react";
import { cn } from "../../../lib/utils";
import Spinner from "../../../components/Spinner";

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

const SCROLL_CLASSES =
  "overflow-y-auto overflow-x-auto md:flex-1 md:min-h-0 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-panel [&::-webkit-scrollbar-thumb]:bg-tertiary/20 [&::-webkit-scrollbar-thumb]:rounded-full";

interface ListPanelProps {
  /** Panel header — typically a <SectionHeader>. */
  header: ReactNode;
  /** Filter bar contents (e.g. <SearchInput> + trailing controls), wrapped in the standard bar. */
  filter?: ReactNode;
  /** Full custom filter bar, replacing the standard wrapper. Use for nonstandard layouts. */
  filterBar?: ReactNode;
  loading?: boolean;
  isEmpty?: boolean;
  /** Shown in place of the table when isEmpty — typically an <EmptyState>. */
  empty?: ReactNode;
  /** Optional bar rendered above the table (e.g. <BatchPopup>). */
  batchBar?: ReactNode;
  /** Rendered below the table — typically a <Pagination>. */
  pagination?: ReactNode;
  /** The table. */
  children: ReactNode;
}

/**
 * Shared shell for admin list tabs: panel card + header + filter bar + a scrolling
 * table region with loading / empty states and pagination. Keeps the six list tabs
 * structurally identical so only their columns and rows differ.
 */
export const ListPanel = ({
  header,
  filter,
  filterBar,
  loading,
  isEmpty,
  empty,
  batchBar,
  pagination,
  children,
}: ListPanelProps) => (
  <div className="bg-panel rounded-xl overflow-visible flex-shrink-0 flex flex-col md:h-[760px]">
    {header}
    <div className="bg-tertiary/20 h-px flex-shrink-0" />

    {filterBar ??
      (filter && (
        <div className="flex items-center gap-3 px-6 h-[63px] border-b border-tertiary/[6%] flex-shrink-0">
          {filter}
        </div>
      ))}

    {loading ? (
      <Spinner center />
    ) : (
      <>
        {batchBar}
        <div className={cn(SCROLL_CLASSES)}>{isEmpty ? empty : children}</div>
        {pagination}
      </>
    )}
  </div>
);
