import { cn } from "../../../lib/utils";
import { FaEdit, FaCheck, FaTimes, FaTrash, FaExclamationCircle } from "react-icons/fa";
import Checkbox from "../../../components/Checkbox";
import AutocompleteInput from "../../../components/AutocompleteInput";
import { SortableHead } from "../components/SortableHead";
import { BatchPopup } from "../components/BatchPopup";
import { Pagination } from "../components/Pagination";
import { SectionHeader } from "../components/SectionHeader";
import { SearchInput } from "../components/SearchInput";
import { EmptyState } from "../components/EmptyState";
import { ListPanel } from "../components/ListPanel";
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

  return (
    <ListPanel
      header={
        <SectionHeader
          title="Exceptions"
          count={filteredExceptions.length}
          createSection="exceptions"
        />
      }
      filter={
        <SearchInput
          value={excSearch}
          onChange={(v) => { setExcSearch(v); setExcPage(1); }}
          placeholder="Filter by character or exception..."
          inputClassName="w-full max-w-xs"
        />
      }
      loading={exceptionsLoading}
      isEmpty={pagedExcs.length === 0}
      empty={
        <EmptyState
          icon={<FaExclamationCircle size={24} />}
          message={excSearch ? `No exceptions matching "${excSearch}"` : "No exceptions found"}
        />
      }
      batchBar={
        <BatchPopup
          count={selExcs.size}
          onDelete={batchDeleteExcs}
          onClear={() => setSelExcs(new Set())}
        />
      }
      pagination={
        <Pagination
          page={excPage}
          total={filteredExceptions.length}
          pageCount={excPageCount}
          onPrev={() => setExcPage((p) => p - 1)}
          onNext={() => setExcPage((p) => p + 1)}
        />
      }
    >
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
    </ListPanel>
  );
};
