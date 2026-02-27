import { cn } from "../../../lib/utils";
import {
  FaArrowLeft, FaCheck, FaTimes, FaEdit, FaTrash,
  FaExternalLinkAlt, FaHistory, FaPlus, FaUserAlt,
  FaExchangeAlt, FaUnlink,
} from "react-icons/fa";
import Checkbox from "../../../components/Checkbox";
import DatePicker from "../../../components/DatePicker";
import CopyId from "../../../components/CopyId";
import Select from "../../../components/Select";
import { SortableHead } from "../components/SortableHead";
import { BatchBar } from "../components/BatchBar";
import { Pagination } from "../components/Pagination";
import { useAdminContext } from "../context";
import { toInputDate } from "../utils";
import { GRAPH_COLORS, SCORE_DETAIL_PAGE_SIZE } from "../constants";
import { rgbCss } from "../utils";
import type { UserDoc } from "../types";

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

export const CharacterDetail = () => {
  const {
    charDetail, setCharDetail, userData, ownerData, charApiData, charApiDataFor, charApiLoading, charApiError,
    charEdits, setCharEdits, charEditsDirty,
    memberSinceDirty, setMemberSinceDirty, graphColorDirty, setGraphColorDirty,
    detailScoreSort, setDetailScoreSort, detailScorePage, setDetailScorePage,
    detailDateFrom, setDetailDateFrom, detailDateTo, setDetailDateTo,
    scoreInlineEdit, setScoreInlineEdit, selDetailScores, setSelDetailScores,
    setDrawer, setTransferModal,
    liveScores,
    openUserDetail, goBackFromTrail, backTargetLabel,
    saveCharEdits, saveMemberSince, saveGraphColor,
    deleteCharacter, deleteScore, batchDeleteDetailScores,
    inlineSaveScore, toggleSel, toggleAll, toggleSort,
  } = useAdminContext();

  if (!charDetail) return null;

  // Sort score history
  let detailScores = [...charDetail.scores];
  if (detailScoreSort) {
    detailScores.sort((a, b) => {
      if (detailScoreSort.field === "score") {
        return detailScoreSort.dir === "asc" ? a.score - b.score : b.score - a.score;
      }
      const cmp = a.date.localeCompare(b.date);
      return detailScoreSort.dir === "asc" ? cmp : -cmp;
    });
  }

  // Apply date range filter only when both ends are selected
  if (detailDateFrom && detailDateTo) {
    detailScores = detailScores.filter((e) => e.date >= detailDateFrom && e.date <= detailDateTo);
  }

  // Pagination for score history
  const detailScorePageCount = Math.max(1, Math.ceil(detailScores.length / SCORE_DETAIL_PAGE_SIZE));
  const pagedDetailScores = detailScores.slice(
    (detailScorePage - 1) * SCORE_DETAIL_PAGE_SIZE,
    detailScorePage * SCORE_DETAIL_PAGE_SIZE
  );

  // Participation rate across ALL scores (not just filtered)
  const allScores = charDetail.scores;
  const participated = allScores.filter((s) => s.score > 0).length;
  const total = allScores.length;
  const participationRate = total > 0 ? Math.round((participated / total) * 100) : 0;
  const bestScore = allScores.length ? Math.max(...allScores.map((s) => s.score)) : 0;

  // Only use API data once confirmed for this exact character to prevent stale-data flash
  const apiReady = !!charApiData && charApiDataFor === charDetail.name;
  const levelLine =
    !apiReady && charApiLoading
      ? "…"
      : apiReady
        ? `Level ${charApiData!.level} ${charApiData!.characterClassName ?? ""}`
        : charApiError
          ? "Could not fetch ranking data"
          : "";

  // Avatar source — prefer live MapleStory API image once confirmed for this character
  const avatarSrc = apiReady ? charApiData!.characterImgURL : (charDetail.avatar || null);

  const rankingsUrl = `https://www.nexon.com/maplestory/rankings/north-america/overall-ranking/legendary?world_type=heroic&search_type=character-name&search=${encodeURIComponent(charDetail.name)}`;

  const handleBack = () => {
    setCharDetail(null);
    goBackFromTrail();
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Back button */}
      <button
        onClick={handleBack}
        className="flex items-center gap-2 text-sm text-tertiary hover:text-white transition-colors self-start"
      >
        <FaArrowLeft size={12} />
        {`Back to ${backTargetLabel}`}
      </button>

      {/* Header — avatar panel */}
      <div className="bg-panel rounded-xl flex overflow-hidden" style={{ minHeight: "110px" }}>
        <div className="w-28 bg-panel flex items-end justify-center shrink-0 p-3">
          {avatarSrc ? (
            <img
              src={avatarSrc}
              alt={charDetail.name}
              className="h-full w-full object-contain"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          ) : (
            <FaUserAlt size={22} className="text-tertiary/30 mb-4" />
          )}
        </div>
        <div className="flex-1 px-6 py-5 flex items-center justify-between min-w-0">
          <div className="min-w-0">
            <a
              href={rankingsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex items-center gap-2 text-xl hover:text-accent transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              {charDetail.name}
              <FaExternalLinkAlt size={12} className="text-tertiary/50 flex-shrink-0 group-hover:text-white transition-colors" />
            </a>
            <p className="text-tertiary text-sm mt-0.5">{levelLine}</p>
          </div>
          {charEditsDirty && (
            <button
              onClick={saveCharEdits}
              className="text-xs px-3 py-1.5 bg-accent/15 text-accent border border-accent/30 rounded-lg hover:bg-accent/25 transition-colors shrink-0 ml-4"
            >
              Save
            </button>
          )}
          <div className="flex items-center gap-2 ml-2">
            <button
              onClick={(e) => { e.stopPropagation(); setTransferModal({ isOpen: true, char: charDetail }); }}
              title="Transfer character to another user"
              className="flex items-center gap-1.5 text-xs text-tertiary border border-tertiary/20 hover:border-tertiary/40 hover:text-white rounded-lg px-2.5 py-1.5 transition-colors shrink-0"
            >
              <FaExchangeAlt size={11} /> Transfer Character
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); deleteCharacter(charDetail.userId, charDetail.name); }}
              title="Unlink character"
              className="flex items-center gap-1.5 text-xs text-[#A46666]/70 hover:text-[#A46666] border border-[#A46666]/20 hover:border-[#A46666]/40 rounded-lg px-2.5 py-1.5 transition-colors shrink-0"
            >
              <FaUnlink size={11} /> Unlink Character
            </button>
          </div>
        </div>
      </div>

      {/* Info rows */}
      <div className="bg-panel rounded-xl divide-y divide-tertiary/[6%]">
        {/* Owner — clicking navigates to that user's detail page */}
        <div className="px-6 py-4 flex items-center gap-4">
          <span className="text-xs text-tertiary uppercase tracking-wide font-medium w-32 shrink-0">User</span>
          <button
            onClick={() => {
              const found = userData.find((u) => String(u._id) === String(charDetail.userId));
              if (found) {
                setCharDetail(null);
                openUserDetail(found);
              } else if (ownerData) {
                setCharDetail(null);
                openUserDetail({
                  _id: ownerData._id, graphColor: "", characters: [],
                  username: ownerData.username, nickname: ownerData.nickname,
                  avatarUrl: ownerData.avatarUrl, joinedAt: ownerData.joinedAt ?? null,
                  role: (ownerData.role as UserDoc["role"]) ?? null,
                });
              }
            }}
            className="flex items-center gap-2 min-w-0 hover:text-accent transition-colors text-left"
          >
            {ownerData?.avatarUrl && (
              <img src={ownerData.avatarUrl} alt="" className="w-5 h-5 rounded-full shrink-0" />
            )}
            <span className="text-sm truncate">
              {ownerData ? (ownerData.nickname ?? ownerData.username ?? ownerData._id) : "—"}
            </span>
          </button>
          <span className="text-xs text-tertiary/50 shrink-0 ml-1">
            <CopyId id={charDetail.userId} />
          </span>
        </div>

        {/* Member Since — subtle compact DatePicker with inline confirm/cancel */}
        <div className="px-6 py-4 flex items-center gap-4">
          <span className="text-xs text-tertiary uppercase tracking-wide font-medium w-32 shrink-0">Member Since</span>
          <DatePicker
            subtle
            compact
            value={charEdits.memberSince}
            onChange={(v) => {
              setCharEdits((p) => ({ ...p, memberSince: v }));
              setMemberSinceDirty(true);
            }}
          />
          {memberSinceDirty && (
            <div className="flex items-center gap-3">
              <button onClick={saveMemberSince} title="Confirm" className="text-[#669A68] hover:text-white transition-colors">
                <FaCheck size={13} />
              </button>
              <button
                onClick={() => {
                  setCharEdits((p) => ({ ...p, memberSince: toInputDate(charDetail.memberSince) }));
                  setMemberSinceDirty(false);
                }}
                title="Cancel"
                className="text-[#A46666] hover:text-white transition-colors"
              >
                <FaTimes size={16} />
              </button>
            </div>
          )}
        </div>

        {/* Graph Color */}
        <div className="px-6 py-4 flex items-center gap-4">
          <span className="text-xs text-tertiary uppercase tracking-wide font-medium w-32 shrink-0">Graph Color</span>
          <div className="flex items-center gap-2.5 w-[126px]">
            <Select
              variant="color"
              className="w-[126px]"
              options={GRAPH_COLORS.map((c) => ({ label: c.name, value: c.value, color: rgbCss(c.value) }))}
              value={charEdits.graphColor}
              onChange={(v) => { setCharEdits((p) => ({ ...p, graphColor: v })); setGraphColorDirty(true); }}
            />
            {graphColorDirty && (
              <>
                <button onClick={saveGraphColor} title="Confirm" className="text-[#669A68] hover:text-white transition-colors">
                  <FaCheck size={13} />
                </button>
                <button
                  onClick={() => {
                    setCharEdits((p) => ({ ...p, graphColor: charDetail!.graphColor ?? "255,189,213" }));
                    setGraphColorDirty(false);
                  }}
                  title="Cancel"
                  className="text-[#A46666] hover:text-white transition-colors"
                >
                  <FaTimes size={16} />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Personal Best */}
        <div className="px-6 py-4 flex items-center gap-4">
          <span className="text-xs text-tertiary uppercase tracking-wide font-medium w-32 shrink-0">Personal Best</span>
          <span className="text-sm">{bestScore > 0 ? bestScore.toLocaleString() : "—"}</span>
        </div>

        {/* Participation */}
        <div className="px-6 py-4 flex items-center gap-4">
          <span className="text-xs text-tertiary uppercase tracking-wide font-medium w-32 shrink-0">Participation</span>
          <span className="text-sm">
            {participated}/{total}
            <span className={cn("ml-1.5", participationRate === 100 ? "text-accent" : "text-tertiary")}>
              ({participationRate}%)
            </span>
          </span>
        </div>
      </div>

      {/* Score history */}
      <div className="bg-panel rounded-xl flex-shrink-0">
        <div className="px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h3 className="text-lg">Score History</h3>
            <span className="text-tertiary/60 text-sm mt-1">{total} entries</span>
          </div>
          <div className="flex items-center gap-3">
            {charDetail.scores.length > 0 && (
              <DatePicker
                mode="range"
                from={detailDateFrom}
                to={detailDateTo}
                onRangeChange={(f, t) => { setDetailDateFrom(f); setDetailDateTo(t); setDetailScorePage(1); }}
                clearable
                placeholder="All Dates"
                align="right"
                subtle
                compact
                wednesdayOnly
                dropUp
              />
            )}
            <button
              onClick={() =>
                setDrawer({
                  isOpen: true,
                  mode: "create",
                  section: "scores",
                  data: { character: charDetail.name, _fromCharDetail: true },
                })
              }
              className="flex items-center gap-2 bg-accent/10 hover:bg-accent/15 text-accent text-sm rounded-lg px-3 py-1 transition-colors"
            >
              <FaPlus size={12} style={{ marginBottom: "1px" }} />
              Add Score
            </button>
          </div>
        </div>
        <div className="bg-tertiary/20 h-px" />
        {charDetail.scores.length === 0 ? (
          <div className="px-6 py-12 flex flex-col items-center gap-3 text-tertiary/50">
            <FaHistory size={24} />
            <p className="text-sm">No scores recorded</p>
          </div>
        ) : (
          <>
            <BatchBar
              count={selDetailScores.size}
              onDelete={batchDeleteDetailScores}
              onClear={() => setSelDetailScores(new Set())}
            />
            <table className="w-full table-fixed">
              <SortableHead
                cols={[
                  { label: "Date",  field: "date"  },
                  { label: "Score", field: "score" },
                ]}
                sort={detailScoreSort}
                onSort={(f) => {
                  toggleSort(detailScoreSort, f, setDetailScoreSort);
                  setDetailScorePage(1);
                }}
                onSelectAll={() =>
                  toggleAll(pagedDetailScores.map((e) => e.date), selDetailScores, setSelDetailScores)
                }
                allSelected={pagedDetailScores.length > 0 && pagedDetailScores.every((e) => selDetailScores.has(e.date))}
                someSelected={pagedDetailScores.some((e) => selDetailScores.has(e.date))}
              />
              <tbody>
                {pagedDetailScores.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12">
                      <div className="flex flex-col items-center gap-3 text-tertiary/50">
                        <FaHistory size={24} />
                        <p className="text-sm">No scores in selected range</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  pagedDetailScores.map((entry, i) => {
                  const isEditing = scoreInlineEdit?.origDate === entry.date;
                  return (
                    <tr
                      key={`${entry.date}-${i}`}
                      className={cn(
                        "border-t border-tertiary/[6%] transition-colors",
                        isEditing ? "bg-background/40" : "hover:bg-background/40"
                      )}
                    >
                      <td className="pl-5 pr-2 py-4 w-10">
                        <Checkbox
                          checked={selDetailScores.has(entry.date)}
                          onChange={() => toggleSel(selDetailScores, entry.date, setSelDetailScores)}
                        />
                      </td>
                      {/* Date */}
                      <td className="px-6 py-4 text-sm" onClick={(e) => e.stopPropagation()}>
                        {isEditing ? (
                          <div className="flex flex-col gap-1">
                            <DatePicker
                              subtle compact wednesdayOnly
                              value={scoreInlineEdit!.dateValue}
                              onChange={(v) => setScoreInlineEdit((s) => s && { ...s, dateValue: v })}
                            />
                            {scoreInlineEdit!.dateValue &&
                              scoreInlineEdit!.dateValue !== scoreInlineEdit!.origDate &&
                              liveScores.some(
                                (s) =>
                                  s.character === charDetail.name &&
                                  s.date === scoreInlineEdit!.dateValue
                              ) && (
                                <p className="text-[#A46666] text-xs">Warning — score exists for selected date</p>
                              )}
                          </div>
                        ) : (
                          <span>{entry.date}</span>
                        )}
                      </td>
                      {/* Score */}
                      <td className="px-6 py-4 text-sm" onClick={(e) => e.stopPropagation()}>
                        {isEditing ? (
                          <input
                            type="number"
                            value={scoreInlineEdit!.scoreValue}
                            onChange={(e) => setScoreInlineEdit((s) => s && { ...s, scoreValue: e.target.value })}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") inlineSaveScore();
                              if (e.key === "Escape") setScoreInlineEdit(null);
                            }}
                            className="w-[74px] bg-background border border-tertiary/20 rounded-lg px-2 py-1 text-sm text-white focus:outline-none focus:border-accent/40 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            autoFocus
                          />
                        ) : (
                          <span className={cn(entry.score === 0 && "text-[#A46666]")}>
                            {entry.score.toLocaleString()}
                          </span>
                        )}
                      </td>
                      {/* Actions */}
                      <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-4">
                          {isEditing ? (
                            <>
                              <button
                                onClick={inlineSaveScore}
                                title="Confirm"
                                className="text-[#669A68] hover:text-white transition-colors"
                              >
                                <FaCheck size={14} />
                              </button>
                              <button
                                onClick={() => setScoreInlineEdit(null)}
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
                                  setScoreInlineEdit({ scoreId: entry._id, origDate: entry.date, dateValue: entry.date, scoreValue: String(entry.score) });
                                }}
                                title="Edit"
                                className="text-tertiary hover:text-accent transition-colors"
                              >
                                <FaEdit size={14} />
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); deleteScore(charDetail.name, entry.date, entry._id); }}
                                title="Delete"
                                className="text-tertiary hover:text-[#A46666] transition-colors"
                              >
                                <FaTrash size={14} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                  })
                )}
              </tbody>
            </table>
            <Pagination
              page={detailScorePage}
              total={detailScores.length}
              pageCount={detailScorePageCount}
              onPrev={() => setDetailScorePage((p) => p - 1)}
              onNext={() => setDetailScorePage((p) => p + 1)}
            />
          </>
        )}
      </div>
    </div>
  );
};
