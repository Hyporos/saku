import { cn } from "../../../lib/utils";
import { FaSearch, FaEdit, FaCheck, FaTimes } from "react-icons/fa";
import Checkbox from "../../../components/Checkbox";
import DatePicker from "../../../components/DatePicker";
import { SortableHead } from "../components/SortableHead";
import { BatchBar } from "../components/BatchBar";
import { Pagination } from "../components/Pagination";
import { SectionHeader } from "../components/SectionHeader";
import { useAdminContext } from "../context";

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

export const ScoresTab = () => {
  const {
    usersLoading, filteredScores, pagedScores, scorePageCount,
    scoreSearch, setScoreSearch, scoreDateFilter, setScoreDateFilter,
    scorePage, setScorePage, scoreSort, setScoreSort,
    selScores, setSelScores, scoreTabInlineEdit, setScoreTabInlineEdit,
    batchDeleteScores, deleteScore, openCharDetail,
    liveCharacters, liveScores, charDetail,
    toggleSort, toggleSel, toggleAll,
    inlineSaveScoreTab,
  } = useAdminContext();

  return (
    <div className="bg-panel rounded-xl overflow-hidden flex-shrink-0">
      <SectionHeader
        title="Scores"
        count={filteredScores.length}
        createSection="scores"
      />
      <div className="bg-tertiary/20 h-px" />
      <div className="flex items-center gap-3 px-6 py-4 border-b border-tertiary/[6%]">
        <FaSearch size={13} className="text-tertiary/50 flex-shrink-0" />
        <input
          type="text"
          placeholder="Filter by character name..."
          value={scoreSearch}
          onChange={(e) => { setScoreSearch(e.target.value); setScorePage(1); }}
          className="bg-transparent text-sm text-white placeholder-tertiary/40 focus:outline-none flex-1 min-w-0"
        />
        <DatePicker
          mode="single"
          value={scoreDateFilter}
          onChange={(v) => { setScoreDateFilter(scoreDateFilter === v ? "" : v); setScorePage(1); }}
          wednesdayOnly
          subtle
          compact
          placeholder="All Dates"
          align="right"
        />
      </div>
      {usersLoading ? (
        <p className="px-6 py-8 text-sm text-tertiary/50 text-center">Loading...</p>
      ) : (
        <>
          <BatchBar
            count={selScores.size}
            onDelete={batchDeleteScores}
            onClear={() => setSelScores(new Set())}
          />
          <table className="w-full table-fixed">
            <SortableHead
              cols={[
                { label: "Character", field: "character", className: "w-[38%]" },
                { label: "Date",      field: "date",      className: "w-[30%]" },
                { label: "Score",     field: "score",     className: "w-[22%]" },
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
                return (
                  <tr
                    key={`${score.character}-${score.date}-${i}`}
                    className={cn(
                      "border-t border-tertiary/[6%] transition-colors",
                      isEditing ? "bg-background/40" : "hover:bg-background/40"
                    )}
                  >
                    <td className="pl-5 pr-2 py-4" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selScores.has(`${score.character}|${score.date}`)}
                        onChange={() => toggleSel(selScores, `${score.character}|${score.date}`, setSelScores)}
                      />
                    </td>
                    {/* Character — always read-only, clickable to open char detail */}
                    <td className="px-6 py-4 text-sm">
                      <button
                        className="text-accent hover:text-white transition-colors text-left"
                        onClick={() => {
                          const c = liveCharacters.find((x) => x.name === score.character);
                          if (c) openCharDetail(c, undefined, charDetail ?? undefined);
                        }}
                      >
                        {score.character}
                      </button>
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
                            <button onClick={inlineSaveScoreTab} title="Confirm" className="text-[#669A68] hover:text-white transition-colors">
                              <FaCheck size={14} />
                            </button>
                            <button onClick={() => setScoreTabInlineEdit(null)} title="Cancel" className="text-[#A46666] hover:text-white transition-colors">
                              <FaTimes size={16} />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
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
                              className="text-tertiary hover:text-accent transition-colors"
                            >
                              <FaEdit size={14} />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); deleteScore(score.character, score.date, score._id); }}
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
              {pagedScores.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-sm text-tertiary/50 text-center">
                    {scoreSearch ? `No scores matching "${scoreSearch}"` : "No scores found"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
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
  );
};
