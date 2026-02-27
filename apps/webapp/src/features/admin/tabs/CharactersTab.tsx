import { cn } from "../../../lib/utils";
import { FaSearch } from "react-icons/fa";
import Checkbox from "../../../components/Checkbox";
import CopyId from "../../../components/CopyId";
import { SortableHead } from "../components/SortableHead";
import { BatchBar } from "../components/BatchBar";
import { Pagination } from "../components/Pagination";
import { SectionHeader } from "../components/SectionHeader";
import { RowActions } from "../components/RowActions";
import { useAdminContext } from "../context";

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

export const CharactersTab = () => {
  const {
    usersLoading, filteredChars, pagedChars, charPageCount,
    charSearch, setCharSearch, charPage, setCharPage,
    charSort, setCharSort, selChars, setSelChars,
    batchDeleteChars, deleteCharacter, openCharDetail,
    toggleSort, toggleSel, toggleAll,
  } = useAdminContext();

  return (
    <div className="bg-panel rounded-xl overflow-hidden flex-shrink-0">
      <SectionHeader
        title="Characters"
        count={filteredChars.length}
        canCreate={false}
        createSection="characters"
      />
      <div className="bg-tertiary/20 h-px" />
      <div className="flex items-center gap-3 px-6 py-4 border-b border-tertiary/[6%]">
        <FaSearch size={13} className="text-tertiary/50 flex-shrink-0" />
        <input
          type="text"
          placeholder="Filter by name or Discord ID..."
          value={charSearch}
          onChange={(e) => { setCharSearch(e.target.value); setCharPage(1); }}
          className="bg-transparent text-sm text-white placeholder-tertiary/40 focus:outline-none flex-1 min-w-0"
        />
      </div>
      {usersLoading ? (
        <p className="px-6 py-8 text-sm text-tertiary/50 text-center">Loading...</p>
      ) : (
        <>
          <BatchBar
            count={selChars.size}
            onDelete={batchDeleteChars}
            onClear={() => setSelChars(new Set())}
          />
          <table className="w-full table-fixed">
            <SortableHead
              cols={[
                { label: "Name",          field: "name",              className: "w-[22%]" },
                { label: "Discord ID",    field: "userId",            className: "w-[28%]" },
                { label: "Member Since",  field: "memberSince",       className: "w-[20%]" },
                { label: "Participation", field: "participationRate", className: "w-[20%]" },
              ]}
              sort={charSort}
              onSort={(f) => toggleSort(charSort, f, setCharSort)}
              onSelectAll={() => toggleAll(pagedChars.map((c) => `${c.userId}|${c.name}`), selChars, setSelChars)}
              allSelected={pagedChars.length > 0 && pagedChars.every((c) => selChars.has(`${c.userId}|${c.name}`))}
              someSelected={pagedChars.some((c) => selChars.has(`${c.userId}|${c.name}`))}
            />
            <tbody>
              {pagedChars.map((char) => (
                <tr
                  key={`${char.userId}-${char.name}`}
                  onClick={() => openCharDetail(char)}
                  className="border-t border-tertiary/[6%] hover:bg-background/40 transition-colors cursor-pointer"
                >
                  <td className="pl-5 pr-2 py-4" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selChars.has(`${char.userId}|${char.name}`)}
                      onChange={() => toggleSel(selChars, `${char.userId}|${char.name}`, setSelChars)}
                    />
                  </td>
                  <td className="px-6 py-4 text-sm text-accent">{char.name}</td>
                  <td className="px-6 py-4 text-xs text-tertiary/50 font-mono">
                    <CopyId id={char.userId} />
                  </td>
                  <td className="px-6 py-4 text-sm text-tertiary">{char.memberSince}</td>
                  <td className="px-6 py-4 text-sm">
                    <span className={cn(char.participationRate === 100 && "text-accent")}>
                      {char.participationRate}%
                    </span>
                    <span className="text-tertiary/50 ml-1 text-xs">
                      ({char.scores.filter((s) => s.score > 0).length}/{char.scores.length})
                    </span>
                  </td>
                  <RowActions
                    onDelete={() => deleteCharacter(char.userId, char.name)}
                  />
                </tr>
              ))}
              {pagedChars.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-sm text-tertiary/50 text-center">
                    {charSearch ? `No characters matching "${charSearch}"` : "No characters found"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <Pagination
            page={charPage}
            total={filteredChars.length}
            pageCount={charPageCount}
            onPrev={() => setCharPage((p) => p - 1)}
            onNext={() => setCharPage((p) => p + 1)}
          />
        </>
      )}
    </div>
  );
};
