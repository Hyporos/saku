import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import { useNavigate, useMatch, useLocation } from "react-router-dom";
import axios from "axios";
import {
  FaUsers,
  FaUserAlt,
  FaChartBar,
  FaExclamationCircle,
} from "react-icons/fa";
import {
  BOT_API,
} from "./constants";
import { toStoredDate, charSlug } from "./utils";
import { useDataFetching } from "./hooks/useDataFetching";
import { useTabState } from "./hooks/useTabState";
import { useDetailState } from "./hooks/useDetailState";
import { useModals } from "./hooks/useModals";
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
} from "./types";

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

type SetState<T> = React.Dispatch<React.SetStateAction<T>>;

interface AdminContextValue {
  // Navigation
  activeSection: Section;
  navigateToSection: (id: Section) => void;

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
  openCharDetail: (char: CharDetail, fromUser?: UserDetail, fromChar?: CharDetail) => void;

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
  detailScoreSort: SortState;
  setDetailScoreSort: SetState<SortState>;
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

  // Data refresh
  refreshUsers: () => Promise<void>;
  refreshExceptions: () => Promise<void>;

  // Save actions
  saveCharEdits: () => Promise<void>;
  saveMemberSince: () => Promise<void>;
  saveGraphColor: () => Promise<void>;

  // Delete / mutation actions
  deleteCharacter: (userId: string, name: string) => void;
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
  const initializedCharFromUrl = useRef(false);
  const initializedUserFromUrl = useRef(false);

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
  } = useModals();

  // ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //
  // Effects

  // Load data when active section changes
  useEffect(() => {
    if (activeSection === "users" || activeSection === "characters" || activeSection === "scores") {
      refreshUsers();
    }
    if (activeSection === "exceptions") refreshExceptions();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSection]);

  // Restore character detail from URL slug on initial load
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userData, usersLoading, urlCharName]);

  // Restore user detail from URL on initial load
  useEffect(() => {
    if (!urlUserId || initializedUserFromUrl.current || usersLoading || userData.length === 0) return;
    const found = userData.find((u) => String(u._id) === urlUserId);
    if (found) {
      setUserDetail(found);
      setActiveSection("users");
      initializedUserFromUrl.current = true;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userData, usersLoading, urlUserId]);

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
    navigate(paths[id]);
    setUserSearch(""); setCharSearch(""); setScoreSearch(""); setExcSearch("");
    setUserPage(1); setCharPage(1); setScorePage(1); setExcPage(1);
    setUserSort(null); setCharSort(null); setScoreSort(null); setExcSort(null);
    setScoreDateFilter("");
    setExcInlineEdit(null); setScoreTabInlineEdit(null);
    setCharDetail(null); setUserDetail(null); setPrevContext(null);
    setSelUsers(new Set()); setSelChars(new Set()); setSelScores(new Set()); setSelExcs(new Set());
    setDrawer((prev) => ({ ...prev, isOpen: false }));
  };

  // ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //
  // Character detail navigation

  const openCharDetail = (char: CharDetail, fromUser?: UserDetail, fromChar?: CharDetail) => {
    if (fromUser) {
      setPrevContext({ type: "user", userId: String(fromUser._id), username: fromUser.username ?? null });
    } else if (fromChar) {
      setPrevContext({ type: "char", charName: fromChar.name });
    } else {
      setPrevContext(null);
    }
    setCharDetail(char);
    const allFlat = userData.flatMap((u) => u.characters.map((c) => ({ name: c.name, userId: String(u._id) })));
    navigate(`/admin/characters/${encodeURIComponent(charSlug(char.name, allFlat))}`);
  };

  // ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //
  // Drawer / CRUD actions

  const handleSave = async () => {
    const { section, mode, data } = drawer;
    try {
      if (section === "characters") {
        const memberSince = toStoredDate(String(data.memberSince ?? ""));
        if (mode === "edit") {
          const originalName = data._originalName ?? data.name;
          await axios.patch(`${BOT_API}/bot/api/admin/characters/${data.userId}/${originalName}`, { name: data.name, memberSince, avatar: data.avatar });
        } else {
          await axios.post(`${BOT_API}/bot/api/admin/characters`, { userId: data.userId, name: data.name, memberSince, avatar: data.avatar ?? "" });
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

  // ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //
  // Save actions (character / user detail)

  const saveCharEdits = async () => {
    if (!charDetail || !charEditsDirty) return;
    const memberSince = toStoredDate(charEdits.memberSince);
    await axios.patch(`${BOT_API}/bot/api/admin/characters/${charDetail.userId}/${charDetail.name}`, { name: charDetail.name, memberSince, avatar: charEdits.avatar });
    setCharEditsDirty(false);
    setMemberSinceDirty(false);
    await refreshUsers();
  };

  const saveMemberSince = async () => {
    if (!charDetail) return;
    const memberSince = toStoredDate(charEdits.memberSince);
    await axios.patch(`${BOT_API}/bot/api/admin/characters/${charDetail.userId}/${charDetail.name}`, { name: charDetail.name, memberSince, avatar: charEdits.avatar });
    setMemberSinceDirty(false);
    await refreshUsers();
  };

  const saveGraphColor = async () => {
    if (!charDetail) return;
    await axios.patch(`${BOT_API}/bot/api/admin/users/${charDetail.userId}`, { graphColor: charEdits.graphColor });
    setGraphColorDirty(false);
    await refreshUsers();
  };

  const transferCharacter = async () => {
    if (!transferModal.char) return;
    const toUser = liveUsers.find((u) => u.username === transferToInput);
    if (!toUser) return;
    await axios.post(`${BOT_API}/bot/api/admin/characters/transfer`, {
      fromUserId: transferModal.char.userId,
      characterName: transferModal.char.name,
      toUserId: toUser.id,
      deleteSource: transferDeleteSource,
    });
    closeTransferModal();
    setCharDetail(null);
    navigate("/admin/characters");
    await refreshUsers();
  };

  // ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //
  // Inline save actions

  const inlineSaveScore = async () => {
    if (!scoreInlineEdit || !charDetail) return;
    const { scoreId, origDate, dateValue, scoreValue } = scoreInlineEdit;
    if (!dateValue.trim() || !scoreValue.trim()) return;
    try {
      if (dateValue !== origDate) {
        if (scoreId) {
          await axios.delete(`${BOT_API}/bot/api/admin/scores/by-id/${scoreId}`);
        } else {
          await axios.delete(`${BOT_API}/bot/api/admin/scores/${encodeURIComponent(charDetail.name)}/${origDate}`);
        }
        await axios.post(`${BOT_API}/bot/api/admin/scores`, { character: charDetail.name, date: dateValue, score: Number(scoreValue) });
      } else if (scoreId) {
        await axios.patch(`${BOT_API}/bot/api/admin/scores/by-id/${scoreId}`, { score: Number(scoreValue) });
      } else {
        await axios.patch(`${BOT_API}/bot/api/admin/scores/${encodeURIComponent(charDetail.name)}/${origDate}`, { score: Number(scoreValue) });
      }
      setScoreInlineEdit(null);
      await refreshUsers();
    } catch (e) { console.error("Inline save failed:", e); }
  };

  const inlineSaveScoreTab = async () => {
    if (!scoreTabInlineEdit) return;
    const { scoreId, origCharacter, origDate, dateValue, scoreValue } = scoreTabInlineEdit;
    if (!dateValue.trim() || !scoreValue.trim()) return;
    try {
      if (dateValue !== origDate) {
        if (scoreId) {
          await axios.delete(`${BOT_API}/bot/api/admin/scores/by-id/${scoreId}`);
        } else {
          await axios.delete(`${BOT_API}/bot/api/admin/scores/${encodeURIComponent(origCharacter)}/${origDate}`);
        }
        await axios.post(`${BOT_API}/bot/api/admin/scores`, { character: origCharacter, date: dateValue, score: Number(scoreValue) });
      } else if (scoreId) {
        await axios.patch(`${BOT_API}/bot/api/admin/scores/by-id/${scoreId}`, { score: Number(scoreValue) });
      } else {
        await axios.patch(`${BOT_API}/bot/api/admin/scores/${encodeURIComponent(origCharacter)}/${origDate}`, { score: Number(scoreValue) });
      }
      setScoreTabInlineEdit(null);
      await refreshUsers();
    } catch (e) { console.error("Inline save failed:", e); }
  };

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

  // ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //
  // Delete actions

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

  const deleteScore = (character: string, date: string, scoreId?: string) =>
    confirm({
      variant: "confirm",
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
        } catch (e) { console.error("Delete failed:", e); }
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

  // ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //
  // Batch delete actions

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

  // ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

  const navItems: Array<{ id: Section; label: string; icon: React.ElementType }> = [
    { id: "users",      label: "Users",      icon: FaUsers },
    { id: "characters", label: "Characters", icon: FaUserAlt },
    { id: "scores",     label: "Scores",     icon: FaChartBar },
    { id: "exceptions", label: "Exceptions", icon: FaExclamationCircle },
  ];

  // ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

  const value: AdminContextValue = {
    activeSection, navigateToSection,
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
    prevContext, setPrevContext, openCharDetail,
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
    refreshUsers, refreshExceptions,
    saveCharEdits, saveMemberSince, saveGraphColor,
    deleteCharacter, deleteUser, deleteScore, deleteException,
    inlineSaveScore, inlineSaveScoreTab, inlineSaveException,
    batchDeleteDetailScores, batchDeleteUserDetailChars,
    batchDeleteUsers, batchDeleteChars, batchDeleteScores, batchDeleteExcs,
    toggleSel, toggleAll, toggleSort,
    navItems,
  };

  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
};
