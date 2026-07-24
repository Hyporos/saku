import { useState, useMemo, useEffect, useCallback } from "react";
import { FaHistory, FaTrash, FaTimes, FaChevronUp, FaChevronDown, FaCheck, FaEye } from "react-icons/fa";
import { cn } from "../../../lib/utils";
import DatePicker from "../../../components/DatePicker";
import Dropdown from "../../../components/Dropdown";
import Badge, { type BadgeProps } from "../../../components/Badge";
import { FilterSidebar, FilterTrigger } from "../components/FilterSidebar";
import { Pagination } from "../components/Pagination";
import { SectionHeader } from "../components/SectionHeader";
import { SearchInput } from "../components/SearchInput";
import { EmptyState } from "../components/EmptyState";
import { ListPanel } from "../components/ListPanel";
import { Button } from "../../../components/Button";
import { useAdminContext } from "../context";
import { useNotifications } from "../../../context/NotificationContext";
import useAuth from "../../../hooks/useAuth";
import type { ActionLogCategory } from "../types";

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

const LOG_PAGE_SIZE = 10;

const CATEGORIES: ActionLogCategory[] = ["create", "edit", "delete", "transfer", "rename", "finalize", "scan"];

const CATEGORY_LABEL: Record<ActionLogCategory, string> = {
  create:   "Create",
  edit:     "Edit",
  delete:   "Delete",
  transfer: "Transfer",
  rename:   "Rename",
  finalize: "Finalize",
  scan:     "Scan",
};

// Badge variant per category
const CATEGORY_BADGE_VARIANT: Record<ActionLogCategory, BadgeProps["variant"]> = {
  create:   "green",
  edit:     "primary",
  delete:   "red",
  transfer: "primary",
  rename:   "primary",
  finalize: "green",
  scan:     "green",
};

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

const formatTimestamp = (iso: string): string => {
  const d = new Date(iso);
  return d.toLocaleString("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
};

type DetailRow = { label: string; oldValue: string | null; newValue: string };

const parseDetailRows = (details?: string): DetailRow[] => {
  if (!details) return [];

  return details
    .split("|")
    .map((part) => part.trim())
    .flatMap<DetailRow>((part) => {
      const renamed = part.match(/^Renamed from (.+) to (.+)$/i);
      if (renamed) {
        return [{ label: "Character Name", oldValue: renamed[1], newValue: renamed[2] }];
      }

      const updatedFromTo = part.match(/^(.+?) updated from (.+) to (.+)$/i);
      if (updatedFromTo) {
        return [{ label: updatedFromTo[1], oldValue: updatedFromTo[2], newValue: updatedFromTo[3] }];
      }

      const updatedTo = part.match(/^(.+?) updated to (.+)$/i);
      if (updatedTo) {
        return [{ label: updatedTo[1], oldValue: "—", newValue: updatedTo[2] }];
      }

      const keyValue = part.match(/^([^:]+):\s*(.+)$/);
      if (keyValue) {
        return [{ label: keyValue[1].trim(), oldValue: null, newValue: keyValue[2].trim() }];
      }

      return [];
    });
};

// Returns the free-text summary prefix of a details string (text before any parseable segments).
// If the first segment is itself parseable (key:value, updated-from, etc.), returns null.
const extractDetailSummary = (details?: string | null): string | null => {
  if (!details) return null;
  const firstSegment = details.split("|")[0].trim();
  if (!firstSegment) return null;
  if (/^([^:]+):\s*(.+)$/.test(firstSegment)) return null;
  if (/updated from|updated to|Renamed from/i.test(firstSegment)) return null;
  return firstSegment;
};

// Parses scan action log detail segments into { name, score, status } rows
const parseScanEntries = (details?: string): { name: string; score: string; status: string }[] => {
  if (!details) return [];
  return details.split("|").map(part => part.trim()).flatMap(part => {
    // Pattern: "CharName (Type): value"
    const withStatus = part.match(/^(.+?)\s+\(([^)]+)\):\s*(.+)$/);
    if (withStatus) {
      const [, name, type, rawScore] = withStatus;
      const scoreType = type.toLowerCase();
      let status = type;
      let score = rawScore;
      if (scoreType === "score anomaly") {
        // "12345 above previous 67890" → score is just the first number
        const numMatch = rawScore.match(/^([\d,]+)/);
        score = numMatch ? Number(numMatch[1].replace(/,/g, "")).toLocaleString() : rawScore;
        status = "Anomaly";
      } else if (scoreType === "not found") {
        status = "Not Found";
      } else if (scoreType === "sandbag") {
        status = "Sandbag";
      } else if (scoreType === "zero score") {
        status = "Zero";
      }
      const numericScore = Number(rawScore.replace(/,/g, ""));
      if (!isNaN(numericScore) && scoreType !== "score anomaly") {
        score = numericScore.toLocaleString();
      }
      return [{ name: name.trim(), score, status }];
    }
    // Plain: "CharName: score"
    const plain = part.match(/^(.+?):\s*(.+)$/);
    if (plain) {
      const numericScore = Number(plain[2].replace(/,/g, ""));
      const score = !isNaN(numericScore) ? numericScore.toLocaleString() : plain[2];
      return [{ name: plain[1].trim(), score, status: "ok" }];
    }
    return [];
  });
};

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

