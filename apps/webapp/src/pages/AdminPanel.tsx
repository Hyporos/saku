import { useState, useEffect, useRef, type ReactNode } from "react";
import { cn } from "../lib/utils";
import dayjs from "dayjs";
import { useNavigate, useMatch, useLocation } from "react-router-dom";
import WarningModal from "../components/WarningModal";
import Checkbox from "../components/Checkbox";
import DatePicker from "../components/DatePicker";
import Select from "../components/Select";
import CopyId from "../components/CopyId";
import AutocompleteInput from "../components/AutocompleteInput";
import {
  FaUsers,
  FaUserAlt,
  FaChartBar,
  FaExclamationCircle,
  FaEdit,
  FaTrash,
  FaPlus,
  FaTimes,
  FaSearch,
  FaCheck,
  FaArrowLeft,
  FaExternalLinkAlt,
  FaChevronUp,
  FaChevronDown,
  FaHistory,
  FaUnlink,
  FaShieldAlt,
} from "react-icons/fa";
import axios from "axios";

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

type Section = "users" | "characters" | "scores" | "exceptions";

interface DrawerState {
  isOpen: boolean;
  mode: "edit" | "create";
  section: Section;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any>;
}

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

// Proxy base — browser calls server.js which forwards to the bot server-side,
// avoiding Mixed Content errors when the webapp is on HTTPS.
const BOT_API = import.meta.env.VITE_BOT_API_URL ?? "http://localhost:8000";

interface ScoreEntry {
  date: string;
  score: number;
}

interface Character {
  name: string;
  avatar: string;
  memberSince: string;
  scores: ScoreEntry[];
}

interface UserDoc {
  _id: string;
  graphColor: string;
  characters: Character[];
  username?: string | null;
  nickname?: string | null;
  avatarUrl?: string | null;
  joinedAt?: string | null;
  role?: "bee" | "member" | null;
}

// The 9 graph colors available via /graphcolor, stored as raw RGB strings
const GRAPH_COLORS = [
  { name: "Pink",       value: "255,189,213" },
  { name: "Purple",     value: "145,68,207" },
  { name: "Blue",       value: "31,119,180" },
  { name: "Red",        value: "189,36,36" },
  { name: "Orange",     value: "214,110,45" },
  { name: "Yellow",     value: "180,170,31" },
  { name: "Green",      value: "58,180,31" },
  { name: "Mint Green", value: "173,235,179" },
  { name: "Lavender",   value: "216,185,255" },
];

// Convert stored "R,G,B" string to a CSS color value
const rgbCss = (v: string) => `rgb(${v})`;

// Convert "MMM DD, YYYY" → YYYY-MM-DD for <input type="date">
const toInputDate = (stored: string) => {
  const d = dayjs(stored);
  return d.isValid() ? d.format("YYYY-MM-DD") : "";
};

// Convert YYYY-MM-DD → "MMM DD, YYYY" for storage
const toStoredDate = (input: string) => {
  const d = dayjs(input);
  return d.isValid() ? d.format("MMM DD, YYYY") : input;
};

// Strip diacritics/accents for URL slugs — e.g. Dánnis → Dannis
const normalizeCharName = (name: string) =>
  name.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

// Build a collision-free URL slug for a character name.
// If two characters normalise to the same slug, the second gets "_2", third "_3", etc.
// allChars must include ALL characters across all users (the full flat list).
const charSlug = (name: string, allChars: Array<{ name: string; userId: string }>) => {
  const normalized = normalizeCharName(name);
  const matches = allChars
    .filter((c) => normalizeCharName(c.name) === normalized)
    .sort((a, b) => a.name.localeCompare(b.name) || a.userId.localeCompare(b.userId));
  const idx = matches.findIndex((c) => c.name === name);
  return idx <= 0 ? normalized : `${normalized}_${idx + 1}`;
};

interface ExceptionDoc {
  _id: string;
  name: string;
  exception: string;
  [key: string]: unknown;
}

type CharDetail = Character & { userId: string; scoreCount: number; participationRate: number };
type UserDetail = UserDoc;

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

