import { useState, useMemo, useEffect, useCallback } from "react";
import { FaSearch, FaHistory, FaTrash, FaTimes, FaChevronUp, FaChevronDown } from "react-icons/fa";
import { cn } from "../../../lib/utils";
import Select from "../../../components/Select";
import DatePicker from "../../../components/DatePicker";
import { Pagination } from "../components/Pagination";
import { useAdminContext } from "../context";
import { useNotifications } from "../../../context/NotificationContext";
import useAuth from "../../../hooks/useAuth";
import type { ActionLogCategory } from "../types";

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

const LOG_PAGE_SIZE = 10;

const CATEGORIES: ActionLogCategory[] = ["create", "edit", "delete", "transfer", "rename"];

const CATEGORY_LABEL: Record<ActionLogCategory, string> = {
  create:   "Create",
  edit:     "Edit",
  delete:   "Delete",
  transfer: "Transfer",
  rename:   "Rename",
};

// Pill styles used in table rows and the dropdown accent indicator
const CATEGORY_PILL: Record<ActionLogCategory, string> = {
  create:   "bg-[#669A68]/15 text-[#669A68] border-[#669A68]/30",
  edit:     "bg-orange-900/40 text-[#D4915E] border-orange-800/40",
  delete:   "bg-red-900/40 text-[#C87070] border-red-800/40",
  transfer: "bg-sky-900/40 text-[#6EB3D8] border-sky-800/40",
  rename:   "bg-yellow-900/40 text-[#C8A855] border-yellow-800/40",
};

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

