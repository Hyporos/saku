import { useState } from "react";
import dayjs from "dayjs";
import { PAGE_SIZE, DATE_SORT_FIELDS } from "../constants";
import { normalizeCharName } from "../utils";
import type {
  CharDetail,
  ExceptionDoc,
  LiveScore,
  LiveUser,
  SortState,
  ScoreTabInlineEditState,
  ExcInlineEditState,
} from "../types";

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

interface TabStateInput {
  liveUsers: LiveUser[];
  liveCharacters: CharDetail[];
  liveScores: LiveScore[];
  exceptionsData: ExceptionDoc[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applySortAndPage<T extends Record<string, any>>(
  items: T[],
  sort: SortState | null,
  page: number
) {
  const sorted = sort
    ? [...items].sort((a, b) => {
        const av = a[sort.field] ?? "";
        const bv = b[sort.field] ?? "";
        const cmp = DATE_SORT_FIELDS.has(sort.field)
          ? dayjs(av as string).valueOf() - dayjs(bv as string).valueOf()
          : typeof av === "number" && typeof bv === "number"
            ? av - bv
            : String(av) < String(bv) ? -1 : String(av) > String(bv) ? 1 : 0;
        return sort.dir === "asc" ? cmp : -cmp;
      })
    : items;
  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const paged = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  return { sorted, pageCount, paged };
}

/**
 * Owns all five tabs' search / sort / page / selection / inline-edit state,
 * plus the derived filtered and paginated views for each tab.
 */
export function useTabState({
  liveUsers, liveCharacters, liveScores, exceptionsData,
}: TabStateInput) {

  // ⎯⎯ Users tab ⎯⎯ //
  const [userSearch, setUserSearch] = useState("");
  const [userPage, setUserPage] = useState(1);
  const [userSort, setUserSort] = useState<SortState | null>({ field: "username", dir: "asc" });
  const [selUsers, setSelUsers] = useState<Set<string>>(new Set());

  // ⎯⎯ Characters tab ⎯⎯ //
  const [charSearch, setCharSearch] = useState("");
  const [charPage, setCharPage] = useState(1);
  const [charSort, setCharSort] = useState<SortState | null>({ field: "memberSince", dir: "desc" });
  const [selChars, setSelChars] = useState<Set<string>>(new Set());

  // ⎯⎯ Scores tab ⎯⎯ //
  const [scoreSearch, setScoreSearch] = useState("");
  const [scoreDateFilter, setScoreDateFilter] = useState("");
  const [scorePage, setScorePage] = useState(1);
  const [scoreSort, setScoreSort] = useState<SortState | null>({ field: "date", dir: "desc" });
  const [selScores, setSelScores] = useState<Set<string>>(new Set());
  const [scoreTabInlineEdit, setScoreTabInlineEdit] = useState<ScoreTabInlineEditState | null>(null);

  // ⎯⎯ Exceptions tab ⎯⎯ //
  const [excSearch, setExcSearch] = useState("");
  const [excPage, setExcPage] = useState(1);
  // exceptions default to character name descending (A → Z)
  const [excSort, setExcSort] = useState<SortState | null>({ field: "name", dir: "desc" });
  const [selExcs, setSelExcs] = useState<Set<string>>(new Set());
  const [excInlineEdit, setExcInlineEdit] = useState<ExcInlineEditState | null>(null);

  // ⎯⎯ Derived filtered + paginated views ⎯⎯ //

  const filteredUsers = liveUsers.filter((u) =>
    normalizeCharName(u.id).toLowerCase().includes(normalizeCharName(userSearch).toLowerCase()) ||
    normalizeCharName(u.username ?? "").toLowerCase().includes(normalizeCharName(userSearch).toLowerCase())
  );
  const { pageCount: userPageCount, paged: pagedUsers } = applySortAndPage(filteredUsers, userSort, userPage);

  const filteredChars = liveCharacters.filter(
    (c) =>
      normalizeCharName(c.name).toLowerCase().includes(normalizeCharName(charSearch).toLowerCase()) ||
      String(c.userId).toLowerCase().includes(charSearch.toLowerCase())
  );
  const { pageCount: charPageCount, paged: pagedChars } = applySortAndPage(filteredChars, charSort, charPage);

  const filteredScores = liveScores.filter(
    (s) =>
      normalizeCharName(s.character).toLowerCase().includes(normalizeCharName(scoreSearch).toLowerCase()) &&
      (!scoreDateFilter || s.date === scoreDateFilter)
  );
  const { pageCount: scorePageCount, paged: pagedScores } = applySortAndPage(filteredScores, scoreSort, scorePage);

  const filteredExceptions = [...exceptionsData].filter(
    (e) =>
      normalizeCharName(e.name).toLowerCase().includes(normalizeCharName(excSearch).toLowerCase()) ||
      normalizeCharName(e.exception).toLowerCase().includes(normalizeCharName(excSearch).toLowerCase())
  );
  const { pageCount: excPageCount, paged: pagedExcs } = applySortAndPage(filteredExceptions, excSort, excPage);

  return {
    // Users
    userSearch, setUserSearch, userPage, setUserPage, userSort, setUserSort,
    filteredUsers, pagedUsers, userPageCount, selUsers, setSelUsers,
    // Characters
    charSearch, setCharSearch, charPage, setCharPage, charSort, setCharSort,
    filteredChars, pagedChars, charPageCount, selChars, setSelChars,
    // Scores
    scoreSearch, setScoreSearch, scoreDateFilter, setScoreDateFilter,
    scorePage, setScorePage, scoreSort, setScoreSort,
    filteredScores, pagedScores, scorePageCount, selScores, setSelScores,
    scoreTabInlineEdit, setScoreTabInlineEdit,
    // Exceptions
    excSearch, setExcSearch, excPage, setExcPage, excSort, setExcSort,
    filteredExceptions, pagedExcs, excPageCount, selExcs, setSelExcs,
    excInlineEdit, setExcInlineEdit,
  };
}
