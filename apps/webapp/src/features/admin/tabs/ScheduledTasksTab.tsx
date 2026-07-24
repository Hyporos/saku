import { useState } from "react";
import { FaCalendarAlt, FaSun, FaMoon, FaChevronUp, FaChevronDown } from "react-icons/fa";
import { cn } from "../../../lib/utils";
import { Pagination } from "../components/Pagination";
import { SectionHeader } from "../components/SectionHeader";
import { SearchInput } from "../components/SearchInput";
import { EmptyState } from "../components/EmptyState";
import { ListPanel } from "../components/ListPanel";
import { useAdminContext } from "../context";
import useAuth from "../../../hooks/useAuth";
import { Button } from "../../../components/Button";

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const PAGE_SIZE = 7;

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

/**
 * Returns a human-readable schedule string. Times are relative to EST since that
 * is the bot server's timezone. effectiveHour already includes the DST offset.
 */
const formatSchedule = (effectiveHour: number, effectiveMinute: number, days: number[]): string => {
  const h = effectiveHour % 12 || 12;
  const m = effectiveMinute > 0 ? `:${String(effectiveMinute).padStart(2, "0")}` : ":00";
  const period = effectiveHour >= 12 ? "PM" : "AM";
  const time = `${h}${m} ${period}`;
  if (days.length === 0) return `Daily at ${time}`;
  if (days.length === 1) return `Every ${DAY_NAMES[days[0]]} at ${time}`;
  return `${days.map((d) => DAY_NAMES[d]).join(", ")} at ${time}`;
};

