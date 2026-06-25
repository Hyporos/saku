import { useState, useRef, useEffect } from "react";
import { cn } from "../../../lib/utils";
import {
  FaArrowLeft, FaCheck, FaTimes, FaEdit, FaTrash,
  FaExternalLinkAlt, FaHistory, FaPlus, FaUserAlt,
  FaExchangeAlt, FaUnlink, FaPencilAlt, FaEllipsisV,
} from "react-icons/fa";
import Checkbox from "../../../components/Checkbox";
import DatePicker from "../../../components/DatePicker";
import CopyId from "../../../components/CopyId";
import Select from "../../../components/Select";
import { Button } from "../../../components/Button";
import { SortableHead } from "../components/SortableHead";
import { BatchPopup } from "../components/BatchPopup";
import { Pagination } from "../components/Pagination";
import { useAdminContext } from "../context";
import { FilterSidebar, FilterTrigger } from "../components/FilterSidebar";
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
    setDrawer, setTransferModal, setRenameModal, setUnlinkModal,
    liveScores,
    openUserDetail, goBackFromTrail, backTargetLabel,
    saveCharEdits, saveMemberSince, saveGraphColor,
    deleteScore, batchDeleteDetailScores,
    inlineSaveScore, toggleSel, toggleAll, toggleSort,
  } = useAdminContext();

  // Actions dropdown state (hooks must be before any conditional return)
  const [actionsOpen, setActionsOpen] = useState(false);
  const [actionsMounted, setActionsMounted] = useState(false);
  const [actionsAnimating, setActionsAnimating] = useState(false);
  const actionsRef = useRef<HTMLDivElement>(null);

  // Score history filter panel state
  const [scoreFilterOpen, setScoreFilterOpen] = useState(false);

  const openActions = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (actionsOpen) {
      closeActions();
      return;
    }
    setActionsMounted(true);
    requestAnimationFrame(() => requestAnimationFrame(() => setActionsAnimating(true)));
    setActionsOpen(true);
  };
  const closeActions = () => {
    setActionsAnimating(false);
    setActionsOpen(false);
    setTimeout(() => setActionsMounted(false), 200);
  };

  useEffect(() => {
    if (!actionsOpen) return;
    const handler = (e: MouseEvent) => {
      if (actionsRef.current && !actionsRef.current.contains(e.target as Node)) closeActions();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [actionsOpen]);

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
    <>
    <div className="flex flex-col gap-6">
      {/* Back button */}
      <Button
        variant="tertiary"
        size="md"
        onClick={handleBack}
        icon={<FaArrowLeft size={12} />}
        className="self-start h-auto px-0 py-1"
      >
        {`Back to ${backTargetLabel}`}
      </Button>

      {/* Header — avatar panel */}
      <div className="bg-panel rounded-xl flex" style={{ minHeight: "110px" }}>
        <div className="w-28 rounded-l-xl bg-panel flex items-center justify-center shrink-0 p-3">
          {avatarSrc ? (
            <img
              src={avatarSrc}
              alt={charDetail.name}
              className="h-full w-full object-contain"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          ) : (
            <FaUserAlt size={36} className="text-tertiary/30" />
          )}
        </div>
        <div className="flex-1 px-4 md:px-6 py-4 md:py-5 flex flex-wrap items-center gap-x-4 gap-y-3 min-w-0">
          <div className="min-w-0 flex-1">
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
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {charEditsDirty && (
              <Button
                variant="primary"
                size="sm"
                onClick={saveCharEdits}
              >
                Save
              </Button>
            )}
            {/* Desktop: individual action buttons — no dropdown needed */}
            <div className="hidden md:flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                icon={<FaPencilAlt size={10} />}
                onClick={(e) => { e.stopPropagation(); setRenameModal({ isOpen: true, char: charDetail }); }}
              >
                Rename
              </Button>
              <Button
                variant="secondary"
                size="sm"
                icon={<FaExchangeAlt size={10} />}
                onClick={(e) => { e.stopPropagation(); setTransferModal({ isOpen: true, char: charDetail }); }}
              >
                Transfer
              </Button>
              <Button
                variant="danger"
                size="sm"
                icon={<FaUnlink size={10} />}
                onClick={(e) => { e.stopPropagation(); setUnlinkModal({ isOpen: true, char: charDetail }); }}
              >
                Unlink
              </Button>
            </div>
            {/* Mobile: three-dots dropdown */}
            <div ref={actionsRef} className="relative md:hidden">
              <Button
                variant="secondary"
                size="mobile"
                onClick={openActions}
                title="Actions"
                className={cn(actionsOpen && "bg-tertiary/[8%] border-tertiary/40 text-white")}
              >
                <FaEllipsisV size={12} />
              </Button>
              {actionsMounted && (
                <div
                  onTransitionEnd={() => { if (!actionsOpen) setActionsMounted(false); }}
                  className={cn(
                    "absolute right-0 top-full mt-1.5 z-[60] bg-panel border border-tertiary/[10%] rounded-xl drop-shadow-[0_4px_20px_rgba(0,0,0,0.5)] p-1 min-w-[150px] transition-all duration-200 origin-top-right",
                    actionsAnimating ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 -translate-y-1 pointer-events-none"
                  )}
                >
                  <Button
                    variant="tertiary"
                    onClick={(e) => { e.stopPropagation(); closeActions(); setRenameModal({ isOpen: true, char: charDetail }); }}
                    className="w-full justify-start h-auto px-4 py-2 text-sm gap-2.5"
                  >
                    <FaPencilAlt size={11} className="text-tertiary/60 flex-shrink-0" /> Rename
                  </Button>
                  <Button
                    variant="tertiary"
                    onClick={(e) => { e.stopPropagation(); closeActions(); setTransferModal({ isOpen: true, char: charDetail }); }}
                    className="w-full justify-start h-auto px-4 py-2 text-sm gap-2.5"
                  >
                    <FaExchangeAlt size={11} className="text-tertiary/60 flex-shrink-0" /> Transfer
                  </Button>
                  <div className="mx-3 h-px bg-tertiary/[8%] my-1" />
                  <Button
                    variant="danger"
                    onClick={(e) => { e.stopPropagation(); closeActions(); setUnlinkModal({ isOpen: true, char: charDetail }); }}
                    className="w-full justify-start h-auto px-4 py-2 text-sm gap-2.5 bg-transparent hover:bg-[#A46666]/10 border-transparent"
                  >
                    <FaUnlink size={11} className="flex-shrink-0" /> Unlink
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Info rows */}
      <div className="bg-panel rounded-xl divide-y divide-tertiary/[6%]">
        {/* Owner — clicking navigates to that user's detail page */}
        <div className="px-4 md:px-6 py-3.5 flex flex-wrap items-center gap-3">
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
          <span className="text-xs text-tertiary/50 shrink-0">
            <CopyId id={charDetail.userId} />
          </span>
        </div>

        {/* Member Since — subtle compact DatePicker with inline confirm/cancel */}
        <div className="px-4 md:px-6 py-3.5 flex flex-wrap items-center gap-3">
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
              <Button variant="inline" onClick={saveMemberSince} title="Confirm" className="text-[#669A68] hover:text-white">
                <FaCheck size={13} />
              </Button>
              <Button
                variant="inline"
                onClick={() => {
                  setCharEdits((p) => ({ ...p, memberSince: toInputDate(charDetail.memberSince) }));
                  setMemberSinceDirty(false);
                }}
                title="Cancel"
                className="text-[#A46666] hover:text-white"
              >
                <FaTimes size={16} />
              </Button>
            </div>
          )}
        </div>

        {/* Graph Color */}
        <div className="px-4 md:px-6 py-3.5 flex flex-wrap items-center gap-3">
          <span className="text-xs text-tertiary uppercase tracking-wide font-medium w-32 shrink-0">Graph Color</span>
          <Select
            variant="color"
            className="min-w-[126px] flex-shrink-0"
            options={GRAPH_COLORS.map((c) => ({ label: c.name, value: c.value, color: rgbCss(c.value) }))}
            value={charEdits.graphColor}
            onChange={(v) => { setCharEdits((p) => ({ ...p, graphColor: v })); setGraphColorDirty(true); }}
          />
          {graphColorDirty && (
            <div className="flex items-center gap-3">
              <Button variant="inline" onClick={saveGraphColor} title="Confirm" className="text-[#669A68] hover:text-white">
                <FaCheck size={13} />
              </Button>
              <Button
                variant="inline"
                onClick={() => {
                  setCharEdits((p) => ({ ...p, graphColor: charDetail!.graphColor ?? "255,189,213" }));
                  setGraphColorDirty(false);
                }}
                title="Cancel"
                className="text-[#A46666] hover:text-white"
              >
                <FaTimes size={16} />
              </Button>
            </div>
          )}
        </div>

        {/* Personal Best */}
        <div className="px-4 md:px-6 py-3.5 flex flex-wrap items-center gap-3">
          <span className="text-xs text-tertiary uppercase tracking-wide font-medium w-32 shrink-0">Personal Best</span>
          <span className="text-sm">{bestScore > 0 ? bestScore.toLocaleString() : "—"}</span>
        </div>

        {/* Participation */}
        <div className="px-4 md:px-6 py-3.5 flex flex-wrap items-center gap-3">
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
        <div className="px-4 md:px-6 py-4 md:py-5 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-3 flex-1">
            <h3 className="text-lg">Score History</h3>
            <span className="text-tertiary/60 text-sm self-center">{total} entries</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {/* Mobile: filter trigger opens sidebar */}
            {charDetail.scores.length > 0 && (
              <div className="md:hidden">
                <FilterTrigger
                  onClick={() => setScoreFilterOpen(true)}
                  hasActiveFilters={!!(detailDateFrom || detailDateTo)}
                />
              </div>
            )}
            {/* Desktop: inline date range picker */}
            {charDetail.scores.length > 0 && (
              <div className="hidden md:block">
                <DatePicker
                  mode="range"
                  from={detailDateFrom}
                  to={detailDateTo}
                  onRangeChange={(f, t) => { setDetailDateFrom(f); setDetailDateTo(t); setDetailScorePage(1); }}
                  clearable
                  wednesdayOnly
                  align="right"
                  placeholder="Date Range"
                  compact
                  subtle
                />
              </div>
            )}
            <Button
              variant="primary"
              size="mobile"
              onClick={() =>
                setDrawer({
                  isOpen: true,
                  mode: "create",
                  section: "scores",
                  data: { character: charDetail.name, _fromCharDetail: true },
                })
              }
              className="md:h-[30px] md:w-auto md:px-3"
            >
              <FaPlus size={11} className="mb-px shrink-0" />
              <span className="hidden md:inline">Add Score</span>
            </Button>
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
            <BatchPopup
              count={selDetailScores.size}
              onDelete={batchDeleteDetailScores}
              onClear={() => setSelDetailScores(new Set())}
            />
            <div className="overflow-x-auto">
            <table className="w-full table-auto">
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
                  const hasScoreChange =
                    isEditing && Number(scoreInlineEdit!.scoreValue) !== entry.score;
                  const hasDateChange =
                    isEditing && scoreInlineEdit!.dateValue !== entry.date;
                  const canConfirm =
                    isEditing &&
                    !!scoreInlineEdit!.dateValue.trim() &&
                    !!scoreInlineEdit!.scoreValue.trim() &&
                    (hasScoreChange || hasDateChange);
                  return (
                    <tr
                      key={`${entry.date}-${i}`}
                      className={cn(
                        "border-t border-tertiary/[6%] transition-colors",
                        isEditing ? "bg-background/40" : "hover:bg-background/40"
                      )}
                    >
                      <td className="pl-6 pr-2 py-3.5 w-10">
                        <Checkbox
                          checked={selDetailScores.has(entry.date)}
                          onChange={() => toggleSel(selDetailScores, entry.date, setSelDetailScores)}
                        />
                      </td>
                      {/* Date */}
                      <td className="px-6 py-3.5 text-sm" onClick={(e) => e.stopPropagation()}>
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
                      <td className="px-6 py-3.5 text-sm" onClick={(e) => e.stopPropagation()}>
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
                      <td className="px-6 py-3.5" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-4">
                          {isEditing ? (
                            <>
                              <Button
                                variant="inline"
                                onClick={inlineSaveScore}
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
                                onClick={() => setScoreInlineEdit(null)}
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
                                  setScoreInlineEdit({ scoreId: entry._id, origDate: entry.date, dateValue: entry.date, scoreValue: String(entry.score) });
                                }}
                                title="Edit"
                                className="text-tertiary/40 hover:text-accent"
                              >
                                <FaEdit size={14} style={{ marginBottom: "2px" }} />
                              </Button>
                              <Button
                                variant="inline"
                                onClick={(e) => { e.stopPropagation(); deleteScore(charDetail.name, entry.date, entry._id); }}
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
                  })
                )}
              </tbody>
            </table>
            </div>
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
    <FilterSidebar
      isOpen={scoreFilterOpen}
      onClose={() => setScoreFilterOpen(false)}
      hasActiveFilters={!!(detailDateFrom || detailDateTo)}
      onClear={() => { setDetailDateFrom(""); setDetailDateTo(""); setDetailScorePage(1); }}
    >
      <div className="flex flex-col gap-1.5">
        <label className="text-xs text-tertiary/70 uppercase tracking-wider font-medium">Date Range</label>
        <DatePicker
          mode="range"
          from={detailDateFrom}
          to={detailDateTo}
          onRangeChange={(f, t) => { setDetailDateFrom(f); setDetailDateTo(t); setDetailScorePage(1); }}
          clearable
          wednesdayOnly
          align="right"
          placeholder="All Dates"
        />
      </div>
    </FilterSidebar>
  </>
  );
};