const formatTimestamp = (iso: string): string => {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
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
      const found = liveUsers.find((u) => u.id === actorId);
      return found?.username ?? actorId;
    },
    [liveUsers]
  );

  const actorOptions = useMemo(() => {
    const actorMap = new Map<string, string>();

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
  }, [actionLog, liveUsers, ownerId]);

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
      confirmDanger: true,
      title: "Clear action log",
      description: "This will remove all entries from the action log. This cannot be undone.",
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

  const SortHead = ({ label, field }: { label: string; field: string }) => (
    <button
      type="button"
      onClick={() => toggleSort(field)}
      className="inline-flex items-center gap-1.5 hover:text-white transition-colors"
    >
      <span>{label}</span>
      <span
        className={cn(
          "inline-flex items-center leading-none transition-opacity duration-150 text-accent",
          sort?.field === field ? "opacity-100" : "opacity-0"
        )}
      >
        {sort?.field === field && sort?.dir === "asc" ? <FaChevronUp size={9} /> : <FaChevronDown size={9} />}
      </span>
    </button>
  );

  const shouldHideDetailSummary = (entry: (typeof actionLog)[number]) => {
    if (!entry?.details) return false;
    if (entry.action === "Edit Score") return true;
    if (entry.action === "Transfer Character") return true;
    if (entry.action === "Edit Exception") return true;
    if (entry.action === "Create Score") return true;
    if (entry.action === "Create Exception") return true;
    if (entry.action === "Rename Character") return true;
    if (entry.action !== "Edit Character") return false;
    return /Member Since updated from|Graph Color updated from/i.test(entry.details);
  };

  return (
    <div className="bg-panel rounded-xl overflow-visible flex-shrink-0">

      {/* ⎯ Header ⎯ */}
      <div className="flex justify-between items-center px-6 py-5">
        <div className="flex items-center gap-3">
          <h2 className="text-xl">Action Log</h2>
          <span className="bg-background text-tertiary text-xs rounded-full px-2.5 py-0.5 border border-tertiary/20">
            {filtered.length}
          </span>
        </div>
        {isOwner && (
          <button
            onClick={handleClear}
            disabled={actionLog.length === 0}
            className="w-[115px] flex items-center justify-center gap-2 bg-[#A46666]/15 border border-[#A46666]/30 text-[#C87070] hover:text-white hover:bg-[#A46666]/25 text-sm rounded-lg px-2 py-1.5 transition-colors disabled:opacity-30 disabled:cursor-default"
          >
            <FaTrash size={11} style={{ marginBottom: "1px" }} />
            Clear Log
          </button>
        )}
      </div>

      <div className="bg-tertiary/20 h-px" />

      {/* ⎯ Filters ⎯ */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-tertiary/[6%] flex-wrap">
        <FaSearch size={13} className="text-tertiary/50 flex-shrink-0" />
        <input
          type="text"
          placeholder="Filter by action, target, or details..."
          value={search}
          onChange={(e) => resetPage(() => setSearch(e.target.value))}
          className="bg-transparent text-sm text-white placeholder-tertiary/40 focus:outline-none flex-1 min-w-[160px]"
        />
        <Select
          variant="plain"
          align="right"
          options={actorOptions}
          value={actorFilter ?? "all"}
          onChange={(v) => resetPage(() => setActorFilter(v === "all" ? null : String(v)))}
          className="w-[150px] flex-shrink-0"
        />
        <Select
          variant="plain"
          align="right"
          options={categoryOptions}
          value={categoryFilter ?? "all"}
          onChange={(v) => resetPage(() => setCategoryFilter(v === "all" ? null : (v as ActionLogCategory)))}
          className="w-[115px] flex-shrink-0"
        />
        <DatePicker
          mode="range"
          from={dateFrom}
          to={dateTo}
          onRangeChange={(f, t) => resetPage(() => { setDateFrom(f); setDateTo(t); })}
          placeholder="Date range"
          align="right"
          subtle
          compact
          clearable
          className="flex-shrink-0"
        />
      </div>

      {/* ⎯ Body ⎯ */}
      {actionLog.length === 0 ? (
        <div className="px-6 py-16 flex flex-col items-center gap-3 text-tertiary/50">
          <FaHistory size={24} />
          <p className="text-sm">No actions recorded yet.</p>
        </div>
      ) : paged.length === 0 ? (
        <div className="px-6 py-12 flex flex-col items-center gap-3 text-tertiary/50">
          <FaHistory size={24} />
          <p className="text-sm">No entries match your filters</p>
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-b-xl">
          <table className="w-full table-fixed">
            <thead>
              <tr className="border-b border-tertiary/[8%]">
                <th className="w-[16%] px-4 py-3 text-left">
                  <span className="text-xs text-tertiary/50 font-medium uppercase tracking-wider select-none"><SortHead label="User" field="actor" /></span>
                </th>
                <th className="w-[13%] px-4 py-3 text-left">
                  <span className="text-xs text-tertiary/50 font-medium uppercase tracking-wider select-none"><SortHead label="Category" field="category" /></span>
                </th>
                <th className="w-[22%] px-4 py-3 text-left">
                  <span className="text-xs text-tertiary/50 font-medium uppercase tracking-wider select-none"><SortHead label="Action" field="action" /></span>
                </th>
                <th className="w-[20%] px-4 py-3 text-left">
                  <span className="text-xs text-tertiary/50 font-medium uppercase tracking-wider select-none"><SortHead label="Target" field="target" /></span>
                </th>
                <th className="w-[18%] px-4 py-3 text-left">
                  <span className="text-xs text-tertiary/50 font-medium uppercase tracking-wider select-none"><SortHead label="Date & Time" field="timestamp" /></span>
                </th>
                <th className="w-[16%] px-4 py-3 text-left">
                  <span className="text-xs text-tertiary/50 font-medium uppercase tracking-wider select-none">Details</span>
                </th>
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
                    <td className="px-4 py-3">
                      <span className="text-sm text-white">{resolveActorName(entry.actorId)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("text-xs rounded-full px-2 py-0.5 border", CATEGORY_PILL[entry.category])}>
                        {CATEGORY_LABEL[entry.category]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-white">{entry.action}</span>
                    </td>
                    <td className="px-4 py-3 overflow-hidden">
                      <span className="text-sm text-tertiary truncate block">{entry.target}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-tertiary/50 tabular-nums">{dateTime}</span>
                    </td>
                    <td className="px-4 py-3">
                      {entry.action === "Delete User" || entry.action === "Unlink Character" ? (
                        <span className="text-sm text-tertiary/50">—</span>
                      ) : (
                        <button
                          onClick={() => openDetails(entry)}
                          className="text-xs bg-background/70 border border-tertiary/20 hover:border-accent/40 text-tertiary hover:text-white rounded-lg px-2.5 py-1 transition-colors"
                        >
                          View Details
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>

          <Pagination
            page={page}
            total={filtered.length}
            pageCount={pageCount}
            onPrev={() => setPage((p) => p - 1)}
            onNext={() => setPage((p) => p + 1)}
          />
        </>
      )}

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
                <div>
                  <h3 className="text-lg">{selectedEntry.action}</h3>
                  <p className="text-sm text-tertiary mt-1">Target: {selectedEntry.target}</p>
                </div>
                <button
                  onClick={closeDetails}
                  className="text-tertiary/50 hover:text-white transition-colors"
                  aria-label="Close"
                >
                  <FaTimes size={13} />
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

              {parseDetailRows(selectedEntry.details).length > 0 && (
                <div className="mt-4 rounded-xl border border-tertiary/[8%] overflow-hidden">
                  <div className="px-4 py-2.5 bg-background/40 border-b border-tertiary/[8%]">
                    <p className="text-xs uppercase tracking-wider text-tertiary/50">Changes Made</p>
                  </div>
                  <div className="divide-y divide-tertiary/[8%]">
                    {parseDetailRows(selectedEntry.details).map((row, idx) => (
                      row.oldValue === null ? (
                        <div key={`${row.label}-${idx}`} className="px-4 py-3 grid grid-cols-[1fr_2fr] gap-3 items-start">
                          <p className="text-sm text-tertiary">{row.label}</p>
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
    </div>
  );
};

// TODO: Log /scan
// TODO: Add Add New to the characters list
// TODO: Implement /scan
// TODO: make so all members are listed as users, probably remove the Delete User from deleting characters.
// TODO: implement culvertping, finalize, export, backup system,
// TODO: maybe owner tab that shows all commands and stuff, lets you reload from here too etc.
// todo: action log differ pamel vs command. make admin buttons purple