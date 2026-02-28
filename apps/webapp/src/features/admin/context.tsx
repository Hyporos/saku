import {
  createContext,
  useContext,
  useCallback,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import { useNavigate, useMatch, useLocation } from "react-router-dom";
import axios from "axios";
import {
  FaUsers,
  FaUserAlt,
  FaChartBar,
  FaExclamationCircle,
  FaHistory,
  FaCamera,
  FaArchive,
} from "react-icons/fa";
import {
  BOT_API,
} from "./constants";
import { toStoredDate, charSlug } from "./utils";
import { useDataFetching } from "./hooks/useDataFetching";
import { useTabState } from "./hooks/useTabState";
import { useDetailState } from "./hooks/useDetailState";
import { useModals } from "./hooks/useModals";
import { useActionLog } from "./hooks/useActionLog";
import { useNotifications } from "../../context/NotificationContext";
import type {
  Section,
  DrawerState,
  UserDoc,
  ExceptionDoc,
  CharDetail,
  UserDetail,
  SortState,
  ModalPayload,
  LiveUser,
  LiveScore,
  PrevContext,
  UserMemberData,
  OwnerData,
  CharApiData,
  CharEdits,
  ScoreInlineEditState,
  ScoreTabInlineEditState,
  ExcInlineEditState,
  ToolSection,
  ActionLogEntry,
} from "./types";

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

type SetState<T> = React.Dispatch<React.SetStateAction<T>>;
type BackTrailEntry = { label: string; path: string };

interface AdminContextValue {
  // Navigation
  activeSection: Section;
  navigateToSection: (id: Section) => void;
  backTrail: BackTrailEntry[];
  backTargetLabel: string;
  goBackFromTrail: () => void;

  // Raw data from API
  userData: UserDoc[];
  usersLoading: boolean;
  exceptionsData: ExceptionDoc[];
  exceptionsLoading: boolean;

  // Derived flat views
  liveUsers: LiveUser[];
  liveCharacters: CharDetail[];
  liveScores: LiveScore[];

  // Users tab
  userSearch: string;
  setUserSearch: SetState<string>;
  userPage: number;
  setUserPage: SetState<number>;
  userSort: SortState | null;
  setUserSort: SetState<SortState | null>;
  filteredUsers: LiveUser[];
  pagedUsers: LiveUser[];
  userPageCount: number;
  selUsers: Set<string>;
  setSelUsers: SetState<Set<string>>;

  // Characters tab
  charSearch: string;
  setCharSearch: SetState<string>;
  charPage: number;
  setCharPage: SetState<number>;
  charSort: SortState | null;
  setCharSort: SetState<SortState | null>;
  filteredChars: CharDetail[];
  pagedChars: CharDetail[];
  charPageCount: number;
  selChars: Set<string>;
  setSelChars: SetState<Set<string>>;

  // Scores tab
  scoreSearch: string;
  setScoreSearch: SetState<string>;
  scoreDateFilter: string;
  setScoreDateFilter: SetState<string>;
  scorePage: number;
  setScorePage: SetState<number>;
  scoreSort: SortState | null;
  setScoreSort: SetState<SortState | null>;
  filteredScores: LiveScore[];
  pagedScores: LiveScore[];
  scorePageCount: number;
  selScores: Set<string>;
  setSelScores: SetState<Set<string>>;
  scoreTabInlineEdit: ScoreTabInlineEditState | null;
  setScoreTabInlineEdit: SetState<ScoreTabInlineEditState | null>;

  // Exceptions tab
  excSearch: string;
  setExcSearch: SetState<string>;
  excPage: number;
  setExcPage: SetState<number>;
  excSort: SortState | null;
  setExcSort: SetState<SortState | null>;
  filteredExceptions: ExceptionDoc[];
  pagedExcs: ExceptionDoc[];
  excPageCount: number;
  selExcs: Set<string>;
  setSelExcs: SetState<Set<string>>;
  excInlineEdit: ExcInlineEditState | null;
  setExcInlineEdit: SetState<ExcInlineEditState | null>;

  // Detail drill-down
  charDetail: CharDetail | null;
  setCharDetail: SetState<CharDetail | null>;
  userDetail: UserDetail | null;
  setUserDetail: SetState<UserDetail | null>;
  prevContext: PrevContext | null;
  setPrevContext: SetState<PrevContext | null>;
  openCharDetail: (char: CharDetail, fromUser?: UserDetail, fromChar?: CharDetail, fromSection?: "scores" | "exceptions") => void;
  openUserDetail: (user: UserDetail) => void;

  // User detail
  userMemberData: UserMemberData | null;
  userDetailCharSort: SortState | null;
  setUserDetailCharSort: SetState<SortState | null>;
  selUserDetailChars: Set<string>;
  setSelUserDetailChars: SetState<Set<string>>;

  // Character detail — inline edits
  charEdits: CharEdits;
  setCharEdits: SetState<CharEdits>;
  charEditsDirty: boolean;
  setCharEditsDirty: SetState<boolean>;
  memberSinceDirty: boolean;
  setMemberSinceDirty: SetState<boolean>;
  graphColorDirty: boolean;
  setGraphColorDirty: SetState<boolean>;

  // Character detail — score view
  detailScoreSort: SortState | null;
  setDetailScoreSort: SetState<SortState | null>;
  detailScorePage: number;
  setDetailScorePage: SetState<number>;
  detailDateFrom: string;
  setDetailDateFrom: SetState<string>;
  detailDateTo: string;
  setDetailDateTo: SetState<string>;
  charApiData: CharApiData | null;
  charApiDataFor: string;
  charApiLoading: boolean;
  charApiError: boolean;
  ownerData: OwnerData | null;
  scoreInlineEdit: ScoreInlineEditState | null;
  setScoreInlineEdit: SetState<ScoreInlineEditState | null>;
  selDetailScores: Set<string>;
  setSelDetailScores: SetState<Set<string>>;

  // Drawer
  drawer: DrawerState;
  setDrawer: SetState<DrawerState>;
  openCreate: (section: Section) => void;
  closeDrawer: () => void;
  updateField: (field: string, value: unknown) => void;
  handleSave: () => Promise<void>;

  // Warning modal
  modal: (ModalPayload & { isOpen: boolean }) | null;
  closeModal: () => void;
  confirm: (payload: ModalPayload) => void;

  // Transfer modal
  transferModal: { isOpen: boolean; char: CharDetail | null };
  setTransferModal: SetState<{ isOpen: boolean; char: CharDetail | null }>;
  transferToInput: string;
  setTransferToInput: SetState<string>;
  transferDeleteSource: boolean;
  setTransferDeleteSource: SetState<boolean>;
  closeTransferModal: () => void;
  transferCharacter: () => Promise<void>;

  // Rename modal
  renameModal: { isOpen: boolean; char: CharDetail | null };
  setRenameModal: SetState<{ isOpen: boolean; char: CharDetail | null }>;
  closeRenameModal: () => void;
  renameCharacter: (newName: string) => Promise<void>;

  // Unlink modal
  unlinkModal: { isOpen: boolean; char: CharDetail | null };
  setUnlinkModal: SetState<{ isOpen: boolean; char: CharDetail | null }>;
  unlinkDeleteSource: boolean;
  setUnlinkDeleteSource: SetState<boolean>;
  closeUnlinkModal: () => void;
  unlinkCharacter: () => Promise<void>;

  // Batch unlink modal
  batchUnlinkModal: { isOpen: boolean; target: "user-detail" | "characters-tab" };
  batchUnlinkDeleteSource: boolean;
  setBatchUnlinkDeleteSource: SetState<boolean>;
  openBatchUnlinkModal: (target: "user-detail" | "characters-tab") => void;
  closeBatchUnlinkModal: () => void;
  confirmBatchUnlink: () => Promise<void>;

  // Data refresh
  refreshUsers: (force?: boolean) => Promise<void>;
  refreshExceptions: (force?: boolean) => Promise<void>;
  refreshActionLog: () => Promise<void>;
  refreshAllData: () => Promise<void>;

  // Save actions
  saveCharEdits: () => Promise<void>;
  saveMemberSince: () => Promise<void>;
  saveGraphColor: () => Promise<void>;

  // Delete / mutation actions
  deleteCharacter: (userId: string, name: string, label?: "unlink" | "delete") => void;
  deleteUser: (userId: string, username?: string | null) => void;
  deleteScore: (character: string, date: string, scoreId?: string) => void;
  deleteException: (id: string, name: string) => void;
  inlineSaveScore: () => Promise<void>;
  inlineSaveScoreTab: () => Promise<void>;
  inlineSaveException: () => Promise<void>;
  batchDeleteDetailScores: () => void;
  batchDeleteUserDetailChars: () => void;
  batchDeleteUsers: () => void;
  batchDeleteChars: () => void;
  batchDeleteScores: () => void;
  batchDeleteExcs: () => void;

  // Helpers
  toggleSel: (set: Set<string>, key: string, setter: SetState<Set<string>>) => void;
  toggleAll: (keys: string[], set: Set<string>, setter: SetState<Set<string>>) => void;
  toggleSort: (current: SortState | null, field: string, setter: (s: SortState | null) => void) => void;

  // Sidebar nav items
  navItems: Array<{ id: Section; label: string; icon: React.ElementType }>;
  monitoringItems: Array<{ id: ToolSection; label: string; icon: React.ElementType }>;
  toolItems: Array<{ id: ToolSection; label: string; icon: React.ElementType }>;
  activeToolSection: ToolSection | null;
  navigateToToolSection: (id: ToolSection) => void;

  // Action log
  actionLog: ActionLogEntry[];
  clearActionLog: () => void;
}

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

const AdminContext = createContext<AdminContextValue | null>(null);

// eslint-disable-next-line react-refresh/only-export-components
export const useAdminContext = () => {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error("useAdminContext must be used within AdminProvider");
  return ctx;
};

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

export const AdminProvider = ({ children }: { children: ReactNode }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const charMatch = useMatch("/admin/characters/:charName");
  const userMatch = useMatch("/admin/users/:userId");
  const urlCharName = charMatch?.params.charName;
  const urlUserId = userMatch?.params.userId;
  const [backTrail, setBackTrail] = useState<BackTrailEntry[]>([]);

  // ⎯⎯ Section ⎯⎯ //
  const [activeSection, setActiveSection] = useState<Section>(() => {
    const p = location.pathname;
    if (p.startsWith("/admin/users")) return "users";
    if (p.startsWith("/admin/characters")) return "characters";
    if (p.startsWith("/admin/scores")) return "scores";
    if (p.startsWith("/admin/exceptions")) return "exceptions";
    return "users";
  });

  // ⎯⎯ Domain hooks ⎯⎯ //
  const {
    userData, usersLoading,
    exceptionsData, exceptionsLoading,
    refreshUsers, refreshExceptions,
    liveUsers, liveCharacters, liveScores,
  } = useDataFetching();

  const {
    userSearch, setUserSearch, userPage, setUserPage, userSort, setUserSort,
    filteredUsers, pagedUsers, userPageCount, selUsers, setSelUsers,
    charSearch, setCharSearch, charPage, setCharPage, charSort, setCharSort,
    filteredChars, pagedChars, charPageCount, selChars, setSelChars,
    scoreSearch, setScoreSearch, scoreDateFilter, setScoreDateFilter,
    scorePage, setScorePage, scoreSort, setScoreSort,
    filteredScores, pagedScores, scorePageCount, selScores, setSelScores,
    scoreTabInlineEdit, setScoreTabInlineEdit,
    excSearch, setExcSearch, excPage, setExcPage, excSort, setExcSort,
    filteredExceptions, pagedExcs, excPageCount, selExcs, setSelExcs,
    excInlineEdit, setExcInlineEdit,
  } = useTabState({ liveUsers, liveCharacters, liveScores, exceptionsData });

  const {
    charDetail, setCharDetail, userDetail, setUserDetail, prevContext, setPrevContext,
    userMemberData, userDetailCharSort, setUserDetailCharSort,
    selUserDetailChars, setSelUserDetailChars,
    charEdits, setCharEdits, charEditsDirty, setCharEditsDirty,
    memberSinceDirty, setMemberSinceDirty, graphColorDirty, setGraphColorDirty,
    detailScoreSort, setDetailScoreSort, detailScorePage, setDetailScorePage,
    detailDateFrom, setDetailDateFrom, detailDateTo, setDetailDateTo,
    charApiData, charApiDataFor, charApiLoading, charApiError, ownerData,
    scoreInlineEdit, setScoreInlineEdit, selDetailScores, setSelDetailScores,
  } = useDetailState({ userData });

  const {
    drawer, setDrawer, modal, closeModal, confirm,
    openCreate, closeDrawer, updateField,
    transferModal, setTransferModal, transferToInput, setTransferToInput,
    transferDeleteSource, setTransferDeleteSource, closeTransferModal,
    renameModal, setRenameModal, closeRenameModal,
    unlinkModal, setUnlinkModal, unlinkDeleteSource, setUnlinkDeleteSource, closeUnlinkModal,
    batchUnlinkModal, batchUnlinkDeleteSource, setBatchUnlinkDeleteSource,
    openBatchUnlinkModal, closeBatchUnlinkModal,
  } = useModals();

  const { actionLog, clearActionLog, refreshActionLog } = useActionLog();
  const { notify } = useNotifications();

  // Extracts a user-friendly error message from an Axios error response
  const notifyError = useCallback((e: unknown, fallback = "Something went wrong") => {
    const ax = e as import("axios").AxiosError<{ error?: string }>;
    const status = ax?.response?.status;
    if (status === 409) notify("error", ax?.response?.data?.error ?? "Name already in use");
    else if (status === 429) notify("error", "Rate limited — wait a moment and try again");
    else if (status === 400) notify("error", ax?.response?.data?.error ?? "Invalid input");
    else if (status === 403) notify("error", "Not authorized");
    else if (status === 404) notify("error", ax?.response?.data?.error ?? "Not found");
    else notify("error", ax?.response?.data?.error ?? fallback);
  }, [notify]);

  const [activeToolSection, setActiveToolSection] = useState<ToolSection | null>(() => {
    if (location.pathname.startsWith("/admin/action-log")) return "action-log";
    if (location.pathname.startsWith("/admin/scanner")) return "scanner";
    if (location.pathname.startsWith("/admin/backups")) return "backups";
    return null;
  });

  // ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //
  // Effects

  // Load data when active section changes
  useEffect(() => {
    if (activeSection === "users" || activeSection === "characters" || activeSection === "scores") {
      refreshUsers(false);
    }
    if (activeSection === "exceptions") refreshExceptions(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSection]);

  // Warm caches on initial mount so tab switches feel instant
  useEffect(() => {
    refreshUsers(false);
    refreshExceptions(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep character detail in sync with route slug
  useEffect(() => {
    if (!urlCharName || usersLoading || userData.length === 0) return;
    const decoded = decodeURIComponent(urlCharName);
    const allFlat = userData.flatMap((u) => u.characters.map((c) => ({ name: c.name, userId: String(u._id) })));
    let matched = false;
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
          setUserDetail(null);
          setActiveSection("characters");
          matched = true;
          return;
        }
      }
    }
    if (!matched) setCharDetail(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userData, usersLoading, urlCharName]);

  // Keep user detail in sync with route id
  useEffect(() => {
    if (!urlUserId || usersLoading || userData.length === 0) return;
    const found = userData.find((u) => String(u._id) === urlUserId);
    if (found) {
      setUserDetail(found);
      setCharDetail(null);
      setActiveSection("users");
    } else {
      setUserDetail(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userData, usersLoading, urlUserId]);

  // Keep tool section in sync with URL for direct loads and browser navigation
  useEffect(() => {
    if (location.pathname.startsWith("/admin/action-log")) {
      setActiveToolSection("action-log");
      setCharDetail(null);
      setUserDetail(null);
      refreshActionLog();
      return;
    }
    if (location.pathname.startsWith("/admin/scanner")) {
      setActiveToolSection("scanner");
      setCharDetail(null);
      setUserDetail(null);
      return;
    }
    if (location.pathname.startsWith("/admin/backups")) {
      setActiveToolSection("backups");
      setCharDetail(null);
      setUserDetail(null);
      return;
    }
    setActiveToolSection(null);
  }, [location.pathname, refreshActionLog, setCharDetail, setUserDetail]);

  const refreshAllData = useCallback(async () => {
    await Promise.all([
      refreshUsers(),
      refreshExceptions(),
      refreshActionLog(),
    ]);
  }, [refreshUsers, refreshExceptions, refreshActionLog]);

  // ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //
  // Selection / sort helpers — shared across all tabs

  const toggleSort = (
    current: SortState | null,
    field: string,
    setter: (s: SortState | null) => void
  ) => {
    if (current?.field === field) {
      if (current.dir === "asc") setter({ field, dir: "desc" });
      else setter(null);
    } else {
      setter({ field, dir: "asc" });
    }
  };

  const toggleSel = (set: Set<string>, key: string, setter: SetState<Set<string>>) => {
    const next = new Set(set);
    if (next.has(key)) next.delete(key); else next.add(key);
    setter(next);
  };

  const toggleAll = (keys: string[], set: Set<string>, setter: SetState<Set<string>>) => {
    setter(keys.every((k) => set.has(k)) && keys.length > 0 ? new Set() : new Set(keys));
  };

  const sectionForPath = (path: string): Section => {
    if (path.startsWith("/admin/users")) return "users";
    if (path.startsWith("/admin/characters")) return "characters";
    if (path.startsWith("/admin/scores")) return "scores";
    if (path.startsWith("/admin/exceptions")) return "exceptions";
    return "users";
  };

  const sectionLabel = (section: Section) =>
    section === "users"
      ? "Users"
      : section === "characters"
        ? "Characters"
        : section === "scores"
          ? "Scores"
          : "Exceptions";

  const buildCharPath = (charName: string) => {
    const allFlat = userData.flatMap((u) => u.characters.map((c) => ({ name: c.name, userId: String(u._id) })));
    return `/admin/characters/${encodeURIComponent(charSlug(charName, allFlat))}`;
  };

  const pushBackEntry = (entry: BackTrailEntry) => {
    setBackTrail((prev) => {
      if (prev.length > 0 && prev[prev.length - 1].path === entry.path) return prev;
      return [...prev, entry];
    });
  };

  const toolSectionLabel = (ts: ToolSection) =>
    ts === "scanner" ? "Culvert Scanner" : ts === "action-log" ? "Action Log" : "Backups";

  const pushCurrentToBackTrail = () => {
    if (charDetail) {
      pushBackEntry({ label: charDetail.name, path: buildCharPath(charDetail.name) });
      return;
    }
    if (userDetail) {
      pushBackEntry({ label: userDetail.username ?? "User", path: `/admin/users/${userDetail._id}` });
      return;
    }
    if (activeToolSection) {
      pushBackEntry({ label: toolSectionLabel(activeToolSection), path: location.pathname });
      return;
    }
    pushBackEntry({ label: sectionLabel(activeSection), path: location.pathname });
  };

  const backTargetLabel = backTrail.length > 0 ? backTrail[backTrail.length - 1].label : "Characters";

  const hydrateDetailFromPath = (path: string): boolean => {
    const userMatch = path.match(/^\/admin\/users\/([^/]+)$/);
    if (userMatch) {
      const userId = decodeURIComponent(userMatch[1]);
      const foundUser = userData.find((u) => String(u._id) === userId);
      if (foundUser) {
        setUserDetail(foundUser);
        setCharDetail(null);
        return true;
      }
      return false;
    }

    const charMatch = path.match(/^\/admin\/characters\/([^/]+)$/);
    if (charMatch) {
      const slug = decodeURIComponent(charMatch[1]);
      const allFlat = userData.flatMap((u) => u.characters.map((c) => ({ name: c.name, userId: String(u._id) })));
      for (const u of userData) {
        for (const c of u.characters) {
          if (charSlug(c.name, allFlat) === slug) {
            const participated = c.scores.filter((s) => s.score > 0).length;
            const total = c.scores.length;
            setCharDetail({
              ...c,
              userId: String(u._id),
              scoreCount: total,
              participationRate: total > 0 ? Math.round((participated / total) * 100) : 0,
            });
            setUserDetail(null);
            return true;
          }
        }
      }
      return false;
    }

    return false;
  };

  const toolSectionForPath = (path: string): ToolSection | null => {
    if (path.startsWith("/admin/scanner")) return "scanner";
    if (path.startsWith("/admin/action-log")) return "action-log";
    if (path.startsWith("/admin/backups")) return "backups";
    return null;
  };

  const goBackFromTrail = () => {
    const target = backTrail[backTrail.length - 1];
    setPrevContext(null);
    if (target) {
      setBackTrail((prev) => prev.slice(0, -1));
      const toolSec = toolSectionForPath(target.path);
      if (toolSec) {
        setCharDetail(null);
        setUserDetail(null);
        setActiveToolSection(toolSec);
        navigate(target.path);
        return;
      }
      setActiveSection(sectionForPath(target.path));
      setActiveToolSection(null);
      const hydrated = hydrateDetailFromPath(target.path);
      if (!hydrated) {
        setCharDetail(null);
        setUserDetail(null);
      }
      navigate(target.path);
      return;
    }
    setCharDetail(null);
    setUserDetail(null);
    setActiveSection("characters");
    navigate("/admin/characters");
  };

  // ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //
  // Navigation

  const navigateToSection = (id: Section) => {
    const paths: Record<Section, string> = {
      users: "/admin/users",
      characters: "/admin/characters",
      scores: "/admin/scores",
      exceptions: "/admin/exceptions",
    };
    setActiveSection(id);
    setActiveToolSection(null);
    navigate(paths[id]);
    setUserSearch(""); setCharSearch(""); setScoreSearch(""); setExcSearch("");
    setUserPage(1); setCharPage(1); setScorePage(1); setExcPage(1);
    setUserSort({ field: "username", dir: "asc" });
    setCharSort({ field: "memberSince", dir: "desc" });
    setScoreSort({ field: "date", dir: "desc" });
    // defaults: exceptions should start sorted by character descending
    setExcSort(id === "exceptions" ? { field: "name", dir: "desc" } : null);
    setScoreDateFilter("");
    setExcInlineEdit(null); setScoreTabInlineEdit(null);
    setCharDetail(null); setUserDetail(null); setPrevContext(null);
    setBackTrail([]);
    setSelUsers(new Set()); setSelChars(new Set()); setSelScores(new Set()); setSelExcs(new Set());
    setDrawer((prev) => ({ ...prev, isOpen: false }));
  };

  const navigateToToolSection = (id: ToolSection) => {
    setActiveToolSection(id);
    setCharDetail(null);
    setUserDetail(null);
    setBackTrail([]);
    if (id === "action-log") {
      refreshActionLog();
      navigate("/admin/action-log");
    } else if (id === "scanner") {
      navigate("/admin/scanner");
    } else if (id === "backups") {
      navigate("/admin/backups");
    }
  };

  // ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //
  // Character detail navigation

  const openCharDetail = (char: CharDetail, fromUser?: UserDetail, fromChar?: CharDetail, fromSection?: "scores" | "exceptions") => {
    pushCurrentToBackTrail();
    if (fromUser) {
      setPrevContext({ type: "user", userId: String(fromUser._id), username: fromUser.username ?? null });
    } else if (fromChar) {
      setPrevContext({ type: "char", charName: fromChar.name });
    } else if (fromSection) {
      setPrevContext({ type: "section", section: fromSection });
    } else {
      setPrevContext(null);
    }
    setCharDetail(char);
    navigate(buildCharPath(char.name));
  };

  const openUserDetail = (user: UserDetail) => {
    pushCurrentToBackTrail();
    setCharDetail(null);
    setPrevContext(null);
    setUserDetail(user);
    setActiveSection("users");
    navigate(`/admin/users/${user._id}`);
  };

  // ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //
  // Drawer / CRUD actions

  const handleSave = async () => {
    const { section, mode, data } = drawer;
    try {
      if (section === "characters" && mode === "edit") {
        const memberSince = toStoredDate(String(data.memberSince ?? ""));
        const originalName = data._originalName ?? data.name;
        await axios.patch(`${BOT_API}/bot/api/admin/characters/${data.userId}/${originalName}`, { name: data.name, memberSince, avatar: data.avatar });
        await refreshUsers();
        notify("success", "Character updated");
      } else if (section === "users" && mode === "edit") {
        await axios.patch(`${BOT_API}/bot/api/admin/users/${data.id}`, { graphColor: data.graphColor });
        await refreshUsers();
        notify("success", "Graph color updated");
      } else if (section === "scores") {
        const validCharacter = liveCharacters.some((c) => c.name === String(data.character));
        if (!validCharacter) return;
        if (mode === "edit") {
          await axios.patch(`${BOT_API}/bot/api/admin/scores/${data.character}/${data.date}`, { score: Number(data.score) });
          notify("success", "Score updated");
        } else {
          await axios.post(`${BOT_API}/bot/api/admin/scores`, { character: data.character, date: data.date, score: Number(data.score) });
          notify("success", "Score created");
        }
        await refreshUsers();
      } else if (section === "exceptions") {
        const validCharacter = liveCharacters.some((c) => c.name === String(data.name));
        if (!validCharacter) return;
        if (mode === "edit") {
          await axios.patch(`${BOT_API}/bot/api/admin/exceptions/${data._id}`, { name: data.name, exception: data.exception });
          notify("success", "Exception updated");
        } else {
          await axios.post(`${BOT_API}/bot/api/admin/exceptions`, { name: data.name, exception: data.exception });
          notify("success", "Exception created");
        }
        await refreshExceptions();
      }
      closeDrawer();
    } catch (e) {
      notifyError(e, "Save failed");
    }
  };

  // ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //
  // Save actions (character / user detail)

  const saveCharEdits = async () => {
    if (!charDetail || !charEditsDirty) return;
    try {
      const memberSince = toStoredDate(charEdits.memberSince);
      await axios.patch(`${BOT_API}/bot/api/admin/characters/${charDetail.userId}/${charDetail.name}`, { name: charDetail.name, memberSince, avatar: charEdits.avatar });
      setCharEditsDirty(false);
      setMemberSinceDirty(false);
      await refreshUsers();
      notify("success", "Profile saved");
    } catch (e) { notifyError(e, "Failed to save profile"); }
  };

  const saveMemberSince = async () => {
    if (!charDetail) return;
    try {
      const memberSince = toStoredDate(charEdits.memberSince);
      await axios.patch(`${BOT_API}/bot/api/admin/characters/${charDetail.userId}/${charDetail.name}`, { name: charDetail.name, memberSince, avatar: charEdits.avatar });
      setMemberSinceDirty(false);
      await refreshUsers();
      notify("success", "Member Since saved");
    } catch (e) { notifyError(e, "Failed to update Member Since"); }
  };

  const saveGraphColor = async () => {
    if (!charDetail) return;
    try {
      const memberSince = toStoredDate(charEdits.memberSince);
      await axios.patch(`${BOT_API}/bot/api/admin/characters/${charDetail.userId}/${encodeURIComponent(charDetail.name)}`, {
        name: charDetail.name,
        memberSince,
        avatar: charEdits.avatar,
        graphColor: charEdits.graphColor,
      });
      setGraphColorDirty(false);
      await refreshUsers();
      notify("success", "Graph Color saved");
    } catch (e) { notifyError(e, "Failed to save graph color"); }
  };

  const renameCharacter = async (newName: string) => {
    if (!renameModal.char) return;
    const { name: oldName, userId } = renameModal.char;
    try {
      const wasViewingRenamedChar = charDetail?.name === oldName && charDetail?.userId === userId;
      await axios.patch(`${BOT_API}/bot/api/admin/characters/${userId}/${encodeURIComponent(oldName)}`, {
        name: newName,
      });
      closeRenameModal();
      await refreshUsers(true);
      notify("success", `Renamed to ${newName}`);

      if (wasViewingRenamedChar) {
        setCharDetail((prev) =>
          prev
            ? { ...prev, name: newName }
            : { ...renameModal.char!, name: newName }
        );
        navigate(buildCharPath(newName), { replace: true });
      }
    } catch (e) { notifyError(e, "Rename failed"); }
  };

  const unlinkCharacter = async () => {
    if (!unlinkModal.char) return;
    const { userId, name } = unlinkModal.char;
    try {
      const liveUser = liveUsers.find((u) => u.id === userId);
      const unlinkUsername = liveUser?.username ?? userId;
      const unlinkParams = new URLSearchParams();
      unlinkParams.set("username", unlinkUsername);
      if (unlinkDeleteSource) {
        unlinkParams.set("deleteSource", "true");
      }
      const unlinkQuery = `?${unlinkParams.toString()}`;
      await axios.delete(
        `${BOT_API}/bot/api/admin/characters/${encodeURIComponent(userId)}/${encodeURIComponent(name)}${unlinkQuery}`
      );
      closeUnlinkModal();
      if (charDetail?.name === name && charDetail?.userId === userId) {
        setCharDetail(null);
        navigate(prevContext?.type === "user" ? `/admin/users/${prevContext.userId}` : "/admin/characters");
      }
      await refreshUsers();
      notify("success", `${name} unlinked`);
    } catch (e) { notifyError(e, "Unlink failed"); }
  };

  const transferCharacter = async () => {
    if (!transferModal.char) return;
    const fromUser = liveUsers.find((u) => u.id === transferModal.char?.userId);
    const toUser = liveUsers.find((u) => u.username === transferToInput);
    if (!toUser) return;
    try {
      const transferredName = transferModal.char.name;
      const transferredFromUserId = transferModal.char.userId;
      const wasViewingTransferredChar =
        charDetail?.name === transferredName &&
        charDetail?.userId === transferredFromUserId;

      await axios.post(`${BOT_API}/bot/api/admin/characters/transfer`, {
        fromUserId: transferModal.char.userId,
        fromUsername: fromUser?.username ?? transferModal.char.userId,
        characterName: transferModal.char.name,
        toUserId: toUser.id,
        toUsername: toUser.username ?? toUser.id,
        deleteSource: transferDeleteSource,
      });
      closeTransferModal();
      await refreshUsers(true);

      if (wasViewingTransferredChar) {
        setCharDetail((prev) =>
          prev && prev.name === transferredName
            ? { ...prev, userId: toUser.id }
            : prev
        );
      }

      notify("success", `${transferModal.char.name} transferred to ${toUser.username ?? toUser.id}`);
    } catch (e) { notifyError(e, "Transfer failed"); }
  };

  // ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //
  // Inline save actions

  const inlineSaveScore = async () => {
    if (!scoreInlineEdit || !charDetail) return;
    const { scoreId, origDate, dateValue, scoreValue } = scoreInlineEdit;
    if (!dateValue.trim() || !scoreValue.trim()) return;
    if (dateValue === origDate && Number(scoreValue) === Number(charDetail.scores.find((s) => s.date === origDate)?.score ?? scoreValue)) {
      return;
    }
    try {
      if (scoreId) {
        await axios.patch(`${BOT_API}/bot/api/admin/scores/by-id/${scoreId}`, {
          score: Number(scoreValue),
          ...(dateValue !== origDate ? { date: dateValue } : {}),
        });
      } else {
        if (dateValue !== origDate) {
          await axios.delete(`${BOT_API}/bot/api/admin/scores/${encodeURIComponent(charDetail.name)}/${origDate}`);
          await axios.post(`${BOT_API}/bot/api/admin/scores`, { character: charDetail.name, date: dateValue, score: Number(scoreValue) });
        } else {
          await axios.patch(`${BOT_API}/bot/api/admin/scores/${encodeURIComponent(charDetail.name)}/${origDate}`, { score: Number(scoreValue) });
        }
      }
      setScoreInlineEdit(null);
      await refreshUsers();
      notify("success", "Score updated");
    } catch (e) { notifyError(e, "Failed to update score"); }
  };

  const inlineSaveScoreTab = async () => {
    if (!scoreTabInlineEdit) return;
    const { scoreId, origCharacter, origDate, dateValue, scoreValue } = scoreTabInlineEdit;
    if (!dateValue.trim() || !scoreValue.trim()) return;
    const existing = liveScores.find((s) => s.character === origCharacter && s.date === origDate);
    if (dateValue === origDate && Number(scoreValue) === Number(existing?.score ?? scoreValue)) {
      return;
    }
    try {
      if (scoreId) {
        await axios.patch(`${BOT_API}/bot/api/admin/scores/by-id/${scoreId}`, {
          score: Number(scoreValue),
          ...(dateValue !== origDate ? { date: dateValue } : {}),
        });
      } else {
        if (dateValue !== origDate) {
          await axios.delete(`${BOT_API}/bot/api/admin/scores/${encodeURIComponent(origCharacter)}/${origDate}`);
          await axios.post(`${BOT_API}/bot/api/admin/scores`, { character: origCharacter, date: dateValue, score: Number(scoreValue) });
        } else {
          await axios.patch(`${BOT_API}/bot/api/admin/scores/${encodeURIComponent(origCharacter)}/${origDate}`, { score: Number(scoreValue) });
        }
      }
      setScoreTabInlineEdit(null);
      await refreshUsers();
      notify("success", "Score updated");
    } catch (e) { notifyError(e, "Failed to update score"); }
  };

  const inlineSaveException = async () => {
    if (!excInlineEdit) return;
    const { id, name, exception } = excInlineEdit;
    const existing = exceptionsData.find((e) => e._id === id);
    if (!name.trim()) {
      notify("error", "Character name is required");
      return;
    }
    if (!liveCharacters.some((c) => c.name === name.trim())) {
      notify("error", "Select a valid character name");
      return;
    }
    if (existing && existing.name === name.trim() && existing.exception === exception) {
      return;
    }
    try {
      await axios.patch(`${BOT_API}/bot/api/admin/exceptions/${id}`, { name, exception });
      setExcInlineEdit(null);
      await refreshExceptions();
      notify("success", "Exception updated");
    } catch (e) { notifyError(e, "Failed to update exception"); }
  };

  // ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //
  // Delete actions

  const deleteCharacter = (userId: string, name: string, label: "unlink" | "delete" = "unlink") =>
    confirm({
      variant: "sensitive",
      confirmWord: label,
      title: <span>{label === "delete" ? "Delete" : "Unlink"} <span className="text-[#A46666]">{name}</span>?</span>,
      description: "This will permanently remove the character and all of their scores. This action cannot be undone.",
      onConfirm: async () => {
        try {
          await axios.delete(`${BOT_API}/bot/api/admin/characters/${userId}/${name}`);
          await refreshUsers();
          if (charDetail?.name === name && charDetail?.userId === userId) {
            setCharDetail(null);
            navigate(prevContext?.type === "user" ? `/admin/users/${prevContext.userId}` : "/admin/characters");
          }
          notify("success", `${name} ${label === "delete" ? "deleted" : "unlinked"}`);
        } catch (e) { notifyError(e, "Delete failed"); }
        closeModal();
      },
    });

  const deleteUser = (userId: string, username?: string | null) =>
    confirm({
      variant: "sensitive",
      title: <span>Delete <span className="text-[#A46666]">{username ?? userId}</span>?</span>,
      description: "This will permanently remove the user and all of their linked characters and scores. This action cannot be undone.",
      onConfirm: async () => {
        try {
          await axios.delete(`${BOT_API}/bot/api/admin/users/${userId}`, {
            params: { username: username ?? undefined },
          });
          await refreshUsers();
          setUserDetail(null);
          setCharDetail(null);
          navigate("/admin/users");
          notify("success", `${username ?? "User"} deleted`);
        } catch (e) { notifyError(e, "Delete failed"); }
        closeModal();
      },
    });

  const deleteScore = (character: string, date: string, scoreId?: string) =>
    confirm({
      variant: "confirm",
      confirmDanger: true,
      title: "Delete score",
      description: `Delete the score for ${character} on ${date}? This cannot be undone.`,
      onConfirm: async () => {
        try {
          if (scoreId) {
            await axios.delete(`${BOT_API}/bot/api/admin/scores/by-id/${scoreId}`);
          } else {
            await axios.delete(`${BOT_API}/bot/api/admin/scores/${character}/${date}`);
          }
          await refreshUsers();
          notify("success", "Score deleted");
        } catch (e) { notifyError(e, "Delete failed"); }
        closeModal();
      },
    });

  const deleteException = (id: string, name: string) =>
    confirm({
      variant: "confirm",
      confirmDanger: true,
      title: "Delete exception",
      description: `Delete the exception for ${name}?`,
      onConfirm: async () => {
        try {
          await axios.delete(`${BOT_API}/bot/api/admin/exceptions/${id}`);
          await refreshExceptions();
          notify("success", `Exception for ${name} deleted`);
        } catch (e) { notifyError(e, "Delete failed"); }
        closeModal();
      },
    });

  // ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //
  // Batch delete actions

  const batchDeleteDetailScores = () =>
    confirm({
      variant: "confirm",
      confirmDanger: true,
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
          notify("success", `${selDetailScores.size} score${selDetailScores.size !== 1 ? "s" : ""} deleted`);
        } catch (e) { notifyError(e, "Batch delete failed"); }
        closeModal();
      },
    });

  const batchDeleteUserDetailChars = () => openBatchUnlinkModal("user-detail");

  const batchDeleteUsers = () =>
    confirm({
      variant: "sensitive",
      title: `Delete ${selUsers.size} user${selUsers.size > 1 ? "s" : ""}`,
      description: "This will permanently remove the selected users and all of their linked characters and scores.",
      onConfirm: async () => {
        try {
          await Promise.all(
            [...selUsers].map((id) => {
              const selectedUser = liveUsers.find((u) => u.id === id);
              return axios.delete(`${BOT_API}/bot/api/admin/users/${id}`, {
                params: { username: selectedUser?.username ?? undefined },
              });
            })
          );
          setSelUsers(new Set());
          await refreshUsers();
          notify("success", `${selUsers.size} user${selUsers.size !== 1 ? "s" : ""} deleted`);
        } catch (e) { notifyError(e, "Batch delete failed"); }
        closeModal();
      },
    });

  const batchDeleteChars = () => openBatchUnlinkModal("characters-tab");

  const confirmBatchUnlink = async () => {
    try {
      if (batchUnlinkModal.target === "user-detail") {
        const uid = userDetail!._id;
        const liveUser = liveUsers.find((u) => u.id === uid);
        await axios.delete(`${BOT_API}/bot/api/admin/characters/batch`, {
          data: {
            userId: uid,
            names: [...selUserDetailChars],
            deleteSource: batchUnlinkDeleteSource,
            username: liveUser?.username ?? uid,
          },
        });
        setSelUserDetailChars(new Set());
        if (batchUnlinkDeleteSource) {
          setUserDetail(null);
          navigate("/admin/users");
        }
        await refreshUsers();
        notify("success", `${selUserDetailChars.size} character${selUserDetailChars.size !== 1 ? "s" : ""} unlinked`);
      } else {
        // Group selected chars by userId (key format: "userId|charName")
        const byUser = new Map<string, string[]>();
        for (const key of selChars) {
          const idx = key.indexOf("|");
          if (idx === -1) continue;
          const uid = key.slice(0, idx);
          const name = key.slice(idx + 1);
          if (!byUser.has(uid)) byUser.set(uid, []);
          byUser.get(uid)!.push(name);
        }
        const totalCount = selChars.size;
        await Promise.all(
          [...byUser.entries()].map(([uid, names]) => {
            const liveUser = liveUsers.find((u) => u.id === uid);
            return axios.delete(`${BOT_API}/bot/api/admin/characters/batch`, {
              data: {
                userId: uid,
                names,
                deleteSource: batchUnlinkDeleteSource,
                username: liveUser?.username ?? uid,
              },
            });
          })
        );
        setSelChars(new Set());
        await refreshUsers();
        notify("success", `${totalCount} character${totalCount !== 1 ? "s" : ""} unlinked`);
      }
    } catch (e) { notifyError(e, "Batch unlink failed"); }
    closeBatchUnlinkModal();
  };

  const batchDeleteScores = () =>
    confirm({
      variant: "confirm",
      confirmDanger: true,
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
          notify("success", `${selScores.size} score${selScores.size !== 1 ? "s" : ""} deleted`);
        } catch (e) { notifyError(e, "Batch delete failed"); }
        closeModal();
      },
    });

  const batchDeleteExcs = () =>
    confirm({
      variant: "confirm",
      confirmDanger: true,
      title: `Delete ${selExcs.size} exception${selExcs.size > 1 ? "s" : ""}`,
      description: "This will permanently remove the selected exceptions.",
      onConfirm: async () => {
        try {
          await Promise.all([...selExcs].map((id) => axios.delete(`${BOT_API}/bot/api/admin/exceptions/${id}`)));
          setSelExcs(new Set());
          await refreshExceptions();
          notify("success", `${selExcs.size} exception${selExcs.size !== 1 ? "s" : ""} deleted`);
        } catch (e) { notifyError(e, "Batch delete failed"); }
        closeModal();
      },
    });

  // ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

  const navItems: Array<{ id: Section; label: string; icon: React.ElementType }> = [
    { id: "users",      label: "Users",      icon: FaUsers },
    { id: "characters", label: "Characters", icon: FaUserAlt },
    { id: "scores",     label: "Scores",     icon: FaChartBar },
    { id: "exceptions", label: "Exceptions", icon: FaExclamationCircle },
  ];

  const monitoringItems: Array<{ id: ToolSection; label: string; icon: React.ElementType }> = [
    { id: "action-log", label: "Action Log", icon: FaHistory },
    { id: "backups",    label: "Backups",    icon: FaArchive },
  ];

  const toolItems: Array<{ id: ToolSection; label: string; icon: React.ElementType }> = [
    { id: "scanner", label: "Culvert Scanner", icon: FaCamera },
  ];

  // ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

  const value: AdminContextValue = {
    activeSection, navigateToSection, backTrail, backTargetLabel, goBackFromTrail,
    userData, usersLoading, exceptionsData, exceptionsLoading,
    liveUsers, liveCharacters, liveScores,
    userSearch, setUserSearch, userPage, setUserPage, userSort, setUserSort,
    filteredUsers, pagedUsers, userPageCount, selUsers, setSelUsers,
    charSearch, setCharSearch, charPage, setCharPage, charSort, setCharSort,
    filteredChars, pagedChars, charPageCount, selChars, setSelChars,
    scoreSearch, setScoreSearch, scoreDateFilter, setScoreDateFilter,
    scorePage, setScorePage, scoreSort, setScoreSort,
    filteredScores, pagedScores, scorePageCount, selScores, setSelScores,
    scoreTabInlineEdit, setScoreTabInlineEdit,
    excSearch, setExcSearch, excPage, setExcPage, excSort, setExcSort,
    filteredExceptions, pagedExcs, excPageCount, selExcs, setSelExcs,
    excInlineEdit, setExcInlineEdit,
    charDetail, setCharDetail, userDetail, setUserDetail,
    prevContext, setPrevContext, openCharDetail, openUserDetail,
    userMemberData, userDetailCharSort, setUserDetailCharSort,
    selUserDetailChars, setSelUserDetailChars,
    charEdits, setCharEdits, charEditsDirty, setCharEditsDirty,
    memberSinceDirty, setMemberSinceDirty, graphColorDirty, setGraphColorDirty,
    detailScoreSort, setDetailScoreSort, detailScorePage, setDetailScorePage,
    detailDateFrom, setDetailDateFrom, detailDateTo, setDetailDateTo,
    charApiData, charApiDataFor, charApiLoading, charApiError, ownerData,
    scoreInlineEdit, setScoreInlineEdit, selDetailScores, setSelDetailScores,
    drawer, setDrawer, openCreate, closeDrawer, updateField, handleSave,
    modal, closeModal, confirm,
    transferModal, setTransferModal, transferToInput, setTransferToInput,
    transferDeleteSource, setTransferDeleteSource, closeTransferModal, transferCharacter,
    renameModal, setRenameModal, closeRenameModal, renameCharacter,
    unlinkModal, setUnlinkModal, unlinkDeleteSource, setUnlinkDeleteSource, closeUnlinkModal, unlinkCharacter,
    batchUnlinkModal, batchUnlinkDeleteSource, setBatchUnlinkDeleteSource,
    openBatchUnlinkModal, closeBatchUnlinkModal, confirmBatchUnlink,
    refreshUsers, refreshExceptions, refreshActionLog, refreshAllData,
    saveCharEdits, saveMemberSince, saveGraphColor,
    deleteCharacter, deleteUser, deleteScore, deleteException,
    inlineSaveScore, inlineSaveScoreTab, inlineSaveException,
    batchDeleteDetailScores, batchDeleteUserDetailChars,
    batchDeleteUsers, batchDeleteChars, batchDeleteScores, batchDeleteExcs,
    toggleSel, toggleAll, toggleSort,
    navItems, monitoringItems, toolItems, activeToolSection, navigateToToolSection,
    actionLog, clearActionLog,
  };

  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
};
