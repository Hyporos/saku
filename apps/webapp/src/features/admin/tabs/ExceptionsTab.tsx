import { cn } from "../../../lib/utils";
import { FaSearch, FaEdit, FaCheck, FaTimes } from "react-icons/fa";
import Checkbox from "../../../components/Checkbox";
import AutocompleteInput from "../../../components/AutocompleteInput";
import { SortableHead } from "../components/SortableHead";
import { BatchBar } from "../components/BatchBar";
import { Pagination } from "../components/Pagination";
import { SectionHeader } from "../components/SectionHeader";
import { useAdminContext } from "../context";

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

export const ExceptionsTab = () => {
  const {
    exceptionsLoading, filteredExceptions, pagedExcs, excPageCount,
    excSearch, setExcSearch, excPage, setExcPage,
    excSort, setExcSort, selExcs, setSelExcs,
    excInlineEdit, setExcInlineEdit,
    batchDeleteExcs, deleteException, openCharDetail,
    liveCharacters, charDetail,
    toggleSort, toggleSel, toggleAll,
    inlineSaveException,
  } = useAdminContext();

  return (
    <div className="bg-panel rounded-xl overflow-hidden flex-shrink-0">
      <SectionHeader
        title="Exceptions"
        count={filteredExceptions.length}
        createSection="exceptions"
      />
      <div className="bg-tertiary/20 h-px" />
      <div className="flex items-center gap-3 px-6 py-4 border-b border-tertiary/[6%]">
        <FaSearch size={13} className="text-tertiary/50 flex-shrink-0" />
        <input
          type="text"
          placeholder="Filter by character or exception..."
          value={excSearch}
          onChange={(e) => { setExcSearch(e.target.value); setExcPage(1); }}
          className="bg-transparent text-sm text-white placeholder-tertiary/40 focus:outline-none w-full max-w-xs"
        />
      </div>
      {exceptionsLoading ? (
        <p className="px-6 py-8 text-sm text-tertiary/50 text-center">Loading...</p>
      ) : (
        <>
          <BatchBar
            count={selExcs.size}
            onDelete={batchDeleteExcs}
            onClear={() => setSelExcs(new Set())}
          />
          <table className="w-full table-fixed">
            <SortableHead
              cols={[
                { label: "Character", field: "name",      className: "w-[42%]" },
                { label: "Exception", field: "exception", className: "w-[42%]" },
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
                return (
                  <tr
                    key={exc._id}
                    className={cn(
                      "border-t border-tertiary/[6%] transition-colors",
                      isEditing ? "bg-background/40" : "hover:bg-background/40"
                    )}
                  >
                    <td className="pl-5 pr-2 py-4 w-10">
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
                        />
                      ) : (
                        <button
                          className="text-accent hover:text-white transition-colors text-left"
                          onClick={() => {
                            const c = liveCharacters.find((x) => x.name === exc.name);
                            if (c) openCharDetail(c, undefined, charDetail ?? undefined);
                          }}
                        >
                          {exc.name}
                        </button>
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
                            <button
                              onClick={inlineSaveException}
                              title="Confirm"
                              className="text-[#669A68] hover:text-white transition-colors"
                            >
                              <FaCheck size={14} />
                            </button>
                            <button
                              onClick={() => setExcInlineEdit(null)}
                              title="Cancel"
                              className="text-[#A46666] hover:text-white transition-colors"
                            >
                              <FaTimes size={16} />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setExcInlineEdit({ id: exc._id, name: exc.name, exception: exc.exception });
                              }}
                              title="Edit"
                              className="text-tertiary hover:text-accent transition-colors"
                            >
                              <FaEdit size={14} />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); deleteException(exc._id, exc.name); }}
                              title="Delete"
                              className="text-tertiary hover:text-[#A46666] transition-colors"
                            >
                              <FaTimes size={16} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {pagedExcs.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-sm text-tertiary/50 text-center">
                    {excSearch ? `No exceptions matching "${excSearch}"` : "No exceptions found"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
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
  );
};
