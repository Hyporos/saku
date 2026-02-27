import { useCallback, useState } from "react";
import axios from "axios";
import { BOT_API } from "../constants";
import type { UserDoc, ExceptionDoc, CharDetail, LiveUser, LiveScore } from "../types";

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

/**
 * Owns raw MongoDB data (users, exceptions, events), loading states, refresh functions,
 * and the three derived flat views (liveUsers, liveCharacters, liveScores) that power
 * every other tab.
 */
export function useDataFetching() {
  const usersCacheKey = "admin_users_cache_v1";
  const exceptionsCacheKey = "admin_exceptions_cache_v1";

  const readCache = <T,>(key: string): T | null => {
    try {
      const raw = sessionStorage.getItem(key);
      if (!raw) return null;
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  };

  const writeCache = <T,>(key: string, value: T) => {
    try {
      sessionStorage.setItem(key, JSON.stringify(value));
    } catch {
      // ignore cache write failures
    }
  };

  const [userData, setUserData] = useState<UserDoc[]>(() => readCache<UserDoc[]>(usersCacheKey) ?? []);
  const [usersLoading, setUsersLoading] = useState(false);
  const [exceptionsData, setExceptionsData] = useState<ExceptionDoc[]>(() => readCache<ExceptionDoc[]>(exceptionsCacheKey) ?? []);
  const [exceptionsLoading, setExceptionsLoading] = useState(false);

  const refreshUsers = useCallback((force = true): Promise<void> => {
    if (!force && userData.length > 0) return Promise.resolve();
    setUsersLoading(true);
    return axios
      .get<UserDoc[]>(`${BOT_API}/bot/api/admin/users`)
      .then((res) => {
        const next = Array.isArray(res.data) ? res.data : [];
        setUserData(next);
        writeCache(usersCacheKey, next);
      })
      .catch(console.error)
      .finally(() => setUsersLoading(false)) as Promise<void>;
  }, [userData]);

  const refreshExceptions = useCallback((force = true): Promise<void> => {
    if (!force && exceptionsData.length > 0) return Promise.resolve();
    setExceptionsLoading(true);
    return axios
      .get<ExceptionDoc[]>(`${BOT_API}/bot/api/admin/exceptions`)
      .then((res) => {
        const next = Array.isArray(res.data) ? res.data : [];
        setExceptionsData(next);
        writeCache(exceptionsCacheKey, next);
      })
      .catch(console.error)
      .finally(() => setExceptionsLoading(false)) as Promise<void>;
  }, [exceptionsData]);

  // ⎯⎯ Derived flat views ⎯⎯ //

  const liveUsers: LiveUser[] = userData.map((u) => ({
    id: u._id,
    graphColor: u.graphColor,
    characterCount: u.characters.length,
    username: u.username ?? null,
    nickname: u.nickname ?? null,
    role: u.role ?? null,
  }));

  const liveCharacters: CharDetail[] = userData.flatMap((u) =>
    u.characters.map((c) => {
      const participated = c.scores.filter((s) => s.score > 0).length;
      const total = c.scores.length;
      return {
        ...c,
        userId: u._id,
        scoreCount: total,
        participationRate: total > 0 ? Math.round((participated / total) * 100) : 0,
      };
    })
  );

  const liveScores: LiveScore[] = liveCharacters
    .flatMap((c) =>
      c.scores.map((s) => ({
        _id: s._id,
        character: c.name,
        userId: c.userId,
        date: s.date,
        score: s.score,
      }))
    )
    .sort((a, b) => b.date.localeCompare(a.date));

  return {
    userData, setUserData, usersLoading,
    exceptionsData, exceptionsLoading,
    refreshUsers, refreshExceptions,
    liveUsers, liveCharacters, liveScores,
  };
}
