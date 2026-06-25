import { useState } from "react";
import { cn } from "../../../lib/utils";
import { FaSearch, FaUserAlt, FaPlus } from "react-icons/fa";
import Checkbox from "../../../components/Checkbox";
import CopyId from "../../../components/CopyId";
import { SortableHead } from "../components/SortableHead";
import { BatchPopup } from "../components/BatchPopup";
import { Pagination } from "../components/Pagination";
import { SectionHeader } from "../components/SectionHeader";
import { RowActions } from "../components/RowActions";
import { LinkCharacterModal } from "../components/LinkCharacterModal";
import { useAdminContext } from "../context";
import { Button } from "../../../components/Button";

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

export const CharactersTab = () => {
  const {
    usersLoading, filteredChars, pagedChars, charPageCount,
    charSearch, setCharSearch, charPage, setCharPage,
    charSort, setCharSort, selChars, setSelChars,
    batchDeleteChars, setUnlinkModal, openCharDetail,
    toggleSort, toggleSel, toggleAll,
  } = useAdminContext();

  const [linkModalOpen, setLinkModalOpen] = useState(false);

  return (
    <>
    <div className="bg-panel rounded-xl overflow-visible flex-shrink-0 flex flex-col md:h-[760px]">
      <SectionHeader
        title="Characters"
        count={filteredChars.length}
        canCreate={false}
        createSection="characters"
        extra={
          <Button
            variant="primary"
            size="mobile"
            onClick={() => setLinkModalOpen(true)}
            title="Link Character"
            className="md:h-[30px] md:w-auto md:px-3"
          >
            <FaPlus size={11} style={{ marginBottom: "1px" }} />
            <span className="hidden md:inline">Add New</span>
          </Button>
        }
      />
      <div className="bg-tertiary/20 h-px flex-shrink-0" />
      {/* Filter bar — search inline, + filter icon on mobile */}
      <div className="flex items-center gap-3 px-6 h-[63px] border-b border-tertiary/[6%] flex-shrink-0">
        <FaSearch size={13} className="text-tertiary/50 flex-shrink-0 mb-0.5" />
        <input
          type="text"
          placeholder="Filter by name or Discord ID..."
          value={charSearch}
          onChange={(e) => { setCharSearch(e.target.value); setCharPage(1); }}
          className="bg-transparent text-sm text-white placeholder-tertiary/40 focus:outline-none flex-1 min-w-0"
        />
      </div>
      {usersLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-tertiary/50">Loading...</p>
        </div>
      ) : (
        <>
          <BatchPopup
            count={selChars.size}
            onDelete={batchDeleteChars}
            onClear={() => setSelChars(new Set())}
          />
          <div className="overflow-y-auto overflow-x-auto md:flex-1 md:min-h-0 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-panel [&::-webkit-scrollbar-thumb]:bg-tertiary/20 [&::-webkit-scrollbar-thumb]:rounded-full">
            {pagedChars.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center gap-3 text-tertiary/50">
                <FaUserAlt size={24} />
                <p className="text-sm">{charSearch ? `No characters matching "${charSearch}"` : "No characters found"}</p>
              </div>
            ) : (
              <table className="w-full table-auto min-w-[700px]">
                <SortableHead
                  theadClassName="sticky top-0 bg-panel z-10"
                  cols={[
                    { label: "Name",          field: "name"              },
                    { label: "Discord ID",    field: "userId"            },
                    { label: "Member Since",  field: "memberSince"       },
                    { label: "Participation", field: "participationRate" },
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
                  <td className="pl-6 pr-2 py-4" onClick={(e) => e.stopPropagation()}>
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
                    onDelete={() => setUnlinkModal({ isOpen: true, char })}
                  />
                </tr>
                ))}
              </tbody>
              </table>
            )}
          </div>
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

    <LinkCharacterModal isOpen={linkModalOpen} onClose={() => setLinkModalOpen(false)} />
  </>
  );
};
