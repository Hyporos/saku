import { useState } from "react";
import { cn } from "../../../lib/utils";
import { FaSearch, FaEdit, FaCheck, FaTimes, FaTrash, FaExclamationCircle } from "react-icons/fa";
import Checkbox from "../../../components/Checkbox";
import AutocompleteInput from "../../../components/AutocompleteInput";
import { SortableHead } from "../components/SortableHead";
import { BatchPopup } from "../components/BatchPopup";
import { Pagination } from "../components/Pagination";
import { SectionHeader } from "../components/SectionHeader";
import { useAdminContext } from "../context";
import { Button } from "../../../components/Button";

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

export const ExceptionsTab = () => {
  const {
    exceptionsLoading, filteredExceptions, pagedExcs, excPageCount,
    excSearch, setExcSearch, excPage, setExcPage,
    excSort, setExcSort, selExcs, setSelExcs,
    excInlineEdit, setExcInlineEdit,
    batchDeleteExcs, deleteException, openCharDetail,
    liveCharacters,
    toggleSort, toggleSel, toggleAll,
    inlineSaveException,
  } = useAdminContext();

  const [filtersOpen, setFiltersOpen] = useState(false);
  void filtersOpen; void setFiltersOpen;

  return (
    <>
    <div className="bg-panel rounded-xl overflow-visible flex-shrink-0 flex flex-col md:h-[760px]">
      <SectionHeader
        title="Exceptions"
        count={filteredExceptions.length}
        createSection="exceptions"
      />
      <div className="bg-tertiary/20 h-px flex-shrink-0" />
      {/* Filter bar */}
      <div className="flex items-center gap-3 px-6 h-[63px] border-b border-tertiary/[6%] flex-shrink-0">
        <FaSearch size={13} className="text-tertiary/50 flex-shrink-0 mb-0.5" />
        <input
          type="text"
          placeholder="Filter by character or exception..."
          value={excSearch}
          onChange={(e) => { setExcSearch(e.target.value); setExcPage(1); }}
          className="bg-transparent text-sm text-white placeholder-tertiary/40 focus:outline-none w-full max-w-xs"
        />
      </div>
      {exceptionsLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-tertiary/50">Loading...</p>
        </div>
      ) : (
        <>
          <BatchPopup
            count={selExcs.size}
            onDelete={batchDeleteExcs}
            onClear={() => setSelExcs(new Set())}
          />
          <div className="overflow-y-auto overflow-x-auto md:flex-1 md:min-h-0 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-panel [&::-webkit-scrollbar-thumb]:bg-tertiary/20 [&::-webkit-scrollbar-thumb]:rounded-full">
            {pagedExcs.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center gap-3 text-tertiary/50">
                <FaExclamationCircle size={24} />
                <p className="text-sm">{excSearch ? `No exceptions matching "${excSearch}"` : "No exceptions found"}</p>
              </div>
            ) : (
              <table className="w-full table-auto">
                <SortableHead
                  theadClassName="sticky top-0 bg-panel z-10"
                  cols={[
                    { label: "Character", field: "name"      },
                    { label: "Exception", field: "exception" },
                  ]}
                  sort={excSort}
                  onSort={(f) => { toggleSort(excSort, f, setExcSort); setExcPage(1); }}
                  onSelectAll={() => toggleAll(pagedExcs.map((e) => e._id), selExcs, setSelExcs)}
                  allSelected={pagedExcs.length > 0 && pagedExcs.every((e) => selExcs.has(e._id))}
                  someSelected={pagedExcs.some((e) => selExcs.has(e._id))}
                />
              <tbody>
                {pagedExcs.map((exc) => {
                const isEditing = excInlineEdit?.id === exc._id;
                const canConfirm =
                  isEditing &&
                  (excInlineEdit!.name.trim() !== exc.name || excInlineEdit!.exception !== exc.exception);
                return (
                  <tr
                    key={exc._id}
                    className={cn(
                      "border-t border-tertiary/[6%] transition-colors",
                      isEditing ? "bg-background/40" : "hover:bg-background/40"
                    )}
                  >
                    <td className="pl-6 pr-2 py-4 w-10">
                      <Checkbox
                        checked={selExcs.has(exc._id)}
                        onChange={() => toggleSel(selExcs, exc._id, setSelExcs)}
                      />
                    </td>
                    <td className="px-6 py-4 text-sm" onClick={(e) => e.stopPropagation()}>
                      {isEditing ? (
                        <AutocompleteInput
                          value={excInlineEdit!.name}
                          onChange={(v) => setExcInlineEdit((s) => s && { ...s, name: v })}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") inlineSaveException();
                            if (e.key === "Escape") setExcInlineEdit(null);
                          }}
                          suggestions={liveCharacters.map((c) => c.name)}
                          className="w-[175px]"
                          inputClassName="w-full bg-background border border-tertiary/20 rounded-lg px-2 py-1 text-sm text-white focus:outline-none focus:border-accent/40 transition-colors"
                          requireSelection
                        />
                      ) : (
                        <Button
                          variant="tertiary"
                          onClick={() => {
                            const c = liveCharacters.find((x) => x.name === exc.name);
                            if (c) openCharDetail(c, undefined, undefined, "exceptions");
                          }}
                          className="h-auto px-0 py-0 border-0 text-accent hover:text-white text-left"
                        >
                          {exc.name}
                        </Button>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm" onClick={(e) => e.stopPropagation()}>
                      {isEditing ? (
                        <input
                          className="w-[175px] bg-background border border-tertiary/20 rounded-lg px-2 py-1 text-sm text-white focus:outline-none focus:border-accent/40 transition-colors"
                          value={excInlineEdit!.exception}
                          onChange={(e) => setExcInlineEdit((s) => s && { ...s, exception: e.target.value })}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") inlineSaveException();
                            if (e.key === "Escape") setExcInlineEdit(null);
                          }}
                        />
                      ) : (
                        <span className="text-tertiary">{exc.exception}</span>
                      )}
                    </td>
                    <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-4">
                        {isEditing ? (
                          <>
                            <Button
                              variant="inline"
                              onClick={inlineSaveException}
                              disabled={!canConfirm}
                              title="Confirm"
                              className={cn(
                                canConfirm ? "text-[#669A68] hover:text-white" : "text-[#669A68]/35 cursor-default"
                              )}
                            >
                              <FaCheck size={14} style={{ marginBottom: "2px" }} />
                            </Button>
                            <Button
                              variant="inline"
                              onClick={() => setExcInlineEdit(null)}
                              title="Cancel"
                              className="text-[#A46666] hover:text-white"
                            >
                              <FaTimes size={16} style={{ marginBottom: "2px" }} />
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              variant="inline"
                              onClick={(e) => {
                                e.stopPropagation();
                                setExcInlineEdit({ id: exc._id, name: exc.name, exception: exc.exception });
                              }}
                              title="Edit"
                              className="text-tertiary/40 hover:text-accent"
                            >
                              <FaEdit size={14} style={{ marginBottom: "2px" }} />
                            </Button>
                            <Button
                              variant="inline"
                              onClick={(e) => { e.stopPropagation(); deleteException(exc._id, exc.name); }}
                              title="Delete"
                              className="text-[#A46666]/40 hover:text-[#A46666]"
                            >
                              <FaTrash size={14} style={{ marginBottom: "2px" }} />
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              </tbody>
              </table>
            )}
          </div>
          <Pagination
            page={excPage}
            total={filteredExceptions.length}
            pageCount={excPageCount}
            onPrev={() => setExcPage((p) => p - 1)}
            onNext={() => setExcPage((p) => p + 1)}
          />
        </>
      )}
    </div>
    </>
  );
};
