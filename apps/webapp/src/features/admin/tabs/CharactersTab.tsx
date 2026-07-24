import { useState } from "react";
import { cn } from "../../../lib/utils";
import { FaUserAlt, FaPlus } from "react-icons/fa";
import Checkbox from "../../../components/Checkbox";
import CopyId from "../../../components/CopyId";
import { SortableHead } from "../components/SortableHead";
import { BatchPopup } from "../components/BatchPopup";
import { Pagination } from "../components/Pagination";
import { SectionHeader } from "../components/SectionHeader";
import { SearchInput } from "../components/SearchInput";
import { EmptyState } from "../components/EmptyState";
import { ListPanel } from "../components/ListPanel";
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
      <ListPanel
        header={
          <SectionHeader
            title="Characters"
            count={filteredChars.length}
            canCreate={false}
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
        }
        filter={
          <SearchInput
            value={charSearch}
            onChange={(v) => { setCharSearch(v); setCharPage(1); }}
            placeholder="Filter by name or Discord ID..."
          />
        }
        loading={usersLoading}
        isEmpty={pagedChars.length === 0}
        empty={
          <EmptyState
            icon={<FaUserAlt size={24} />}
            message={charSearch ? `No characters matching "${charSearch}"` : "No characters found"}
          />
        }
        batchBar={
          <BatchPopup
            count={selChars.size}
            onDelete={batchDeleteChars}
            onClear={() => setSelChars(new Set())}
          />
        }
        pagination={
          <Pagination
            page={charPage}
            total={filteredChars.length}
            pageCount={charPageCount}
            onPrev={() => setCharPage((p) => p - 1)}
            onNext={() => setCharPage((p) => p + 1)}
          />
        }
      >
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
      </ListPanel>

      <LinkCharacterModal isOpen={linkModalOpen} onClose={() => setLinkModalOpen(false)} />
    </>
  );
};
