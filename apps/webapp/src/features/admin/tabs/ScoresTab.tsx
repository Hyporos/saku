import { useState } from "react";
import { cn } from "../../../lib/utils";
import { FaSearch, FaEdit, FaCheck, FaTimes, FaHistory, FaTrash } from "react-icons/fa";
import Checkbox from "../../../components/Checkbox";
import DatePicker from "../../../components/DatePicker";
import { SortableHead } from "../components/SortableHead";
import { BatchPopup } from "../components/BatchPopup";
import { FilterSidebar, FilterTrigger } from "../components/FilterSidebar";
import { Pagination } from "../components/Pagination";
import { SectionHeader } from "../components/SectionHeader";
import { useAdminContext } from "../context";
import { Button } from "../../../components/Button";

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

export const ScoresTab = () => {
  const {
    usersLoading, filteredScores, pagedScores, scorePageCount,
    scoreSearch, setScoreSearch, scoreDateFilter, setScoreDateFilter,
    scorePage, setScorePage, scoreSort, setScoreSort,
    selScores, setSelScores, scoreTabInlineEdit, setScoreTabInlineEdit,
    batchDeleteScores, deleteScore, openCharDetail,
    liveCharacters, liveScores,
    toggleSort, toggleSel, toggleAll,
    inlineSaveScoreTab,
  } = useAdminContext();

  const [filtersOpen, setFiltersOpen] = useState(false);

  return (
    <>
    <div className="bg-panel rounded-xl overflow-visible flex-shrink-0 flex flex-col md:h-[760px]">
      <SectionHeader
        title="Scores"
        count={filteredScores.length}
        createSection="scores"
      />
      <div className="bg-tertiary/20 h-px flex-shrink-0" />
      {/* Filter bar — search + date picker inline, filter icon on mobile opens sidebar */}
      <div className="flex items-center gap-3 px-6 h-[63px] border-b border-tertiary/[6%] flex-shrink-0">
        <FaSearch size={13} className="text-tertiary/50 flex-shrink-0 mb-0.5" />
        <input
          type="text"
          placeholder="Filter by character name..."
          value={scoreSearch}
          onChange={(e) => { setScoreSearch(e.target.value); setScorePage(1); }}
          className="bg-transparent text-sm text-white placeholder-tertiary/40 focus:outline-none flex-1 min-w-0"
        />
        {/* Desktop: date picker inline */}
        <div className="hidden md:block">
          <DatePicker
            mode="single"
            value={scoreDateFilter}
            onChange={(v) => { setScoreDateFilter(scoreDateFilter === v ? "" : v); setScorePage(1); }}
            clearable
            wednesdayOnly
            subtle
            compact
            placeholder="All Dates"
            align="right"
          />
        </div>
        {/* Mobile: filter icon opens sidebar */}
        <FilterTrigger
          onClick={() => setFiltersOpen(true)}
          hasActiveFilters={!!scoreSearch || !!scoreDateFilter}
          className="md:hidden"
        />
      </div>
      {usersLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-tertiary/50">Loading...</p>
        </div>
      ) : (
        <>
          <BatchPopup
            count={selScores.size}
            onDelete={batchDeleteScores}
            onClear={() => setSelScores(new Set())}
          />
          <div className="overflow-y-auto overflow-x-auto md:flex-1 md:min-h-0 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-panel [&::-webkit-scrollbar-thumb]:bg-tertiary/20 [&::-webkit-scrollbar-thumb]:rounded-full">
            {pagedScores.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center gap-3 text-tertiary/50">
                <FaHistory size={24} />
                <p className="text-sm">{scoreSearch ? `No scores matching "${scoreSearch}"` : "No scores found"}</p>
              </div>
            ) : (
              <table className="w-full table-auto">
                <SortableHead
                  theadClassName="sticky top-0 bg-panel z-10"
                  cols={[
                    { label: "Character", field: "character" },
                    { label: "Date",      field: "date"      },
                    { label: "Score",     field: "score"     },
                  ]}
                  sort={scoreSort}
                  onSort={(f) => { toggleSort(scoreSort, f, setScoreSort); setScorePage(1); }}
                  onSelectAll={() => toggleAll(pagedScores.map((s) => `${s.character}|${s.date}`), selScores, setSelScores)}
                  allSelected={pagedScores.length > 0 && pagedScores.every((s) => selScores.has(`${s.character}|${s.date}`))}
                  someSelected={pagedScores.some((s) => selScores.has(`${s.character}|${s.date}`))}
                />
              <tbody>
                {pagedScores.map((score, i) => {
                const isEditing =
                  scoreTabInlineEdit?.origCharacter === score.character &&
                  scoreTabInlineEdit?.origDate === score.date;
                const hasScoreChange =
                  isEditing && Number(scoreTabInlineEdit!.scoreValue) !== score.score;
                const hasDateChange =
                  isEditing && scoreTabInlineEdit!.dateValue !== score.date;
                const canConfirm =
                  isEditing &&
                  !!scoreTabInlineEdit!.dateValue.trim() &&
                  !!scoreTabInlineEdit!.scoreValue.trim() &&
                  (hasScoreChange || hasDateChange);
                return (
                  <tr
                    key={`${score.character}-${score.date}-${i}`}
                    className={cn(
                      "border-t border-tertiary/[6%] transition-colors",
                      isEditing ? "bg-background/40" : "hover:bg-background/40"
                    )}
                  >
                    <td className="pl-6 pr-2 py-4" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selScores.has(`${score.character}|${score.date}`)}
                        onChange={() => toggleSel(selScores, `${score.character}|${score.date}`, setSelScores)}
                      />
                    </td>
                    {/* Character — always read-only, clickable to open char detail */}
                    <td className="px-6 py-4 text-sm">
                      <Button
                        variant="tertiary"
                        onClick={() => {
                          const c = liveCharacters.find((x) => x.name === score.character);
                          if (c) openCharDetail(c, undefined, undefined, "scores");
                        }}
                        className="h-auto px-0 py-0 border-0 text-accent hover:text-white text-left"
                      >
                        {score.character}
                      </Button>
                    </td>
                    {/* Date — editable when in edit mode */}
                    <td className="px-6 py-4 text-sm" onClick={(e) => e.stopPropagation()}>
                      {isEditing ? (
                        <div className="flex flex-col gap-1">
                          <DatePicker
                            subtle compact wednesdayOnly
                            value={scoreTabInlineEdit!.dateValue}
                            onChange={(v) => setScoreTabInlineEdit((s) => s && { ...s, dateValue: v })}
                          />
                          {scoreTabInlineEdit!.dateValue &&
                            scoreTabInlineEdit!.dateValue !== scoreTabInlineEdit!.origDate &&
                            liveScores.some(
                              (s) =>
                                s.character === scoreTabInlineEdit!.origCharacter &&
                                s.date === scoreTabInlineEdit!.dateValue
                            ) && (
                              <p className="text-[#A46666] text-xs">Warning — score exists for selected date</p>
                            )}
                        </div>
                      ) : (
                        <span className="text-tertiary">{score.date}</span>
                      )}
                    </td>
                    {/* Score — editable when in edit mode */}
                    <td className="px-6 py-4 text-sm" onClick={(e) => e.stopPropagation()}>
                      {isEditing ? (
                        <input
                          type="number"
                          value={scoreTabInlineEdit!.scoreValue}
                          onChange={(e) => setScoreTabInlineEdit((s) => s && { ...s, scoreValue: e.target.value })}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") inlineSaveScoreTab();
                            if (e.key === "Escape") setScoreTabInlineEdit(null);
                          }}
                          className="w-[74px] bg-background border border-tertiary/20 rounded-lg px-2 py-1 text-sm text-white focus:outline-none focus:border-accent/40 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          autoFocus
                        />
                      ) : (
                        <span className={cn(score.score === 0 && "text-[#A46666]")}>
                          {score.score.toLocaleString()}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-4">
                        {isEditing ? (
                          <>
                            <Button
                              variant="inline"
                              onClick={inlineSaveScoreTab}
                              disabled={!canConfirm}
                              title="Confirm"
                              className={cn(
                                canConfirm ? "text-[#669A68] hover:text-white" : "text-[#669A68]/35 cursor-default"
                              )}
                            >
                              <FaCheck size={14} style={{ marginBottom: "2px" }} />
                            </Button>
                            <Button variant="inline" onClick={() => setScoreTabInlineEdit(null)} title="Cancel" className="text-[#A46666] hover:text-white">
                              <FaTimes size={16} style={{ marginBottom: "2px" }} />
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              variant="inline"
                              onClick={(e) => {
                                e.stopPropagation();
                                setScoreTabInlineEdit({
                                  scoreId: score._id,
                                  origCharacter: score.character,
                                  origDate: score.date,
                                  dateValue: score.date,
                                  scoreValue: String(score.score),
                                });
                              }}
                              title="Edit"
                              className="text-tertiary/40 hover:text-accent"
                            >
                              <FaEdit size={14} style={{ marginBottom: "2px" }} />
                            </Button>
                            <Button
                              variant="inline"
                              onClick={(e) => { e.stopPropagation(); deleteScore(score.character, score.date, score._id); }}
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
            page={scorePage}
            total={filteredScores.length}
            pageCount={scorePageCount}
            onPrev={() => setScorePage((p) => p - 1)}
            onNext={() => setScorePage((p) => p + 1)}
          />
        </>
      )}
    </div>
    <FilterSidebar
      isOpen={filtersOpen}
      onClose={() => setFiltersOpen(false)}
      hasActiveFilters={!!scoreDateFilter}
      onClear={() => { setScoreDateFilter(""); setScorePage(1); }}
    >
      <div className="flex flex-col gap-1.5">
        <label className="text-xs text-tertiary/70 uppercase tracking-wider font-medium">Date</label>
        <DatePicker
          mode="single"
          value={scoreDateFilter}
          onChange={(v) => { setScoreDateFilter(scoreDateFilter === v ? "" : v); setScorePage(1); }}
          clearable
          wednesdayOnly
          subtle
          compact
          placeholder="All Dates"
          align="right"
        />
      </div>
    </FilterSidebar>
    </>
  );
};