const formatNextRun = (iso: string | null): string => {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

/** Returns a friendly relative time string, e.g. "in 3h" or "tomorrow". */
const timeUntil = (iso: string | null): string => {
  if (!iso) return "";
  const diff = new Date(iso).getTime() - Date.now();
  if (diff < 0) return "";
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return "< 1 hr";
  if (h < 24) return `in ${h}h`;
  const d = Math.floor(h / 24);
  return d === 1 ? "tomorrow" : `in ${d}d`;
};

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

export const ScheduledTasksTab = () => {
  const {
    scheduledTasks: tasks,
    scheduledTasksDstOffset: dstOffset,
    scheduledTasksLoading: loading,
    scheduledTasksToggling: toggling,
    toggleScheduledTasksDst,
  } = useAdminContext();

  const { user } = useAuth();
  const ownerId = import.meta.env.VITE_OWNER_ID as string | undefined;
  const isOwner = user?.id === ownerId;

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<{ field: string; dir: "asc" | "desc" } | null>(null);

  // ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //
  // Render

  const isDst = dstOffset === 1;
  const filteredTasks = search
    ? tasks.filter(
        (t) =>
          t.name.toLowerCase().includes(search.toLowerCase()) ||
          t.channelName.toLowerCase().includes(search.toLowerCase()) ||
          t.description.toLowerCase().includes(search.toLowerCase())
      )
    : tasks;
  const sortedTasks = sort
    ? [...filteredTasks].sort((a, b) => {
        let cmp = 0;
        if (sort.field === "name") cmp = a.name.localeCompare(b.name);
        else if (sort.field === "channelName") cmp = a.channelName.localeCompare(b.channelName);
        else if (sort.field === "effectiveHour") cmp = a.effectiveHour - b.effectiveHour;
        else if (sort.field === "nextRun") {
          const ta = a.nextRun ? new Date(a.nextRun).getTime() : Infinity;
          const tb = b.nextRun ? new Date(b.nextRun).getTime() : Infinity;
          cmp = ta - tb;
        }
        return sort.dir === "asc" ? cmp : -cmp;
      })
    : filteredTasks;
  const pageCount = Math.ceil(filteredTasks.length / PAGE_SIZE);
  const pagedTasks = sortedTasks.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const isFullPage = pagedTasks.length >= PAGE_SIZE;

  const handleSort = (field: string) => {
    setSort((prev) => {
      if (!prev || prev.field !== field) return { field, dir: "asc" };
      if (prev.dir === "asc") return { field, dir: "desc" };
      return null;
    });
    setPage(1);
  };


  return (
    <ListPanel
      header={
        <SectionHeader
          title="Scheduled Tasks"
          count={filteredTasks.length}
          loading={loading}
          canCreate={false}
          extra={
            isOwner && (
              <Button
                variant="primary"
                size="mobile"
                loading={toggling}
                onClick={toggleScheduledTasksDst}
                className="md:h-[30px] md:w-auto md:gap-2 md:px-3"
              >
                {isDst ? <FaSun size={11} style={{ marginBottom: "1px" }} /> : <FaMoon size={11} style={{ marginBottom: "1px" }} />}
                <span className="hidden md:inline">{isDst ? "Disable DST" : "Enable DST"}</span>
              </Button>
            )
          }
        />
      }
      filter={
        <SearchInput
          value={search}
          onChange={(v) => { setSearch(v); setPage(1); }}
          placeholder="Filter by name, channel, or description..."
          inputClassName="flex-1 min-w-[120px]"
        />
      }
      loading={loading && tasks.length === 0}
      isEmpty={filteredTasks.length === 0}
      empty={
        <EmptyState
          icon={<FaCalendarAlt size={26} />}
          message={search ? `No tasks matching "${search}"` : "No scheduled tasks found"}
        />
      }
      pagination={
        <Pagination
          page={page}
          total={filteredTasks.length}
          pageCount={pageCount}
          onPrev={() => setPage((p) => p - 1)}
          onNext={() => setPage((p) => p + 1)}
        />
      }
    >
          <table className={cn("w-full text-sm min-w-[600px]", isFullPage && "md:h-full")}>
            <thead className="sticky top-0 bg-panel z-10">
              <tr className="border-y border-tertiary/[6%]">
                <th
                  onClick={() => handleSort("name")}
                  className="text-left text-xs text-tertiary/50 font-medium uppercase tracking-wider px-6 py-3.5 select-none cursor-pointer hover:text-white transition-colors duration-150 group"
                >
                  <span className="inline-flex items-center gap-1.5">
                    Job
                    <span className={cn(
                      "inline-flex items-center leading-none transition-all duration-150 text-tertiary/50 group-hover:text-white",
                      sort?.field === "name" ? "opacity-100" : "opacity-0"
                    )}>
                      {sort?.field === "name" && sort?.dir === "asc" ? <FaChevronUp size={9} /> : <FaChevronDown size={9} />}
                    </span>
                  </span>
                </th>
                <th
                  onClick={() => handleSort("channelName")}
                  className="text-left text-xs text-tertiary/50 font-medium uppercase tracking-wider px-6 py-3.5 select-none w-[190px] cursor-pointer hover:text-white transition-colors duration-150 group"
                >
                  <span className="inline-flex items-center gap-1.5">
                    Channel
                    <span className={cn(
                      "inline-flex items-center leading-none transition-all duration-150 text-tertiary/50 group-hover:text-white",
                      sort?.field === "channelName" ? "opacity-100" : "opacity-0"
                    )}>
                      {sort?.field === "channelName" && sort?.dir === "asc" ? <FaChevronUp size={9} /> : <FaChevronDown size={9} />}
                    </span>
                  </span>
                </th>
                <th
                  onClick={() => handleSort("effectiveHour")}
                  className="text-left text-xs text-tertiary/50 font-medium uppercase tracking-wider px-6 py-3.5 select-none w-[225px] cursor-pointer hover:text-white transition-colors duration-150 group"
                >
                  <span className="inline-flex items-center gap-1.5">
                    Schedule (EST)
                    <span className={cn(
                      "inline-flex items-center leading-none transition-all duration-150 text-tertiary/50 group-hover:text-white",
                      sort?.field === "effectiveHour" ? "opacity-100" : "opacity-0"
                    )}>
                      {sort?.field === "effectiveHour" && sort?.dir === "asc" ? <FaChevronUp size={9} /> : <FaChevronDown size={9} />}
                    </span>
                  </span>
                </th>
                <th
                  onClick={() => handleSort("nextRun")}
                  className="text-left text-xs text-tertiary/50 font-medium uppercase tracking-wider px-6 py-3.5 select-none w-[225px] cursor-pointer hover:text-white transition-colors duration-150 group"
                >
                  <span className="inline-flex items-center gap-1.5">
                    Next Run
                    <span className={cn(
                      "inline-flex items-center leading-none transition-all duration-150 text-tertiary/50 group-hover:text-white",
                      sort?.field === "nextRun" ? "opacity-100" : "opacity-0"
                    )}>
                      {sort?.field === "nextRun" && sort?.dir === "asc" ? <FaChevronUp size={9} /> : <FaChevronDown size={9} />}
                    </span>
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {pagedTasks.map((task) => (
                  <tr
                    key={task.id}
                    className="border-t border-tertiary/[6%] hover:bg-background/40 transition-colors"
                    style={isFullPage ? { height: `calc(100% / ${pagedTasks.length})` } : undefined}
                  >
                    <td className="px-6 py-3.5 align-top">
                      <p className="text-white/90 font-medium leading-snug">{task.name}</p>
                      <p className="hidden md:block text-xs text-tertiary/55 mt-1 max-w-sm leading-relaxed">
                        {task.description}
                      </p>
                    </td>
                    <td className="px-6 py-3.5 align-top">
                      <span className="text-xs text-tertiary/70 font-mono">
                        #{task.channelName}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 align-top">
                      <span className="text-xs text-tertiary/70">
                        {formatSchedule(task.effectiveHour, task.effectiveMinute ?? 0, task.days)}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 align-top">
                      <p className="text-xs text-tertiary/70">{formatNextRun(task.nextRun)}</p>
                      <p className="text-xs text-tertiary/35 mt-0.5">{timeUntil(task.nextRun)}</p>
                    </td>
                  </tr>
              ))}
            </tbody>
          </table>
    </ListPanel>
  );
};