// Reusable labelled form field for the edit drawer
const Field = ({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-xs text-tertiary uppercase tracking-wide font-medium">
      {label}
    </label>
    {children}
    {hint && <p className="text-xs text-tertiary/50">{hint}</p>}
  </div>
);

const PAGE_SIZE = 10;
const SCORE_DETAIL_PAGE_SIZE = 10;

const inputCls =
  "bg-background border border-tertiary/20 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-accent/40 transition-colors w-full";

const Pagination = ({
  page,
  total,
  pageCount,
  onPrev,
  onNext,
}: {
  page: number;
  total: number;
  pageCount: number;
  onPrev: () => void;
  onNext: () => void;
}) => (
  <div className="flex items-center justify-between px-6 py-3 border-t border-tertiary/[6%]">
    <span className="text-xs text-tertiary">
      {total === 0 ? "No results" : `Page ${page} of ${pageCount}`}
    </span>
    <div className="flex gap-2">
      <button
        disabled={page <= 1}
        onClick={onPrev}
        className="text-xs text-tertiary hover:text-white disabled:opacity-30 transition-colors px-3 py-1.5 rounded-lg bg-background/60"
      >
        Prev
      </button>
      <button
        disabled={page >= pageCount}
        onClick={onNext}
        className="text-xs text-tertiary hover:text-white disabled:opacity-30 transition-colors px-3 py-1.5 rounded-lg bg-background/60"
      >
        Next
      </button>
    </div>
  </div>
);

type SortDir = "asc" | "desc";
interface SortState { field: string; dir: SortDir }

const SortableHead = ({
  cols,
  sort,
  onSort,
  onSelectAll,
  allSelected,
  someSelected,
}: {
  cols: { label: React.ReactNode; field?: string; className?: string }[];
  sort: SortState | null;
  onSort: (field: string) => void;
  onSelectAll?: () => void;
  allSelected?: boolean;
  someSelected?: boolean;
}) => (
  <thead>
    <tr className="border-t border-tertiary/[6%]">
      {onSelectAll !== undefined && (
        <th className="pl-5 pr-2 py-3 w-10">
          <Checkbox
            checked={!!allSelected}
            onChange={onSelectAll}
            indeterminate={!allSelected && !!someSelected}
          />
        </th>
      )}
      {cols.map(({ label, field, className: colClass }, idx) => (
        <th
          key={field ?? idx}
          onClick={() => field && onSort(field)}
          className={cn(
            "text-left text-xs text-tertiary font-medium uppercase tracking-wide px-6 py-3 select-none",
            colClass,
            field && "cursor-pointer hover:text-white transition-colors"
          )}
        >
          {/* Always render the chevron slot to prevent layout shift when it appears */}
          <span className="inline-flex items-center gap-1.5">
            {label}
            <span className={cn(
              "inline-flex items-center leading-none transition-opacity duration-150",
              field && sort?.field === field ? "opacity-100 text-accent" : "opacity-0"
            )}>
              {sort?.field === field && sort?.dir === "asc"
                ? <FaChevronUp size={9} />
                : <FaChevronDown size={9} />}
            </span>
          </span>
        </th>
      ))}
      <th className="px-6 py-3" />
    </tr>
  </thead>
);

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

const AdminPanel = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const charMatch = useMatch("/admin/characters/:charName");
  const userMatch = useMatch("/admin/users/:userId");
  const urlCharName = charMatch?.params.charName;
  const urlUserId = userMatch?.params.userId;
  const initializedCharFromUrl = useRef(false);
  const initializedUserFromUrl = useRef(false);

  const [activeSection, setActiveSection] = useState<Section>(() => {
    const p = location.pathname;
    if (p.startsWith("/admin/users")) return "users";
    if (p.startsWith("/admin/characters")) return "characters";
    if (p.startsWith("/admin/scores")) return "scores";
    if (p.startsWith("/admin/exceptions")) return "exceptions";
    return "users";
  });
  const [search, setSearch] = useState("");
  const [drawer, setDrawer] = useState<DrawerState>({
    isOpen: false,
    mode: "edit",
    section: "users",
    data: {},
  });

  // Real data from the bot API
  const [userData, setUserData] = useState<UserDoc[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [exceptionsData, setExceptionsData] = useState<ExceptionDoc[]>([]);
  const [exceptionsLoading, setExceptionsLoading] = useState(false);

  // Search + pagination state
  const [charSearch, setCharSearch] = useState("");
  const [charPage, setCharPage] = useState(1);
  const [charDateFrom, setCharDateFrom] = useState("");
  const [charDateTo, setCharDateTo] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [userPage, setUserPage] = useState(1);
  const [scoreSearch, setScoreSearch] = useState("");
  const [scoreDateFilter, setScoreDateFilter] = useState("");
  const [scorePage, setScorePage] = useState(1);

  // Sort state
  const [userSort, setUserSort] = useState<SortState | null>(null);
  const [charSort, setCharSort] = useState<SortState | null>(null);
  const [scoreSort, setScoreSort] = useState<SortState | null>(null);
  const [userDetailCharSort, setUserDetailCharSort] = useState<SortState | null>(null);
  const [excSort, setExcSort] = useState<SortState | null>(null);

  // Exceptions pagination and inline editing
  const [excPage, setExcPage] = useState(1);
  const [excInlineEdit, setExcInlineEdit] = useState<{ id: string; name: string; exception: string } | null>(null);

  // Scores tab inline editing
  const [scoreTabInlineEdit, setScoreTabInlineEdit] = useState<{ origCharacter: string; origDate: string; dateValue: string; scoreValue: string } | null>(null);

  // User detail — fresh member data fetched from Discord via bot API
  const [userMemberData, setUserMemberData] = useState<{ _id: string; username: string | null; nickname: string | null; role: string | null; joinedAt: string | null; avatarUrl: string | null } | null>(null);

  // User detail — batch selection for linked characters
  const [selUserDetailChars, setSelUserDetailChars] = useState<Set<string>>(new Set());

  // Detail drill-down views
  const [charDetail, setCharDetail] = useState<CharDetail | null>(null);
  const [userDetail, setUserDetail] = useState<UserDetail | null>(null);

  // Context tracking — when a char detail was opened from a user detail, remember who "back" goes to
  const [prevContext, setPrevContext] = useState<{ type: "user"; userId: string; username: string | null } | null>(null);

  // Inline edits for detail pages
  const [charEdits, setCharEdits] = useState({ memberSince: "", avatar: "" });
  const [charEditsDirty, setCharEditsDirty] = useState(false);
  const [memberSinceDirty, setMemberSinceDirty] = useState(false);
  const [userEdits, setUserEdits] = useState({ graphColor: "" });
  const [userEditsDirty, setUserEditsDirty] = useState(false);

  // Character detail — sort, date range filter, API data, score pagination, and owner
  const [detailScoreSort, setDetailScoreSort] = useState<SortState>({ field: "date", dir: "desc" });
  const [detailScorePage, setDetailScorePage] = useState(1);
  const [detailDateFrom, setDetailDateFrom] = useState("");
  const [detailDateTo, setDetailDateTo] = useState("");
  const [charApiData, setCharApiData] = useState<{ level: number; characterImgURL: string; characterClassName?: string | null } | null>(null);
  // Track which character name the API data belongs to — prevents stale-data flash when switching characters
  const [charApiDataFor, setCharApiDataFor] = useState<string>("");
  const [charApiLoading, setCharApiLoading] = useState(false);
  const [ownerData, setOwnerData] = useState<{ _id: string; username: string | null; nickname: string | null; avatarUrl: string | null; joinedAt?: string | null; role?: string | null } | null>(null);

  // Batch selection state (key per row)
  const [selUsers, setSelUsers] = useState<Set<string>>(new Set());
  const [selChars, setSelChars] = useState<Set<string>>(new Set());
  const [selScores, setSelScores] = useState<Set<string>>(new Set());
  const [selExcs, setSelExcs] = useState<Set<string>>(new Set());

  // Character detail — inline score editing and batch score selection
  const [scoreInlineEdit, setScoreInlineEdit] = useState<{
    origDate: string; dateValue: string; scoreValue: string;
  } | null>(null);
  const [selDetailScores, setSelDetailScores] = useState<Set<string>>(new Set());

  // Warning modal state
  type ModalPayload =
    | { variant: "confirm"; title: ReactNode; description: string; onConfirm: () => void; confirmLabel?: string; confirmDanger?: boolean }
    | { variant: "sensitive"; title: ReactNode; description: string; onConfirm: () => void; confirmWord?: string };
  const [modal, setModal] = useState<(ModalPayload & { isOpen: boolean }) | null>(null);
  const closeModal = () => {
    // Set isOpen: false to let WarningModal run its close animation,
    // then null out after the 220ms transition
    setModal((prev) => prev ? { ...prev, isOpen: false } : null);
    setTimeout(() => setModal(null), 260);
  };
  const confirm = (payload: ModalPayload) => setModal({ ...payload, isOpen: true });

  const refreshUsers = () => {
    setUsersLoading(true);
    return axios
      .get<UserDoc[]>(`${BOT_API}/bot/api/admin/users`)
      .then((res) => setUserData(Array.isArray(res.data) ? res.data : []))
      .catch(console.error)
      .finally(() => setUsersLoading(false));
  };

  const refreshExceptions = () => {
    setExceptionsLoading(true);
    return axios
      .get<ExceptionDoc[]>(`${BOT_API}/bot/api/admin/exceptions`)
      .then((res) => setExceptionsData(Array.isArray(res.data) ? res.data : []))
      .catch(console.error)
      .finally(() => setExceptionsLoading(false));
  };

  // Navigate to a character's URL and open its detail view simultaneously
  const openCharDetail = (char: CharDetail, fromUser?: UserDetail) => {
    if (fromUser) {
      setPrevContext({ type: "user", userId: String(fromUser._id), username: fromUser.username ?? null });
    } else {
      setPrevContext(null);
    }
    setCharDetail(char);
    const allFlat = userData.flatMap((u) => u.characters.map((c) => ({ name: c.name, userId: String(u._id) })));
    navigate(`/admin/characters/${encodeURIComponent(charSlug(char.name, allFlat))}`);
  };

  // On initial load, restore the character detail from the URL slug (/admin/characters/:charName)
  useEffect(() => {
    if (!urlCharName || initializedCharFromUrl.current || usersLoading || userData.length === 0) return;
    const decoded = decodeURIComponent(urlCharName);
    const allFlat = userData.flatMap((u) => u.characters.map((c) => ({ name: c.name, userId: String(u._id) })));
    for (const u of userData) {
      for (const c of u.characters) {
        if (charSlug(c.name, allFlat) === decoded) {
          const participated = c.scores.filter((s) => s.score > 0).length;
          const total = c.scores.length;
          setCharDetail({
            ...c,
            userId: String(u._id),
            scoreCount: total,
            participationRate: total > 0 ? Math.round((participated / total) * 100) : 0,
          });
          setActiveSection("characters");
          initializedCharFromUrl.current = true;
          return;
        }
      }
    }
  }, [userData, usersLoading, urlCharName]);

  // On initial load, restore the user detail from the URL (/admin/users/:userId)
  useEffect(() => {
    if (!urlUserId || initializedUserFromUrl.current || usersLoading || userData.length === 0) return;
    const found = userData.find((u) => String(u._id) === urlUserId);
    if (found) {
      setUserDetail(found);
      setActiveSection("users");
      initializedUserFromUrl.current = true;
    }
  }, [userData, usersLoading, urlUserId]);

  // Keep detail views in sync after a data refresh
  useEffect(() => {
    if (charDetail) {
      const owner = userData.find((u) => u._id === charDetail.userId);
      const updated = owner?.characters.find((c) => c.name === charDetail.name);
      if (updated) {
        const participated = updated.scores.filter((s) => s.score > 0).length;
        const total = updated.scores.length;
        setCharDetail({ ...updated, userId: charDetail.userId, scoreCount: total, participationRate: total > 0 ? Math.round((participated / total) * 100) : 0 });
      }
    }
    if (userDetail) {
      const updated = userData.find((u) => u._id === userDetail._id);
      if (updated) setUserDetail(updated);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userData]);

  // Reset inline edits when switching to a different detail item
  useEffect(() => {
    if (charDetail) {
      setCharEdits({ memberSince: toInputDate(charDetail.memberSince), avatar: charDetail.avatar ?? "" });
      setCharEditsDirty(false);
      setMemberSinceDirty(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [charDetail?.name, charDetail?.userId]);

  useEffect(() => {
    if (userDetail) {
      setUserEdits({ graphColor: userDetail.graphColor });
      setUserEditsDirty(false);
      setUserDetailCharSort(null);
      setSelUserDetailChars(new Set());
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userDetail?._id]);

  // Fetch fresh Discord member data for the user detail view
  useEffect(() => {
    if (!userDetail) { setUserMemberData(null); return; }
    axios
      .get(`${BOT_API}/bot/api/admin/member/${encodeURIComponent(userDetail._id)}`)
      .then((res) => setUserMemberData(res.data))
      .catch(() => setUserMemberData(null));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userDetail?._id]);

  const saveCharEdits = async () => {
    if (!charDetail || !charEditsDirty) return;
    const memberSince = toStoredDate(charEdits.memberSince);
    await axios.patch(
      `${BOT_API}/bot/api/admin/characters/${charDetail.userId}/${charDetail.name}`,
      { name: charDetail.name, memberSince, avatar: charEdits.avatar }
    );
    setCharEditsDirty(false);
    setMemberSinceDirty(false);
    await refreshUsers();
  };

  const saveMemberSince = async () => {
    if (!charDetail) return;
    const memberSince = toStoredDate(charEdits.memberSince);
    await axios.patch(
      `${BOT_API}/bot/api/admin/characters/${charDetail.userId}/${charDetail.name}`,
      { name: charDetail.name, memberSince, avatar: charEdits.avatar }
    );
    setMemberSinceDirty(false);
    await refreshUsers();
  };

  const saveUserEdits = async () => {
    if (!userDetail || !userEditsDirty) return;
    await axios.patch(`${BOT_API}/bot/api/admin/users/${userDetail._id}`, { graphColor: userEdits.graphColor });
    setUserEditsDirty(false);
    await refreshUsers();
  };

  // Fetch MapleStory API data when a character detail is opened.
  // Track charApiDataFor so we never show a previous character's image on the new character.
  useEffect(() => {
    if (!charDetail) { setCharApiData(null); setCharApiDataFor(""); return; }
    const targetName = charDetail.name;
    setCharApiLoading(true);
    axios
      .get(`${BOT_API}/bot/api/rankings/${encodeURIComponent(targetName)}`)
      .then((res) => {
        setCharApiData(res.data);
        setCharApiDataFor(targetName);
      })
      .catch(console.error)
      .finally(() => setCharApiLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [charDetail?.name]);

  // Resolve owner — check cache first, then fetch directly by Discord ID regardless of role.
  // Uses /admin/member/:id so guest-owned characters show correct server avatar + nickname.
  useEffect(() => {
    if (!charDetail) { setOwnerData(null); return; }
    const cached = userData.find((u) => String(u._id) === String(charDetail.userId));
    if (cached) {
      setOwnerData({ _id: String(cached._id), username: cached.username ?? null, nickname: cached.nickname ?? null, avatarUrl: cached.avatarUrl ?? null });
      return;
    }
    axios
      .get(`${BOT_API}/bot/api/admin/member/${encodeURIComponent(charDetail.userId)}`)
      .then((res) => setOwnerData(res.data))
      .catch(console.error);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [charDetail?.userId]);

  // Reset detail score sort, date filter and inline edit state when switching characters
  useEffect(() => {
    setDetailScoreSort({ field: "date", dir: "desc" });
    setDetailDateFrom(""); setDetailDateTo("");
    setScoreInlineEdit(null);
    setSelDetailScores(new Set());
  }, [charDetail?.name, charDetail?.userId]);

  useEffect(() => {
    if (activeSection === "users" || activeSection === "characters" || activeSection === "scores") {
      refreshUsers();
    }
    if (activeSection === "exceptions") {
      refreshExceptions();
    }
  }, [activeSection]);

  // Flatten bot API response into table-ready shapes
  const liveUsers = userData.map((u) => ({
    id: u._id,
    graphColor: u.graphColor,
    characterCount: u.characters.length,
    username: u.username ?? null,
    nickname: u.nickname ?? null,
    role: u.role ?? null,
  }));

  const liveCharacters = userData.flatMap((u) =>
    u.characters.map((c) => {
      const participated = c.scores.filter((s) => s.score > 0).length;
      const total = c.scores.length;
      const participationRate = total > 0 ? Math.round((participated / total) * 100) : 0;
      return { ...c, userId: u._id, scoreCount: total, participationRate };
    })
  );

  const liveScores = liveCharacters
    .flatMap((c) => c.scores.map((s) => ({ character: c.name, userId: c.userId, date: s.date, score: s.score })))
    .sort((a, b) => b.date.localeCompare(a.date));

  // Sorting helper
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const applySortAndPage = <T extends Record<string, any>>(
    items: T[],
    sort: SortState | null,
    page: number
  ) => {
    const sorted = sort
      ? [...items].sort((a, b) => {
          const av = a[sort.field] ?? "";
          const bv = b[sort.field] ?? "";
          const cmp = typeof av === "number" && typeof bv === "number"
            ? av - bv
            : String(av).localeCompare(String(bv));
          return sort.dir === "asc" ? cmp : -cmp;
        })
      : items;
    const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
    const paged = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    return { sorted, pageCount, paged };
  };

  // Filtered + sorted + paginated views
  const filteredUsers = liveUsers.filter((u) =>
    normalizeCharName(u.id).toLowerCase().includes(normalizeCharName(userSearch).toLowerCase()) ||
    normalizeCharName(u.username ?? "").toLowerCase().includes(normalizeCharName(userSearch).toLowerCase())
  );
  const { pageCount: userPageCount, paged: pagedUsers } = applySortAndPage(filteredUsers, userSort, userPage);

  const filteredChars = liveCharacters.filter(
    (c) =>
      (normalizeCharName(c.name).toLowerCase().includes(normalizeCharName(charSearch).toLowerCase()) ||
      String(c.userId).toLowerCase().includes(charSearch.toLowerCase())) &&
      (!charDateFrom || !charDateTo || (c.memberSince >= charDateFrom && c.memberSince <= charDateTo))
  );
  const { pageCount: charPageCount, paged: pagedChars } = applySortAndPage(filteredChars, charSort, charPage);

  const toggleSort = (current: SortState | null, field: string, setter: (s: SortState) => void) => {
    if (current?.field === field) {
      setter({ field, dir: current.dir === "asc" ? "desc" : "asc" });
    } else {
      setter({ field, dir: "asc" });
    }
  };

  const openCreate = (section: Section) => {
    setDrawer({ isOpen: true, mode: "create", section, data: {} });
  };

  const closeDrawer = () => setDrawer((prev) => ({ ...prev, isOpen: false }));

  // Update a single field inside the open drawer
  const updateField = (field: string, value: unknown) =>
    setDrawer((prev) => ({ ...prev, data: { ...prev.data, [field]: value } }));

  const handleSave = async () => {
    const { section, mode, data } = drawer;
    try {
      if (section === "characters") {
        // Convert YYYY-MM-DD back to "MMM DD, YYYY" before storing
        const memberSince = toStoredDate(String(data.memberSince ?? ""));
        if (mode === "edit") {
          const originalName = data._originalName ?? data.name;
          await axios.patch(
            `${BOT_API}/bot/api/admin/characters/${data.userId}/${originalName}`,
            { name: data.name, memberSince, avatar: data.avatar }
          );
        } else {
          await axios.post(`${BOT_API}/bot/api/admin/characters`, {
            userId: data.userId, name: data.name,
            memberSince, avatar: data.avatar ?? "",
          });
        }
        await refreshUsers();
      } else if (section === "users" && mode === "edit") {
        await axios.patch(`${BOT_API}/bot/api/admin/users/${data.id}`, { graphColor: data.graphColor });
        await refreshUsers();
      } else if (section === "scores") {
        if (mode === "edit") {
          await axios.patch(`${BOT_API}/bot/api/admin/scores/${data.character}/${data.date}`, { score: Number(data.score) });
        } else {
          await axios.post(`${BOT_API}/bot/api/admin/scores`, { character: data.character, date: data.date, score: Number(data.score) });
        }
        await refreshUsers();
      } else if (section === "exceptions") {
        if (mode === "edit") {
          await axios.patch(`${BOT_API}/bot/api/admin/exceptions/${data._id}`, { name: data.name, exception: data.exception });
        } else {
          await axios.post(`${BOT_API}/bot/api/admin/exceptions`, { name: data.name, exception: data.exception });
        }
        await refreshExceptions();
      }
      closeDrawer();
    } catch (e) {
      console.error("Save failed:", e);
    }
  };

  const deleteCharacter = (userId: string, name: string) =>
    confirm({
      variant: "sensitive",
      confirmWord: "unlink",
      title: <span>Unlink <span className="text-[#A46666]">{name}</span>?</span>,
      description: "This will permanently remove the character and all of their scores. This action cannot be undone.",
      onConfirm: async () => {
        try {
          await axios.delete(`${BOT_API}/bot/api/admin/characters/${userId}/${name}`);
          await refreshUsers();
          // Only leave the char detail view if we're currently in it
          if (charDetail?.name === name && charDetail?.userId === userId) {
            setCharDetail(null);
            navigate(prevContext?.type === "user" ? `/admin/users/${prevContext.userId}` : "/admin/characters");
          }
        } catch (e) { console.error("Delete failed:", e); }
        closeModal();
      },
    });

  const deleteUser = (userId: string, username?: string | null) =>
    confirm({
      variant: "sensitive",
      title: `Delete ${username ?? userId}`,
      description: "This will permanently remove the user and all of their linked characters and scores. This action cannot be undone.",
      onConfirm: async () => {
        try {
          await axios.delete(`${BOT_API}/bot/api/admin/users/${userId}`);
          await refreshUsers();
          setUserDetail(null);
          setCharDetail(null);
          navigate("/admin/users");
        } catch (e) { console.error("Delete failed:", e); }
        closeModal();
      },
    });

  const deleteScore = (character: string, date: string) =>
    confirm({
      variant: "confirm",
      title: "Delete score",
      description: `Delete the score for ${character} on ${date}? This cannot be undone.`,
      onConfirm: async () => {
        try {
          await axios.delete(`${BOT_API}/bot/api/admin/scores/${character}/${date}`);
          await refreshUsers();
        } catch (e) { console.error("Delete failed:", e); }
        closeModal();
      },
    });

  // Save an inline-edited score row \u2014 both date and score can change simultaneously.
  // Changing a date requires DELETE + POST since the PATCH route only accepts { score }.
  const inlineSaveScore = async () => {
    if (!scoreInlineEdit || !charDetail) return;
    const { origDate, dateValue, scoreValue } = scoreInlineEdit;
    if (!dateValue.trim() || !scoreValue.trim()) return;
    try {
      const dateChanged = dateValue !== origDate;
      if (dateChanged) {
        await axios.delete(`${BOT_API}/bot/api/admin/scores/${encodeURIComponent(charDetail.name)}/${origDate}`);
        await axios.post(`${BOT_API}/bot/api/admin/scores`, {
          character: charDetail.name, date: dateValue, score: Number(scoreValue),
        });
      } else {
        await axios.patch(
          `${BOT_API}/bot/api/admin/scores/${encodeURIComponent(charDetail.name)}/${origDate}`,
          { score: Number(scoreValue) }
        );
      }
      setScoreInlineEdit(null);
      await refreshUsers();
    } catch (e) { console.error("Inline save failed:", e); }
  };

  const batchDeleteDetailScores = () =>
    confirm({
      variant: "confirm",
      title: `Delete ${selDetailScores.size} score${selDetailScores.size > 1 ? "s" : ""}`,
      description: "This will permanently remove the selected scores.",
      onConfirm: async () => {
        try {
          await Promise.all(
            [...selDetailScores].map((date) =>
              axios.delete(`${BOT_API}/bot/api/admin/scores/${encodeURIComponent(charDetail!.name)}/${date}`)
            )
          );
          setSelDetailScores(new Set());
          await refreshUsers();
        } catch (e) { console.error("Batch delete failed:", e); }
        closeModal();
      },
    });

  const deleteException = (id: string, name: string) =>
    confirm({
      variant: "confirm",
      title: "Delete exception",
      description: `Delete the exception for ${name}?`,
      onConfirm: async () => {
        try {
          await axios.delete(`${BOT_API}/bot/api/admin/exceptions/${id}`);
          await refreshExceptions();
        } catch (e) { console.error("Delete failed:", e); }
        closeModal();
      },
    });

  const inlineSaveException = async () => {
    if (!excInlineEdit) return;
    const { id, name, exception } = excInlineEdit;
    if (!name.trim()) return;
    try {
      await axios.patch(`${BOT_API}/bot/api/admin/exceptions/${id}`, { name, exception });
      setExcInlineEdit(null);
      await refreshExceptions();
    } catch (e) { console.error("Inline save failed:", e); }
  };

  // Save an inline-edited score row in the main scores tab
  const inlineSaveScoreTab = async () => {
    if (!scoreTabInlineEdit) return;
    const { origCharacter, origDate, dateValue, scoreValue } = scoreTabInlineEdit;
    if (!dateValue.trim() || !scoreValue.trim()) return;
    try {
      const dateChanged = dateValue !== origDate;
      if (dateChanged) {
        await axios.delete(`${BOT_API}/bot/api/admin/scores/${encodeURIComponent(origCharacter)}/${origDate}`);
        await axios.post(`${BOT_API}/bot/api/admin/scores`, { character: origCharacter, date: dateValue, score: Number(scoreValue) });
      } else {
        await axios.patch(`${BOT_API}/bot/api/admin/scores/${encodeURIComponent(origCharacter)}/${origDate}`, { score: Number(scoreValue) });
      }
      setScoreTabInlineEdit(null);
      await refreshUsers();
    } catch (e) { console.error("Inline save failed:", e); }
  };

  const batchDeleteUserDetailChars = () =>
    confirm({
      variant: "sensitive",
      confirmWord: "unlink",
      title: `Unlink ${selUserDetailChars.size} character${selUserDetailChars.size > 1 ? "s" : ""}`,
      description: "This will permanently remove the selected characters and all of their scores. This action cannot be undone.",
      onConfirm: async () => {
        try {
          await Promise.all(
            [...selUserDetailChars].map((name) =>
              axios.delete(`${BOT_API}/bot/api/admin/characters/${userDetail!._id}/${name}`)
            )
          );
          setSelUserDetailChars(new Set());
          await refreshUsers();
        } catch (e) { console.error("Batch delete failed:", e); }
        closeModal();
      },
    });

  // ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //
  // Batch selection helpers

  const toggleSel = (set: Set<string>, key: string, setter: (s: Set<string>) => void) => {
    const next = new Set(set);
    if (next.has(key)) { next.delete(key); } else { next.add(key); }
    setter(next);
  };

  const toggleAll = (keys: string[], set: Set<string>, setter: (s: Set<string>) => void) => {
    setter(keys.every((k) => set.has(k)) && keys.length > 0 ? new Set() : new Set(keys));
  };

  const batchDeleteUsers = () =>
    confirm({
      variant: "sensitive",
      title: `Delete ${selUsers.size} user${selUsers.size > 1 ? "s" : ""}`,
      description: "This will permanently remove the selected users and all of their linked characters and scores.",
      onConfirm: async () => {
        try {
          await Promise.all([...selUsers].map((id) => axios.delete(`${BOT_API}/bot/api/admin/users/${id}`)));
          setSelUsers(new Set());
          await refreshUsers();
        } catch (e) { console.error("Batch delete failed:", e); }
        closeModal();
      },
    });

  const batchDeleteChars = () =>
    confirm({
      variant: "sensitive",
      title: `Delete ${selChars.size} character${selChars.size > 1 ? "s" : ""}`,
      description: "This will permanently remove the selected characters and all of their scores.",
      onConfirm: async () => {
        try {
          await Promise.all(
            [...selChars].map((key) => {
              const [userId, ...nameParts] = key.split("|");
              return axios.delete(`${BOT_API}/bot/api/admin/characters/${userId}/${nameParts.join("|")}`);
            })
          );
          setSelChars(new Set());
          await refreshUsers();
        } catch (e) { console.error("Batch delete failed:", e); }
        closeModal();
      },
    });

  const batchDeleteScores = () =>
    confirm({
      variant: "confirm",
      title: `Delete ${selScores.size} score${selScores.size > 1 ? "s" : ""}`,
      description: "This will permanently remove the selected scores.",
      onConfirm: async () => {
        try {
          await Promise.all(
            [...selScores].map((key) => {
              const sepIdx = key.lastIndexOf("|");
              const character = key.slice(0, sepIdx);
              const date = key.slice(sepIdx + 1);
              return axios.delete(`${BOT_API}/bot/api/admin/scores/${character}/${date}`);
            })
          );
          setSelScores(new Set());
          await refreshUsers();
        } catch (e) { console.error("Batch delete failed:", e); }
        closeModal();
      },
    });

  const batchDeleteExcs = () =>
    confirm({
      variant: "confirm",
      title: `Delete ${selExcs.size} exception${selExcs.size > 1 ? "s" : ""}`,
      description: "This will permanently remove the selected exceptions.",
      onConfirm: async () => {
        try {
          await Promise.all([...selExcs].map((id) => axios.delete(`${BOT_API}/bot/api/admin/exceptions/${id}`)));
          setSelExcs(new Set());
          await refreshExceptions();
        } catch (e) { console.error("Batch delete failed:", e); }
        closeModal();
      },
    });

  const navItems: { id: Section; label: string; icon: React.ElementType }[] = [
    { id: "users", label: "Users", icon: FaUsers },
    { id: "characters", label: "Characters", icon: FaUserAlt },
    { id: "scores", label: "Scores", icon: FaChartBar },
    { id: "exceptions", label: "Exceptions", icon: FaExclamationCircle },
  ];

  const filteredScores = liveScores.filter((s) =>
    normalizeCharName(s.character).toLowerCase().includes(normalizeCharName(scoreSearch).toLowerCase()) &&
    (!scoreDateFilter || s.date === scoreDateFilter)
  );
  const { pageCount: scorePageCount, paged: pagedScores } = applySortAndPage(filteredScores, scoreSort, scorePage);

  const filteredExceptions = [...exceptionsData].filter(
    (e) =>
      normalizeCharName(e.name).toLowerCase().includes(normalizeCharName(search).toLowerCase()) ||
      normalizeCharName(e.exception).toLowerCase().includes(normalizeCharName(search).toLowerCase())
  );
  const { pageCount: excPageCount, paged: pagedExcs } = applySortAndPage(filteredExceptions, excSort, excPage);

  // ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

  const SectionHeader = ({
    title,
    count,
    canCreate = true,
    createSection,
    extra,
  }: {
    title: string;
    count: number;
    canCreate?: boolean;
    createSection: Section;
    extra?: ReactNode;
  }) => (
    <div className="flex justify-between items-center px-6 py-5">
      <div className="flex items-center gap-3">
        <h2 className="text-xl">{title}</h2>
        <span className="bg-background text-tertiary text-xs rounded-full px-2.5 py-0.5 border border-tertiary/20">
          {count}
        </span>
      </div>
      <div className="flex items-center gap-2">
        {extra}
        {canCreate && (
          <button
            onClick={() => openCreate(createSection)}
            className="flex items-center gap-2 bg-accent/10 hover:bg-accent/15 text-accent text-sm rounded-lg px-4 py-2 transition-colors"
          >
            <FaPlus size={11} style={{ marginBottom: "1px" }} />
            Add New
          </button>
        )}
      </div>
    </div>
  );

  const BatchBar = ({ count, onDelete, onClear }: { count: number; onDelete: () => void; onClear: () => void }) =>
    count > 0 ? (
      <div className="flex items-center gap-6 px-6 py-3 bg-accent/[3%] border-b border-accent/10">
        <span className="text-sm text-accent">{count} selected</span>
        <button
          onClick={onDelete}
          className="ml-auto text-sm text-[#A46666] hover:text-red-400 transition-colors flex items-center gap-1.5"
        >
          <FaTrash size={11} style={{ marginBottom: "1px" }} /> Delete Selected
        </button>
        <button onClick={onClear} className="text-sm text-tertiary hover:text-white transition-colors">
          Clear
        </button>
      </div>
    ) : null;

  const RowActions = ({
    onEdit,
    onDelete,
  }: {
    onEdit?: () => void;
    onDelete: () => void;
  }) => (
    <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-end gap-4">
        {onEdit && (
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
            title="Edit"
            className="text-tertiary hover:text-accent transition-colors"
          >
            <FaEdit size={14} />
          </button>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          title="Delete"
          className="text-tertiary hover:text-[#A46666] transition-colors"
        >
          <FaTrash size={14} />
        </button>
      </div>
    </td>
  );

  // ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

  const renderCharDetail = () => {
    if (!charDetail) return null;

    // Sort score history
    let detailScores = [...charDetail.scores].sort((a, b) => {
      if (detailScoreSort.field === "score") {
        return detailScoreSort.dir === "asc" ? a.score - b.score : b.score - a.score;
      }
      const cmp = a.date.localeCompare(b.date);
      return detailScoreSort.dir === "asc" ? cmp : -cmp;
    });

    // Apply date range filter if set
    if (detailDateFrom) detailScores = detailScores.filter((e) => e.date >= detailDateFrom);
    if (detailDateTo)   detailScores = detailScores.filter((e) => e.date <= detailDateTo);

    // Pagination for score history (10 per page)
    const detailScorePageCount = Math.max(1, Math.ceil(detailScores.length / SCORE_DETAIL_PAGE_SIZE));
    const pagedDetailScores = detailScores.slice(
      (detailScorePage - 1) * SCORE_DETAIL_PAGE_SIZE,
      detailScorePage * SCORE_DETAIL_PAGE_SIZE
    );

    // Participation rate across ALL scores (not just the filtered view)
    const allScores = charDetail.scores;
    const participated = allScores.filter((s) => s.score > 0).length;
    const total = allScores.length;
    const participationRate = total > 0 ? Math.round((participated / total) * 100) : 0;
    const bestScore = allScores.length ? Math.max(...allScores.map((s) => s.score)) : 0;

    // Only use API data once confirmed for this exact character — prevents stale-data flash on switch
    const apiReady = !!charApiData && charApiDataFor === charDetail.name;

    const levelLine = !apiReady && charApiLoading
      ? "…"
      : apiReady
        ? `Level ${charApiData!.level} ${charApiData!.characterClassName ?? ""}`
        : "";

    // Avatar source — prefer live MapleStory API image once confirmed for this character
    const avatarSrc = apiReady ? charApiData!.characterImgURL : (charDetail.avatar || null);

    // Link to MapleStory rankings
    const rankingsUrl = `https://www.nexon.com/maplestory/rankings/north-america/overall-ranking/legendary?world_type=heroic&search_type=character-name&search=${encodeURIComponent(charDetail.name)}`;

    return (
      <div className="flex flex-col gap-6">
        <button
          onClick={() => {
            setCharDetail(null);
            setPrevContext(null);
            if (prevContext?.type === "user") {
              const found = userData.find((u) => String(u._id) === prevContext.userId);
              if (found) { setUserDetail(found); navigate(`/admin/users/${prevContext.userId}`); }
              else navigate("/admin/users");
            } else {
              navigate("/admin/characters");
            }
          }}
          className="flex items-center gap-2 text-sm text-tertiary hover:text-white transition-colors self-start"
        >
          <FaArrowLeft size={12} />
          {prevContext?.type === "user" ? `Back to ${prevContext.username ?? "User"}` : "Back to Characters"}
        </button>

        {/* Header — avatar inside bg-background panel, slightly more room */}
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
            <button
              onClick={(e) => { e.stopPropagation(); deleteCharacter(charDetail.userId, charDetail.name); }}
              title="Unlink character"
              className="flex items-center gap-1.5 text-xs text-[#A46666]/70 hover:text-[#A46666] border border-[#A46666]/20 hover:border-[#A46666]/40 rounded-lg px-2.5 py-1.5 transition-colors shrink-0 ml-2"
            >
              <FaUnlink size={11} /> Unlink Character
            </button>
          </div>
        </div>

        {/* Condensed info rows */}
        <div className="bg-panel rounded-xl divide-y divide-tertiary/[6%]">
          {/* Discord ID — clicking navigates to that user's detail page */}
          <div className="px-6 py-4 flex items-center gap-4">
            <span className="text-xs text-tertiary uppercase tracking-wide font-medium w-32 shrink-0">User</span>
            <button
              onClick={() => {
                const found = userData.find((u) => String(u._id) === String(charDetail.userId));
                if (found) { setCharDetail(null); setPrevContext(null); setUserDetail(found); navigate(`/admin/users/${found._id}`); }
                else if (ownerData) {
                  setCharDetail(null); setPrevContext(null);
                  setUserDetail({ _id: ownerData._id, graphColor: "", characters: [], username: ownerData.username, nickname: ownerData.nickname, avatarUrl: ownerData.avatarUrl, joinedAt: ownerData.joinedAt ?? null, role: (ownerData.role as UserDoc["role"]) ?? null });
                  navigate(`/admin/users/${ownerData._id}`);
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
              onChange={(v) => { setCharEdits((p) => ({ ...p, memberSince: v })); setMemberSinceDirty(true); }}
            />
            {memberSinceDirty && (
              <div className="flex items-center gap-3">
                <button
                  onClick={saveMemberSince}
                  title="Confirm"
                  className="text-[#669A68] hover:text-white transition-colors"
                >
                  <FaCheck size={13} />
                </button>
                <button
                  onClick={() => { setCharEdits((p) => ({ ...p, memberSince: toInputDate(charDetail.memberSince) })); setMemberSinceDirty(false); }}
                  title="Cancel"
                  className="text-[#A46666] hover:text-white transition-colors"
                >
                  <FaTimes size={16} />
                </button>
              </div>
            )}
          </div>

          {/* Best Score */}
          <div className="px-6 py-4 flex items-center gap-4">
            <span className="text-xs text-tertiary uppercase tracking-wide font-medium w-32 shrink-0">Personal Best</span>
            <span className="text-sm">{bestScore > 0 ? bestScore.toLocaleString() : "—"}</span>
          </div>

          {/* Participation Rate */}
          <div className="px-6 py-4 flex items-center gap-4">
            <span className="text-xs text-tertiary uppercase tracking-wide font-medium w-32 shrink-0">Participation</span>
            <span className="text-sm">
              {participated}/{total}
              <span className={cn("ml-1.5", participationRate === 100 ? "text-accent" : "text-tertiary")}>({participationRate}%)</span>
            </span>
          </div>
        </div>

        {/* Score history */}
        <div className="bg-panel rounded-xl overflow-hidden flex-shrink-0">
          {/* Header — entry count + date range filter + add score */}
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
                  placeholder="All dates"
                  align="right"
                  subtle
                  compact
                />
              )}
              <button
                onClick={() => setDrawer({ isOpen: true, mode: "create", section: "scores", data: { character: charDetail.name, _fromCharDetail: true } })}
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
                    { label: "Date", field: "date" },
                    { label: "Score", field: "score" },
                  ]}
                  sort={detailScoreSort}
                  onSort={(f) => {
                    setDetailScoreSort((s) =>
                      s.field === f ? { field: f, dir: s.dir === "asc" ? "desc" : "asc" } : { field: f, dir: "desc" }
                    );
                    setDetailScorePage(1);
                  }}
                  onSelectAll={() => toggleAll(pagedDetailScores.map((e) => e.date), selDetailScores, setSelDetailScores)}
                  allSelected={pagedDetailScores.length > 0 && pagedDetailScores.every((e) => selDetailScores.has(e.date))}
                  someSelected={pagedDetailScores.some((e) => selDetailScores.has(e.date))}
                />
                <tbody>
                  {pagedDetailScores.map((entry, i) => {
                    const isEditing = scoreInlineEdit?.origDate === entry.date;
                    return (
                      <tr key={`${entry.date}-${i}`} className={cn("border-t border-tertiary/[6%] transition-colors", isEditing ? "bg-background/40" : "hover:bg-background/40")}>
                        {/* Checkbox */}
                        <td className="pl-5 pr-2 py-4 w-10">
                          <Checkbox
                            checked={selDetailScores.has(entry.date)}
                            onChange={() => toggleSel(selDetailScores, entry.date, setSelDetailScores)}
                          />
                        </td>
                        {/* Date — editable when row is in edit mode */}
                        <td className="px-6 py-4 text-sm" onClick={(e) => e.stopPropagation()}>
                          {isEditing ? (
                            <DatePicker
                              subtle
                              compact
                              wednesdayOnly
                              value={scoreInlineEdit!.dateValue}
                              onChange={(v) => setScoreInlineEdit((s) => s && { ...s, dateValue: v })}
                            />
                          ) : (
                            <span>{entry.date}</span>
                          )}
                        </td>
                        {/* Score — editable when row is in edit mode */}
                        <td className="px-6 py-4 text-sm" onClick={(e) => e.stopPropagation()}>
                          {isEditing ? (
                            <input
                              type="number"
                              value={scoreInlineEdit!.scoreValue}
                              onChange={(e) => setScoreInlineEdit((s) => s && { ...s, scoreValue: e.target.value })}
                              onKeyDown={(e) => { if (e.key === "Enter") inlineSaveScore(); if (e.key === "Escape") setScoreInlineEdit(null); }}
                              className="w-[74px] bg-background border border-tertiary/20 rounded-lg px-2 py-1 text-sm text-white focus:outline-none focus:border-accent/40 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              autoFocus
                            />
                          ) : (
                            <span className={cn(entry.score === 0 && "text-[#A46666]")}>{entry.score.toLocaleString()}</span>
                          )}
                        </td>
                        {/* Actions — confirm/cancel when editing, edit/delete otherwise */}
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
                                  onClick={(e) => { e.stopPropagation(); setScoreInlineEdit({ origDate: entry.date, dateValue: entry.date, scoreValue: String(entry.score) }); }}
                                  title="Edit"
                                  className="text-tertiary hover:text-accent transition-colors"
                                >
                                  <FaEdit size={14} />
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); deleteScore(charDetail.name, entry.date); }}
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
                  })}
                  {pagedDetailScores.length === 0 && (
                    <tr><td colSpan={4} className="px-6 py-8 text-sm text-tertiary/50 text-center">
                      No scores in selected range
                    </td></tr>
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

  const renderUserDetail = () => {
    if (!userDetail) return null;

    const rawUserChars = userDetail.characters;
    const userChars = userDetailCharSort
      ? [...rawUserChars].sort((a, b) => {
          const dir = userDetailCharSort.dir === "asc" ? 1 : -1;
          switch (userDetailCharSort.field) {
            case "name":        return dir * a.name.localeCompare(b.name);
            case "memberSince": return dir * ((a.memberSince ?? "").localeCompare(b.memberSince ?? ""));
            case "scores":      return dir * (a.scores.length - b.scores.length);
            default:            return 0;
          }
        })
      : rawUserChars;

    return (
      <div className="flex flex-col gap-6">
        <button
          onClick={() => { setUserDetail(null); navigate("/admin/users"); }}
          className="flex items-center gap-2 text-sm text-tertiary hover:text-white transition-colors self-start"
        >
          <FaArrowLeft size={12} /> Back to Users
        </button>

        {/* Header */}
        <div className="bg-panel rounded-xl px-6 py-5 flex items-center gap-5">
          {userDetail.avatarUrl ? (
            <img
              src={userDetail.avatarUrl}
              alt={userDetail.username ?? ""}
              className="w-14 h-14 rounded-full object-cover bg-background shrink-0"
            />
          ) : (
            <div className="w-14 h-14 rounded-full bg-background flex items-center justify-center shrink-0">
              <FaUserAlt size={20} className="text-tertiary/40" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl">{userDetail.username ?? "Unknown User"}</h2>
              {userDetail.nickname && <span className="text-sm text-tertiary/60">{userDetail.nickname}</span>}
            </div>
            <div className="mt-0.5 text-xs text-tertiary/50">
              <CopyId id={userDetail._id} />
            </div>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); deleteUser(userDetail._id, userDetail.username); }}
            title="Delete user"
            className="flex items-center gap-1.5 text-xs text-[#A46666]/70 hover:text-[#A46666] border border-[#A46666]/20 hover:border-[#A46666]/40 rounded-lg px-2.5 py-1.5 transition-colors shrink-0"
          >
            <FaTrash size={11} className="mb-0.5"/> Delete User
          </button>
        </div>

        {/* Condensed info */}
        <div className="bg-panel rounded-xl divide-y divide-tertiary/[6%]">
          <div className="px-6 py-4 flex items-center gap-4">
            <span className="text-xs text-tertiary uppercase tracking-wide font-medium w-32 shrink-0">Role</span>
            <div className="flex items-center gap-1.5 text-sm text-tertiary">
              {(userMemberData?.role ?? userDetail.role) === "bee" && <FaShieldAlt size={11} className="text-accent" />}
              <span className="capitalize">{userMemberData?.role ?? userDetail.role ?? "—"}</span>
            </div>
          </div>
          <div className="px-6 py-4 flex items-center gap-4">
            <span className="text-xs text-tertiary uppercase tracking-wide font-medium w-32 shrink-0">Member Since</span>
            <span className="text-sm text-tertiary">
              {(userMemberData?.joinedAt ?? userDetail.joinedAt)
                ? dayjs(userMemberData?.joinedAt ?? userDetail.joinedAt).format("MMM DD, YYYY")
                : "—"}
            </span>
          </div>
          <div className="px-6 py-4 flex items-center gap-4">
            <span className="text-xs text-tertiary uppercase tracking-wide font-medium w-32 shrink-0">Graph Color</span>
            <div className="flex items-center gap-2.5">
              <Select
                variant="color"
                options={GRAPH_COLORS.map((c) => ({ label: c.name, value: c.value, color: rgbCss(c.value) }))}
                value={userEdits.graphColor}
                onChange={(v) => { setUserEdits((p) => ({ ...p, graphColor: v })); setUserEditsDirty(true); }}
              />
              {userEditsDirty && (
                <>
                  <button
                    onClick={saveUserEdits}
                    title="Confirm"
                    className="text-[#669A68] hover:text-white transition-colors"
                  >
                    <FaCheck size={13} />
                  </button>
                  <button
                    onClick={() => { setUserEdits({ graphColor: userDetail.graphColor }); setUserEditsDirty(false); }}
                    title="Cancel"
                    className="text-[#A46666] hover:text-white transition-colors"
                  >
                    <FaTimes size={16} />
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Characters table */}
        <div className="bg-panel rounded-xl overflow-hidden flex-shrink-0">
          <div className="px-6 py-5 flex items-center gap-4">
            <h3 className="text-lg">Linked Characters</h3>
            <span className="text-tertiary/60 text-sm mt-1">{rawUserChars.length} linked</span>
          </div>
          <div className="bg-tertiary/20 h-px" />
          <BatchBar
            count={selUserDetailChars.size}
            onDelete={batchDeleteUserDetailChars}
            onClear={() => setSelUserDetailChars(new Set())}
          />
          <table className="w-full table-fixed">
            <SortableHead
              cols={[
                { label: "Name",         field: "name"        },
                { label: "Member Since", field: "memberSince" },
                { label: "Level",        field: "level"       },
                { label: "Scores",       field: "scores"      },
              ]}
              sort={userDetailCharSort}
              onSort={(f) => toggleSort(userDetailCharSort, f, setUserDetailCharSort)}
              onSelectAll={() => toggleAll(userChars.map((c) => c.name), selUserDetailChars, setSelUserDetailChars)}
              allSelected={userChars.length > 0 && userChars.every((c) => selUserDetailChars.has(c.name))}
              someSelected={userChars.some((c) => selUserDetailChars.has(c.name))}
            />
            <tbody>
              {userChars.map((char) => (
                <tr
                  key={char.name}
                  onClick={() => {
                    const participated = char.scores.filter((s) => s.score > 0).length;
                    const total = char.scores.length;
                    openCharDetail({ ...char, userId: userDetail._id, scoreCount: total, participationRate: total > 0 ? Math.round((participated / total) * 100) : 0 }, userDetail);
                  }}
                  className="border-t border-tertiary/[6%] hover:bg-background/40 transition-colors cursor-pointer"
                >
                  <td className="pl-5 pr-2 py-4" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selUserDetailChars.has(char.name)}
                      onChange={() => toggleSel(selUserDetailChars, char.name, setSelUserDetailChars)}
                    />
                  </td>
                  <td className="px-6 py-4 text-sm text-accent">{char.name}</td>
                  <td className="px-6 py-4 text-sm text-tertiary">{char.memberSince}</td>
                  <td className="px-6 py-4 text-sm text-tertiary">{(char as { level?: number }).level ?? "—"}</td>
                  <td className="px-6 py-4 text-sm">{char.scores.length}</td>
                  <RowActions
                    onDelete={() => { deleteCharacter(userDetail._id, char.name); }}
                  />
                </tr>
              ))}
              {userChars.length === 0 && (
                <tr><td colSpan={6} className="px-6 py-8 text-sm text-tertiary/50 text-center">No characters linked</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

  const renderSection = () => {
    // Drill-down views take precedence
    if (charDetail) return renderCharDetail();
    if (userDetail) return renderUserDetail();

    switch (activeSection) {
      case "users":
        return (
          <div className="bg-panel rounded-xl overflow-hidden flex-shrink-0">
            <SectionHeader
              title="Users"
              count={filteredUsers.length}
              canCreate={false}
              createSection="users"
            />
            <div className="bg-tertiary/20 h-px" />
            <div className="flex items-center gap-3 px-6 py-4 border-b border-tertiary/[6%]">
              <FaSearch size={13} className="text-tertiary/50 flex-shrink-0" />
              <input
                type="text"
                placeholder="Filter by username or Discord ID..."
                value={userSearch}
                onChange={(e) => { setUserSearch(e.target.value); setUserPage(1); }}
                className="bg-transparent text-sm text-white placeholder-tertiary/40 focus:outline-none w-full max-w-xs"
              />
            </div>
            {usersLoading ? (
              <p className="px-6 py-8 text-sm text-tertiary/50 text-center">Loading...</p>
            ) : (
              <>
                <BatchBar
                  count={selUsers.size}
                  onDelete={batchDeleteUsers}
                  onClear={() => setSelUsers(new Set())}
                />
                <table className="w-full table-fixed">
                  <SortableHead
                    cols={[
                      { label: "User",         field: "username",       className: "w-[22%]" },
                      { label: "Discord ID",   field: "id",             className: "w-[30%]" },
                      { label: "Graph Colour", field: "graphColor",     className: "w-[20%]" },
                      { label: "Characters",   field: "characterCount", className: "w-[14%]" },
                    ]}
                    sort={userSort}
                    onSort={(f) => toggleSort(userSort, f, setUserSort)}
                    onSelectAll={() => toggleAll(pagedUsers.map((u) => u.id), selUsers, setSelUsers)}
                    allSelected={pagedUsers.length > 0 && pagedUsers.every((u) => selUsers.has(u.id))}
                    someSelected={pagedUsers.some((u) => selUsers.has(u.id))}
                  />
                  <tbody>
                    {pagedUsers.map((user) => (
                      <tr
                        key={user.id}
                        onClick={() => {
                          const found = userData.find((u) => u._id === user.id);
                          if (found) { setUserDetail(found); navigate(`/admin/users/${user.id}`); }
                        }}
                        className="border-t border-tertiary/[6%] hover:bg-background/40 transition-colors cursor-pointer"
                      >
                        <td className="pl-5 pr-2 py-4" onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selUsers.has(user.id)}
                            onChange={() => toggleSel(selUsers, user.id, setSelUsers)}
                          />
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <p className="text-sm text-white">{user.username ?? "—"}</p>
                            {user.nickname && <p className="text-xs text-tertiary/60">{user.nickname}</p>}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-xs text-tertiary/50 font-mono">
                          <CopyId id={user.id} />
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2.5">
                            <span
                              className="rounded-full w-3.5 h-3.5 flex-shrink-0 border border-white/10"
                              style={{ backgroundColor: rgbCss(user.graphColor) }}
                            />
                            <span className="text-sm text-tertiary">
                              {GRAPH_COLORS.find((c) => c.value === user.graphColor)?.name ?? user.graphColor}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <span className="text-accent">{user.characterCount}</span>
                          <span className="text-tertiary"> linked</span>
                        </td>
                        <RowActions
                          onDelete={() => deleteUser(user.id, user.username)}
                        />
                      </tr>
                    ))}
                    {pagedUsers.length === 0 && (
                      <tr><td colSpan={6} className="px-6 py-8 text-sm text-tertiary/50 text-center">No users found</td></tr>
                    )}
                  </tbody>
                </table>
                <Pagination
                  page={userPage}
                  total={filteredUsers.length}
                  pageCount={userPageCount}
                  onPrev={() => setUserPage((p) => p - 1)}
                  onNext={() => setUserPage((p) => p + 1)}
                />
              </>
            )}
          </div>
        );

      case "characters":
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
              <DatePicker
                mode="range"
                from={charDateFrom}
                to={charDateTo}
                onRangeChange={(f, t) => { setCharDateFrom(f); setCharDateTo(t); setCharPage(1); }}
                wednesdayOnly
                subtle
                compact
                placeholder="All Dates"
                align="right"
                dropUp
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
                          <span className={cn(char.participationRate === 100 && "text-accent")}>{char.participationRate}%</span>
                          <span className="text-tertiary/50 ml-1 text-xs">({char.scores.filter(s => s.score > 0).length}/{char.scores.length})</span>
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

      case "scores":
        return (
          <div className="bg-panel rounded-xl overflow-hidden flex-shrink-0">
            <SectionHeader
              title="Scores"
              count={filteredScores.length}
              createSection="scores"
              extra={
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
              }
            />
            <div className="bg-tertiary/20 h-px" />
            <div className="flex items-center gap-3 px-6 py-4 border-b border-tertiary/[6%]">
              <FaSearch size={13} className="text-tertiary/50 flex-shrink-0" />
              <input
                type="text"
                placeholder="Filter by character name..."
                value={scoreSearch}
                onChange={(e) => { setScoreSearch(e.target.value); setScorePage(1); }}
                className="bg-transparent text-sm text-white placeholder-tertiary/40 focus:outline-none w-full max-w-xs"
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
                      const isEditing = scoreTabInlineEdit?.origCharacter === score.character && scoreTabInlineEdit?.origDate === score.date;
                      return (
                        <tr
                          key={`${score.character}-${score.date}-${i}`}
                          className={cn("border-t border-tertiary/[6%] transition-colors", isEditing ? "bg-background/40" : "hover:bg-background/40")}
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
                              className="text-accent hover:underline text-left"
                              onClick={() => { const c = liveCharacters.find((x) => x.name === score.character); if (c) openCharDetail(c); }}
                            >{score.character}</button>
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
                                    (s) => s.character === scoreTabInlineEdit!.origCharacter && s.date === scoreTabInlineEdit!.dateValue
                                  ) && (
                                    <p className="text-[#A46666] text-xs">Warning - Score exists for selected date</p>
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
                                onKeyDown={(e) => { if (e.key === "Enter") inlineSaveScoreTab(); if (e.key === "Escape") setScoreTabInlineEdit(null); }}
                                className="w-[74px] bg-background border border-tertiary/20 rounded-lg px-2 py-1 text-sm text-white focus:outline-none focus:border-accent/40 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                autoFocus
                              />
                            ) : (
                              <span className={cn(score.score === 0 && "text-[#A46666]")}>{score.score.toLocaleString()}</span>
                            )}
                          </td>
                          <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-4">
                              {isEditing ? (
                                <>
                                  <button onClick={inlineSaveScoreTab} title="Confirm" className="text-[#669A68] hover:text-white transition-colors"><FaCheck size={14} /></button>
                                  <button onClick={() => setScoreTabInlineEdit(null)} title="Cancel" className="text-[#A46666] hover:text-white transition-colors"><FaTimes size={16} /></button>
                                </>
                              ) : (
                                <>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setScoreTabInlineEdit({ origCharacter: score.character, origDate: score.date, dateValue: score.date, scoreValue: String(score.score) }); }}
                                    title="Edit" className="text-tertiary hover:text-accent transition-colors"
                                  ><FaEdit size={14} /></button>
                                  <button onClick={(e) => { e.stopPropagation(); deleteScore(score.character, score.date); }} title="Delete" className="text-tertiary hover:text-[#A46666] transition-colors"><FaTrash size={14} /></button>
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

      case "exceptions":
        return (
          <div className="bg-panel rounded-xl overflow-hidden flex-shrink-0">
            <SectionHeader
              title="Exceptions"
              count={filteredExceptions.length}
              createSection="exceptions"
            />
            <div className="bg-tertiary/20 h-px" />
            <div className="flex items-center gap-3 px-6 py-4 border-b border-tertiary/[6%]">
              <FaSearch size={13} className="text-tertiary/50 flex-shrink-0" />
              <input
                type="text"
                placeholder="Filter by character or exception..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setExcPage(1); }}
                className="bg-transparent text-sm text-white placeholder-tertiary/40 focus:outline-none w-full max-w-xs"
              />
            </div>
            {exceptionsLoading ? (
              <p className="px-6 py-8 text-sm text-tertiary/50 text-center">Loading...</p>
            ) : (
              <>
                <BatchBar
                  count={selExcs.size}
                  onDelete={batchDeleteExcs}
                  onClear={() => setSelExcs(new Set())}
                />
                <table className="w-full table-fixed">
                  <SortableHead
                    cols={[
                      { label: "Character", field: "name", className: "w-[42%]" },
                      { label: "Exception", field: "exception", className: "w-[42%]" },
                    ]}
                    sort={excSort}
                    onSort={(f) => { toggleSort(excSort, f, setExcSort); setExcPage(1); }}
                    onSelectAll={() => toggleAll(pagedExcs.map((e) => e._id), selExcs, setSelExcs)}
                    allSelected={pagedExcs.length > 0 && pagedExcs.every((e) => selExcs.has(e._id))}
                    someSelected={pagedExcs.some((e) => selExcs.has(e._id))}
                  />
                  <tbody>
                    {pagedExcs.map((exc) => {
                      const isEditing = excInlineEdit?.id === exc._id;
                      return (
                        <tr
                          key={exc._id}
                          className={cn("border-t border-tertiary/[6%] transition-colors", isEditing ? "bg-background/40" : "hover:bg-background/40")}
                        >
                          <td className="pl-5 pr-2 py-4 w-10">
                            <Checkbox
                              checked={selExcs.has(exc._id)}
                              onChange={() => toggleSel(selExcs, exc._id, setSelExcs)}
                            />
                          </td>
                          <td className="px-6 py-4 text-sm" onClick={(e) => e.stopPropagation()}>
                            {isEditing ? (
                              <AutocompleteInput
                                value={excInlineEdit!.name}
                                onChange={(v) => setExcInlineEdit((s) => s && { ...s, name: v })}
                                onKeyDown={(e) => { if (e.key === "Enter") inlineSaveException(); if (e.key === "Escape") setExcInlineEdit(null); }}
                                suggestions={liveCharacters.map((c) => c.name)}
                                inputClassName="w-[175px] bg-background border border-tertiary/20 rounded-lg px-2 py-1 text-sm text-white focus:outline-none focus:border-accent/40 transition-colors"
                                autoFocus
                              />
                            ) : (
                              <button
                                className="text-accent hover:underline text-left"
                                onClick={() => { const c = liveCharacters.find((x) => x.name === exc.name); if (c) openCharDetail(c); }}
                              >{exc.name}</button>
                            )}
                          </td>
                          <td className="px-6 py-4 text-sm" onClick={(e) => e.stopPropagation()}>
                            {isEditing ? (
                              <input
                                className="w-[175px] bg-background border border-tertiary/20 rounded-lg px-2 py-1 text-sm text-white focus:outline-none focus:border-accent/40 transition-colors"
                                value={excInlineEdit!.exception}
                                onChange={(e) => setExcInlineEdit((s) => s && { ...s, exception: e.target.value })}
                                onKeyDown={(e) => { if (e.key === "Enter") inlineSaveException(); if (e.key === "Escape") setExcInlineEdit(null); }}
                              />
                            ) : (
                              <span className="text-tertiary">{exc.exception}</span>
                            )}
                          </td>
                          <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-4">
                              {isEditing ? (
                                <>
                                  <button
                                    onClick={inlineSaveException}
                                    title="Confirm"
                                    className="text-[#669A68] hover:text-white transition-colors"
                                  >
                                    <FaCheck size={14} />
                                  </button>
                                  <button
                                    onClick={() => setExcInlineEdit(null)}
                                    title="Cancel"
                                    className="text-[#A46666] hover:text-white transition-colors"
                                  >
                                    <FaTimes size={16} />
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setExcInlineEdit({ id: exc._id, name: exc.name, exception: exc.exception }); }}
                                    title="Edit"
                                    className="text-tertiary hover:text-accent transition-colors"
                                  >
                                    <FaEdit size={14} />
                                  </button>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); deleteException(exc._id, exc.name); }}
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
                    })}
                    {pagedExcs.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-6 py-8 text-sm text-tertiary/50 text-center">
                          {search ? `No exceptions matching "${search}"` : "No exceptions found"}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
                <Pagination
                  page={excPage}
                  total={filteredExceptions.length}
                  pageCount={excPageCount}
                  onPrev={() => setExcPage((p) => p - 1)}
                  onNext={() => setExcPage((p) => p + 1)}
                />
              </>
            )}
          </div>
        );
    }
  };

  // ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

  const renderDrawerFields = () => {
    const { section, mode, data } = drawer;
    const isCreate = mode === "create";

    switch (section) {
      case "users":
        return (
          <>
            {isCreate ? (
              <Field label="Discord ID">
                <input
                  className={inputCls}
                  value={data.id ?? ""}
                  onChange={(e) => updateField("id", e.target.value)}
                  placeholder="e.g. 631337640754675725"
                />
              </Field>
            ) : (
              <div className="flex flex-col gap-0.5 pb-1">
                <p className="text-white font-medium">{data.username ?? "Unknown User"}</p>
                <p className="text-tertiary/50 text-xs font-mono">{data.id}</p>
              </div>
            )}
            <Field label="Graph Colour">
              <div className="flex items-center gap-3">
                <span
                  className="rounded-full w-7 h-7 flex-shrink-0 border border-white/10"
                  style={{ backgroundColor: rgbCss(data.graphColor ?? "255,189,213") }}
                />
                <select
                  className={inputCls}
                  value={data.graphColor ?? ""}
                  onChange={(e) => updateField("graphColor", e.target.value)}
                >
                  {GRAPH_COLORS.map(({ name, value }) => (
                    <option key={value} value={value}>{name}</option>
                  ))}
                </select>
              </div>
            </Field>
          </>
        );

      case "characters":
        return (
          <>
            <Field label="Name" hint="Character names are case-sensitive.">
              <input
                className={inputCls}
                value={data.name ?? ""}
                onChange={(e) => updateField("name", e.target.value)}
                disabled={!isCreate}
              />
            </Field>
            <Field label="Member Since">
              <DatePicker
                value={data.memberSince ?? ""}
                onChange={(v) => updateField("memberSince", v)}
              />
            </Field>
            <Field
              label="Avatar URL"
              hint="Auto-fetched from MapleStory rankings. Only update if auto-fetch fails."
            >
              <input
                className={inputCls}
                value={data.avatar ?? ""}
                onChange={(e) => updateField("avatar", e.target.value)}
                placeholder="https://..."
              />
            </Field>
            <Field label="Owner (Discord ID)">
              <input
                className={inputCls}
                value={data.userId ?? ""}
                onChange={(e) => updateField("userId", e.target.value)}
                disabled={!isCreate}
                placeholder="e.g. 631337640754675725"
              />
            </Field>
          </>
        );

      case "scores":
        return (
          <>
            <Field label="Character">
              {isCreate && !data._fromCharDetail ? (
                <AutocompleteInput
                  value={data.character ?? ""}
                  onChange={(v) => updateField("character", v)}
                  suggestions={liveCharacters.map((c) => c.name)}
                  placeholder="e.g. Dánnis"
                  inputClassName={inputCls}
                />
              ) : (
                <input
                  className={cn(inputCls, "text-tertiary/60")}
                  value={data.character ?? ""}
                  disabled
                  readOnly
                />
              )}
            </Field>
            <Field label="Date">
              <DatePicker
                mode="single"
                value={data.date ?? ""}
                onChange={(v) => updateField("date", v)}
                wednesdayOnly
                disabledDates={
                  liveScores
                    .filter((s) =>
                      s.character === (data.character ?? "") &&
                      (!isCreate ? s.date !== data.date : true)
                    )
                    .map((s) => s.date)
                }
                placeholder="Select Date"
                align="right"
                subtle
              />
            </Field>
            {isCreate &&
              data.character &&
              data.date &&
              liveScores.some(
                (s) => s.character === data.character && s.date === data.date
              ) && (
                <p className="text-[#A46666] text-xs px-0.5 -mt-1">
                  A score for this character on this date already exists.
                </p>
              )}
            <Field label="Score">
              <input
                type="number"
                className={`${inputCls} [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
                value={data.score ?? ""}
                onChange={(e) => updateField("score", e.target.value)}
                placeholder="0"
                min={0}
              />
            </Field>
          </>
        );

      case "exceptions":
        return (
          <>
            <Field label="Character Name" hint="The real (correct) character name.">
              <AutocompleteInput
                value={data.name ?? ""}
                onChange={(v) => updateField("name", v)}
                suggestions={liveCharacters.map((c) => c.name)}
                placeholder="e.g. Dánnis"
                inputClassName={inputCls}
              />
            </Field>
            <Field
              label="Exception"
              hint="The incorrect name that the scanner picked up."
            >
              <input
                className={inputCls}
                value={data.exception ?? ""}
                onChange={(e) => updateField("exception", e.target.value)}
                placeholder="e.g. Danniz"
              />
            </Field>
          </>
        );
    }
  };

  // ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

  return (
    <section className="flex flex-1 min-h-0">
      {/* Sidebar */}
      <aside className="bg-panel flex flex-col gap-1 p-4 w-[220px] flex-shrink-0 border-r border-tertiary/[6%]">
        <p className="text-xs text-tertiary/50 uppercase tracking-widest px-4 pt-3 pb-2 font-medium">
          Database
        </p>
        {navItems.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => {
              const sectionPaths: Record<Section, string> = {
                users: "/admin/users",
                characters: "/admin/characters",
                scores: "/admin/scores",
                exceptions: "/admin/exceptions",
              };
              setActiveSection(id);
              navigate(sectionPaths[id]);
              // Reset all search, sort, page, and inline-edit state when switching tabs
              setSearch(""); setCharSearch(""); setUserSearch(""); setScoreSearch("");
              setCharPage(1); setUserPage(1); setScorePage(1); setExcPage(1);
              setCharSort(null); setUserSort(null); setScoreSort(null); setExcSort(null);
              setCharDateFrom(""); setCharDateTo(""); setScoreDateFilter("");
              setExcInlineEdit(null); setScoreTabInlineEdit(null);
              setCharDetail(null);
              setUserDetail(null);
              setPrevContext(null);
              setSelUsers(new Set());
              setSelChars(new Set());
              setSelScores(new Set());
              setSelExcs(new Set());
              closeDrawer();
            }}
            className={cn(
              "flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm text-left transition-colors",
              activeSection === id
                ? "bg-background/80 text-accent"
                : "text-tertiary hover:text-white hover:bg-background/40"
            )}
          >
            <Icon size={16} className="flex-shrink-0" />
            {label}
          </button>
        ))}

        <div className="bg-tertiary/20 rounded-full h-px mx-2 my-2" />

      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto p-8 flex flex-col gap-6">
        {/* Active section table */}
        {renderSection()}
      </main>

      {/* Edit / create drawer */}
      <>
        {/* Backdrop */}
        <div
          className={cn(
            "fixed inset-0 bg-background/60 backdrop-blur-sm z-40 transition-opacity duration-300",
            drawer.isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
          )}
          onClick={closeDrawer}
        />

        {/* Drawer panel */}
        <div className={cn(
          "fixed right-0 top-0 h-full w-[420px] bg-panel border-l border-tertiary/[8%] z-50 overflow-y-auto flex flex-col transition-transform duration-300",
          drawer.isOpen ? "translate-x-0" : "translate-x-full"
        )}>
            {/* Drawer header */}
            <div className="flex justify-between items-center px-8 py-6 border-b border-tertiary/[8%]">
              <div>
                <h2 className="text-xl capitalize">
                  {drawer.mode === "create" ? "New" : "Edit"}{" "}
                  {drawer.section.slice(0, -1)}
                </h2>
                <p className="text-tertiary text-sm mt-0.5">
                  {drawer.mode === "create"
                    ? drawer.section === "scores"
                      ? "Add a new score to the database"
                      : drawer.section === "exceptions"
                      ? "Add a new exception to the database"
                      : `Add a new record to the ${drawer.section} collection`
                    : `Modify this record in the ${drawer.section} collection`}
                </p>
              </div>
              <button
                onClick={closeDrawer}
                className="text-tertiary hover:text-white transition-colors"
              >
                <FaTimes size={16} />
              </button>
            </div>

            {/* Fields */}
            <div className="flex flex-col gap-5 px-8 py-6 flex-1">
              {renderDrawerFields()}
            </div>

            {/* Actions */}
            <div className="flex gap-3 px-8 py-6 border-t border-tertiary/[8%]">
              {(() => {
                const d = drawer.data;
                const submitDisabled =
                  drawer.mode === "create" && (
                    drawer.section === "scores"
                      ? !d.character || !d.date || d.score === "" || d.score === undefined || d.score === null || liveScores.some((s) => s.character === d.character && s.date === d.date)
                      : drawer.section === "exceptions"
                      ? !d.name || !d.exception
                      : false
                  );
                return (
                  <button
                    onClick={handleSave}
                    disabled={submitDisabled}
                    className={cn(
                      "flex-1 rounded-lg py-2.5 text-sm transition-colors",
                      submitDisabled
                        ? "bg-tertiary/10 text-tertiary/40 cursor-not-allowed"
                        : "bg-accent/15 hover:bg-accent/20 text-accent"
                    )}
                  >
                    {drawer.mode === "create" ? "Create" : "Save Changes"}
                  </button>
                );
              })()}
              <button
                onClick={closeDrawer}
                className="flex-1 bg-background hover:bg-background/60 text-tertiary rounded-lg py-2.5 text-sm transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
      </>
      {/* Warning / delete confirmation modal */}
      {modal && (
        <WarningModal
          isOpen={modal.isOpen}
          variant={modal.variant}
          title={modal.title}
          description={modal.description}
          onConfirm={modal.onConfirm}
          onCancel={closeModal}
          confirmLabel={modal.variant === "confirm" ? modal.confirmLabel : undefined}
          confirmDanger={modal.variant === "confirm" ? modal.confirmDanger : undefined}
          confirmWord={modal.variant === "sensitive" ? modal.confirmWord : undefined}
        />
      )}
    </section>
  );
};

export default AdminPanel;