export const ActionLogTab = () => {
  const { actionLog, clearActionLog, confirm, closeModal, liveUsers } = useAdminContext();
  const { notify } = useNotifications();
  const { user } = useAuth();
  const ownerId = import.meta.env.VITE_OWNER_ID as string | undefined;
  const isOwner = user?.id === ownerId;
  const [search, setSearch] = useState("");
  const [actorFilter, setActorFilter] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<ActionLogCategory | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sort, setSort] = useState<{ field: string; dir: "asc" | "desc" } | null>({ field: "timestamp", dir: "desc" });
  const [page, setPage] = useState(1);
  const [selectedEntry, setSelectedEntry] = useState<(typeof actionLog)[number] | null>(null);
  const [detailsVisible, setDetailsVisible] = useState(false);
  const [detailsAnimating, setDetailsAnimating] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const openDetails = (entry: (typeof actionLog)[number]) => {
    setSelectedEntry(entry);
    setDetailsVisible(true);
    requestAnimationFrame(() => requestAnimationFrame(() => setDetailsAnimating(true)));
  };

  const closeDetails = () => {
    setDetailsAnimating(false);
    setTimeout(() => {
      setDetailsVisible(false);
      setSelectedEntry(null);
    }, 220);
  };

  const toggleSort = (field: string) => {
    setSort((current) => {
      if (current?.field === field) {
        if (current.dir === "asc") return { field, dir: "desc" };
        return null;
      }
      return { field, dir: "asc" };
    });
    setPage(1);
  };

  const resolveActorName = useCallback(
    (actorId?: string | null): string => {
      if (!actorId) return "Unknown";
      if (user?.id === actorId && user?.username) return user.username;
      const found = liveUsers.find((u) => u.id === actorId);
      return found?.username ?? found?.nickname ?? actorId;
    },
    [liveUsers, user]
  );

  const actorOptions = useMemo(() => {
    const actorMap = new Map<string, string>();

    // Seed the logged-in user first — the owner has no DB entry so they won't
    // appear in liveUsers and would otherwise fall back to showing a raw ID.
    if (user?.id && user?.username) {
      actorMap.set(user.id, user.username);
    }

    liveUsers
      .filter((u) => u.role === "bee" || (!!ownerId && u.id === ownerId))
      .forEach((u) => actorMap.set(u.id, (u.username ?? u.id).trim()));

    actionLog.forEach((entry) => {
      if (entry.actorId && !actorMap.has(entry.actorId)) {
        actorMap.set(entry.actorId, entry.actorId);
      }
    });

    return [
      { value: "all", label: "All Users" },
      ...[...actorMap.entries()]
        .sort((a, b) => a[1].localeCompare(b[1]))
        .map(([id, name]) => ({ value: id, label: name })),
    ];
  }, [actionLog, liveUsers, ownerId, user]);

  const filtered = useMemo(() => {
    const next = actionLog.filter((entry) => {
      if (actorFilter) {
        if (entry.actorId !== actorFilter) return false;
      }
      if (categoryFilter && entry.category !== categoryFilter) return false;
      if (dateFrom || dateTo) {
        const ts = new Date(entry.timestamp).valueOf();
        if (dateFrom && ts < new Date(dateFrom).valueOf()) return false;
        if (dateTo && ts > new Date(dateTo + "T23:59:59.999").valueOf()) return false;
      }
      if (search) {
        const q = search.toLowerCase();
        const actorName = resolveActorName(entry.actorId);
        return (
          actorName.toLowerCase().includes(q) ||
          entry.action.toLowerCase().includes(q) ||
          entry.target.toLowerCase().includes(q) ||
          (entry.details ?? "").toLowerCase().includes(q)
        );
      }
      return true;
    });

    if (!sort) return next;
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...next].sort((a, b) => {
      if (sort.field === "actor") {
        return dir * resolveActorName(a.actorId).localeCompare(resolveActorName(b.actorId));
      }
      if (sort.field === "category") {
        return dir * a.category.localeCompare(b.category);
      }
      if (sort.field === "action") {
        return dir * a.action.localeCompare(b.action);
      }
      if (sort.field === "target") {
        return dir * a.target.localeCompare(b.target);
      }
      if (sort.field === "timestamp") {
        return dir * (new Date(a.timestamp).valueOf() - new Date(b.timestamp).valueOf());
      }
      return 0;
    });
  }, [actionLog, search, actorFilter, categoryFilter, dateFrom, dateTo, sort, resolveActorName]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / LOG_PAGE_SIZE));
  const paged = filtered.slice((page - 1) * LOG_PAGE_SIZE, page * LOG_PAGE_SIZE);

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  const categoryOptions = [
    { value: "all", label: "All Actions" },
    ...CATEGORIES.map((cat) => ({ value: cat, label: CATEGORY_LABEL[cat] })),
  ];

  const resetPage = (cb: () => void) => { cb(); setPage(1); };

  const handleClear = () =>
    confirm({
      variant: "confirm",
      colorVariant: "owner",
      title: "Clear action log",
      description: "This will remove all entries from the action log.",
      onConfirm: async () => {
        try {
          await clearActionLog();
          notify("success", "Action log cleared");
          closeModal();
        } catch (e) {
          const ax = e as import("axios").AxiosError<{ error?: string }>;
          notify("error", ax?.response?.data?.error ?? "Failed to clear action log");
          closeModal();
        }
      },
    });

  const shouldHideDetailSummary = (entry: (typeof actionLog)[number]) => {
    if (!entry?.details) return false;
    if (entry.action === "Edit Score") return true;
    if (entry.action === "Transfer Character") return true;
    if (entry.action === "Edit Exception") return true;
    if (entry.action === "Create Score") return true;
    if (entry.action === "Create Exception") return true;
    if (entry.action === "Rename Character") return true;
    if (entry.action === "Link Character") return true;
    if (entry.action !== "Edit Character") return false;
    return /Member Since updated from|Graph Color updated from/i.test(entry.details);
  };

  // Hide the "Changes Made" rows for actions that only need a plain summary statement
  const shouldHideChanges = (entry: (typeof actionLog)[number]) => {
    return entry.action === "Unlink Character";
  };

  return (
    <>
    <ListPanel
      header={
        <SectionHeader
          title="Action Log"
          count={filtered.length}
          canCreate={false}
          extra={
            isOwner && (
              <Button
                variant="owner"
                size="mobile"
                onClick={handleClear}
                disabled={actionLog.length === 0}
                className="md:h-[30px] md:w-auto md:px-3"
              >
                <FaTrash size={11} className="mb-px shrink-0" />
                <span className="hidden md:inline">Clear Log</span>
              </Button>
            )
          }
        />
      }
      isEmpty={paged.length === 0}
      empty={
        <EmptyState
          icon={<FaHistory size={24} />}
          message={actionLog.length === 0 ? "No actions recorded yet." : "No entries match your filters"}
        />
      }
      pagination={
        <Pagination
          page={page}
          total={filtered.length}
          pageCount={pageCount}
          onPrev={() => setPage((p) => p - 1)}
          onNext={() => setPage((p) => p + 1)}
        />
      }
      filterBar={
        <>
      <div className="md:hidden flex items-center gap-2 px-6 h-[63px] border-b border-tertiary/[6%] flex-shrink-0">
        <SearchInput
          value={search}
          onChange={(v) => resetPage(() => setSearch(v))}
          placeholder="Filter by action, target, or details..."
          inputClassName="flex-1"
        />
        <FilterTrigger onClick={() => setFiltersOpen(true)} hasActiveFilters={!!(actorFilter || categoryFilter || dateFrom || dateTo)} />
      </div>
      <div className="hidden md:flex flex-wrap items-center gap-x-2 gap-y-2 px-6 py-3 md:h-[63px] border-b border-tertiary/[6%] flex-shrink-0">
        <SearchInput
          value={search}
          onChange={(v) => resetPage(() => setSearch(v))}
          placeholder="Filter by action, target, or details..."
          inputClassName="flex-1 min-w-[120px]"
        />
        <Dropdown
          variant="plain"
          align="right"
          options={actorOptions}
          value={actorFilter ?? "all"}
          onChange={(v) => resetPage(() => setActorFilter(v === "all" ? null : v))}
          className="w-[115px] flex-shrink-0"
          compact
          subtle
        />
        <Dropdown
          variant="plain"
          align="right"
          options={categoryOptions}
          value={categoryFilter ?? "all"}
          onChange={(v) => resetPage(() => setCategoryFilter(v === "all" ? null : (v as ActionLogCategory)))}
          className="w-[115px] flex-shrink-0"
          compact
          subtle
        />
        <DatePicker
          mode="range"
          from={dateFrom}
          to={dateTo}
          onRangeChange={(f, t) => resetPage(() => { setDateFrom(f); setDateTo(t); })}
          placeholder="Date Range"
          align="right"
          subtle
          compact
          clearable
          className="flex-shrink-0"
        />
      </div>
        </>
      }
    >
          <table className="w-full table-auto min-w-[700px]">
            <thead className="sticky top-0 bg-panel z-10">
              <tr className="border-y border-tertiary/[6%]">
                <th onClick={() => toggleSort("actor")} className="px-6 py-[11.5px] text-left cursor-pointer text-xs text-tertiary/50 font-medium uppercase tracking-wider select-none hover:text-white transition-colors duration-150 align-middle group">
                  <span className="inline-flex items-center gap-1.5">User
                    <span className={cn("inline-flex items-center leading-none transition-all duration-150", sort?.field === "actor" ? "opacity-100" : "opacity-0")}>
                      {sort?.field === "actor" && sort?.dir === "asc" ? <FaChevronUp size={9} /> : <FaChevronDown size={9} />}
                    </span>
                  </span>
                </th>
                <th onClick={() => toggleSort("category")} className="px-6 py-[11.5px] text-left cursor-pointer text-xs text-tertiary/50 font-medium uppercase tracking-wider select-none hover:text-white transition-colors duration-150 align-middle group">
                  <span className="inline-flex items-center gap-1.5">Category
                    <span className={cn("inline-flex items-center leading-none transition-all duration-150", sort?.field === "category" ? "opacity-100" : "opacity-0")}>
                      {sort?.field === "category" && sort?.dir === "asc" ? <FaChevronUp size={9} /> : <FaChevronDown size={9} />}
                    </span>
                  </span>
                </th>
                <th onClick={() => toggleSort("action")} className="px-6 py-[11.5px] text-left cursor-pointer text-xs text-tertiary/50 font-medium uppercase tracking-wider select-none hover:text-white transition-colors duration-150 align-middle group">
                  <span className="inline-flex items-center gap-1.5">Action
                    <span className={cn("inline-flex items-center leading-none transition-all duration-150", sort?.field === "action" ? "opacity-100" : "opacity-0")}>
                      {sort?.field === "action" && sort?.dir === "asc" ? <FaChevronUp size={9} /> : <FaChevronDown size={9} />}
                    </span>
                  </span>
                </th>
                <th onClick={() => toggleSort("target")} className="px-6 py-[11.5px] text-left cursor-pointer text-xs text-tertiary/50 font-medium uppercase tracking-wider select-none hover:text-white transition-colors duration-150 align-middle group">
                  <span className="inline-flex items-center gap-1.5">Target
                    <span className={cn("inline-flex items-center leading-none transition-all duration-150", sort?.field === "target" ? "opacity-100" : "opacity-0")}>
                      {sort?.field === "target" && sort?.dir === "asc" ? <FaChevronUp size={9} /> : <FaChevronDown size={9} />}
                    </span>
                  </span>
                </th>
                <th onClick={() => toggleSort("timestamp")} className="px-6 py-[11.5px] text-left cursor-pointer text-xs text-tertiary/50 font-medium uppercase tracking-wider select-none hover:text-white transition-colors duration-150 align-middle group">
                  <span className="inline-flex items-center gap-1.5">Date &amp; Time (EST)
                    <span className={cn("inline-flex items-center leading-none transition-all duration-150", sort?.field === "timestamp" ? "opacity-100" : "opacity-0")}>
                      {sort?.field === "timestamp" && sort?.dir === "asc" ? <FaChevronUp size={9} /> : <FaChevronDown size={9} />}
                    </span>
                  </span>
                </th>
                <th className="w-[48px] px-6 align-middle" />
              </tr>
            </thead>
            <tbody>
              {paged.map((entry) => {
                const dateTime = formatTimestamp(entry.timestamp);
                return (
                  <tr
                    key={entry.id}
                    className="border-t border-tertiary/[6%] hover:bg-background/40 transition-colors"
                  >
                    <td className="px-6 py-3.5 align-middle">
                      <span className="text-sm text-white">{resolveActorName(entry.actorId)}</span>
                    </td>
                    <td className="px-6 py-3.5 align-middle">
                      <Badge variant={CATEGORY_BADGE_VARIANT[entry.category]}>
                        {CATEGORY_LABEL[entry.category]}
                      </Badge>
                    </td>
                    <td className="px-6 py-3.5 align-middle">
                      <span className="text-sm text-white">{entry.action}</span>
                    </td>
                    <td className="px-6 py-3.5 align-middle overflow-hidden">
                      <span className="text-sm text-tertiary truncate block">{entry.target}</span>
                    </td>
                    <td className="px-6 py-3.5 align-middle">
                      <span className="text-xs text-tertiary/50 tabular-nums">{dateTime}</span>
                    </td>
                    <td className="px-6 py-3.5 align-middle">
                      <div className="flex items-center justify-center w-[14px] ml-auto">
                        {entry.action === "Delete User" || (entry.action === "Unlink Character" && !entry.details) ? (
                          <span className="text-tertiary/30 leading-none select-none" style={{ fontSize: 14, lineHeight: 1 }}>—</span>
                        ) : (
                          <Button
                            variant="inline"
                            onClick={() => openDetails(entry)}
                            className="text-tertiary/40 hover:text-white leading-none"
                          >
                            <FaEye size={14} />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
    </ListPanel>

      {detailsVisible && selectedEntry && (
        <>
          <div
            className={cn(
              "fixed inset-0 bg-black/40 backdrop-blur-[2px] z-[80] transition-opacity duration-200",
              detailsAnimating ? "opacity-100" : "opacity-0"
            )}
            onClick={closeDetails}
          />
          <div className="fixed inset-0 flex items-center justify-center z-[90] pointer-events-none">
            <div
              className={cn(
                "bg-panel border border-tertiary/[8%] rounded-2xl p-6 w-[560px] max-w-[92vw] pointer-events-auto drop-shadow-[0_6px_24px_rgba(0,0,0,0.45)] transition-all duration-200",
                detailsAnimating ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 translate-y-1"
              )}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <Badge variant={CATEGORY_BADGE_VARIANT[selectedEntry.category]}>
                      {CATEGORY_LABEL[selectedEntry.category]}
                    </Badge>
                    <h3 className="text-lg">{selectedEntry.action}</h3>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-0.5 mt-1.5">
                    <p className="text-sm text-tertiary/50">User: <span className="text-white/40">{resolveActorName(selectedEntry.actorId)}</span></p>
                    <p className="text-sm text-tertiary/50">Target: <span className="text-white/40">{selectedEntry.target}</span></p>
                  </div>
                </div>
                <button
                  onClick={closeDetails}
                  aria-label="Close"
                  className="shrink-0 w-7 h-7 flex items-center justify-center rounded-full text-tertiary/40 hover:text-[#C87070] hover:bg-[#C87070]/10 transition-all duration-200"
                >
                  <FaTimes size={11} />
                </button>
              </div>

              {(() => {
                const displaySummary = extractDetailSummary(selectedEntry.details);
                return !shouldHideDetailSummary(selectedEntry) && displaySummary ? (
                  <div className="mt-5 rounded-xl border border-tertiary/[8%] overflow-hidden">
                    <div className="px-4 py-2.5 bg-background/40 border-b border-tertiary/[8%]">
                      <p className="text-xs uppercase tracking-wider text-tertiary/50">Detail Summary</p>
                    </div>
                    <div className="px-4 py-3">
                      <p className="text-sm text-white/90">{displaySummary}</p>
                    </div>
                  </div>
                ) : null;
              })()}

              {selectedEntry.category === "scan" && parseScanEntries(selectedEntry.details).length > 0 && (
                <div className="mt-4 rounded-xl border border-tertiary/[8%] overflow-hidden">
                  <div className="px-4 py-2.5 bg-background/40 border-b border-tertiary/[8%]">
                    <p className="text-xs uppercase tracking-wider text-tertiary/50">Scan Results</p>
                  </div>
                  <div className="max-h-[280px] overflow-y-auto">
                    <table className="w-full text-sm table-fixed">
                      <thead className="sticky top-0 bg-panel border-b border-tertiary/[6%]">
                        <tr>
                          <th className="text-left text-xs text-tertiary font-medium uppercase tracking-wide px-4 py-2">Character</th>
                          <th className="text-center text-xs text-tertiary font-medium uppercase tracking-wide px-4 py-2 w-28">Score</th>
                          <th className="text-center text-xs text-tertiary font-medium uppercase tracking-wide px-4 py-2 w-24">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {parseScanEntries(selectedEntry.details).map((row, idx) => (
                          <tr key={idx} className="border-t border-tertiary/[6%]">
                            <td className="px-4 py-2.5 text-sm text-white">{row.name}</td>
                            <td className="px-4 py-2.5 text-sm text-center tabular-nums text-white">{row.score}</td>
                            <td className="px-4 py-2.5 text-xs text-center">
                              {row.status === "ok" ? (
                                <FaCheck size={11} className="inline text-[#669A68]" />
                              ) : row.status === "Anomaly" ? (
                                <span className="text-[#D4915E]">Anomaly</span>
                              ) : row.status === "Sandbag" ? (
                                <span className="text-[#C8A855]">Sandbag</span>
                              ) : row.status === "Zero" ? (
                                <span className="text-tertiary/50">Zero</span>
                              ) : row.status === "Not Found" ? (
                                <span className="text-[#C87070]">Not Found</span>
                              ) : (
                                <span className="text-tertiary/50">{row.status}</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {selectedEntry.category !== "scan" && parseDetailRows(selectedEntry.details).length > 0 && !shouldHideChanges(selectedEntry) && (
                <div className="mt-4 rounded-xl border border-tertiary/[8%] overflow-hidden">
                  <div className="px-4 py-2.5 bg-background/40 border-b border-tertiary/[8%]">
                    <p className="text-xs uppercase tracking-wider text-tertiary/50">Changes Made</p>
                  </div>
                  <div className="max-h-[280px] overflow-y-auto divide-y divide-tertiary/[8%]">
                    {parseDetailRows(selectedEntry.details).map((row, idx) => (
                      row.oldValue === null ? (
                        <div key={`${row.label}-${idx}`} className="px-4 py-3 grid grid-cols-[1fr_2fr] gap-3 items-start">
                          <p className="text-sm text-white">{row.label}</p>
                          <p className="text-sm text-[#669A68] break-words">{row.newValue}</p>
                        </div>
                      ) : (
                        <div key={`${row.label}-${idx}`} className="px-4 py-3 grid grid-cols-[1fr_1fr_1fr] gap-3 items-start">
                          <p className="text-sm text-tertiary">{row.label}</p>
                          <p className="text-sm text-[#C87070] break-words">{row.oldValue}</p>
                          <p className="text-sm text-[#669A68] break-words">{row.newValue}</p>
                        </div>
                      )
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    <FilterSidebar isOpen={filtersOpen} onClose={() => setFiltersOpen(false)} hasActiveFilters={!!(actorFilter || categoryFilter || dateFrom || dateTo)} onClear={() => resetPage(() => { setActorFilter(null); setCategoryFilter(null); setDateFrom(""); setDateTo(""); })}>
      <div className="flex flex-col gap-1.5">
        <label className="text-xs text-tertiary/70 uppercase tracking-wider font-medium">User</label>
        <Dropdown
          variant="plain"
          options={actorOptions}
          value={actorFilter ?? "all"}
          onChange={(v) => resetPage(() => setActorFilter(v === "all" ? null : v))}
          subtle
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-xs text-tertiary/70 uppercase tracking-wider font-medium">Category</label>
        <Dropdown
          variant="plain"
          options={categoryOptions}
          value={categoryFilter ?? "all"}
          onChange={(v) => resetPage(() => setCategoryFilter(v === "all" ? null : (v as ActionLogCategory)))}
          subtle
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-xs text-tertiary/70 uppercase tracking-wider font-medium">Date Range</label>
        <DatePicker
          mode="range"
          from={dateFrom}
          to={dateTo}
          onRangeChange={(f, t) => resetPage(() => { setDateFrom(f); setDateTo(t); })}
          placeholder="All Dates"
          subtle
          clearable
          align="right"
        />
      </div>
    </FilterSidebar>
    </>
  );
};

// TODO: make so all members are listed as users, probably remove the Delete User from deleting characters.
// TODO: implement culvertping, export, backup system,
// TODO: maybe owner tab that shows all commands and stuff, lets you reload from here too etc.
// todo: action log differ pamel vs command. make admin buttons purple
// todo: Make sure that the scan bot command also logs this the same way. Same with the finalize command from the bot. Also, druu should always be excempt from scan results and finalization
// todo: fix lightbox arrow look
