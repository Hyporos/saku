import { useState } from "react";
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
  const [userData, setUserData] = useState<UserDoc[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [exceptionsData, setExceptionsData] = useState<ExceptionDoc[]>([]);
  const [exceptionsLoading, setExceptionsLoading] = useState(false);

  const refreshUsers = (): Promise<void> => {
    setUsersLoading(true);
    return axios
      .get<UserDoc[]>(`${BOT_API}/bot/api/admin/users`)
      .then((res) => setUserData(Array.isArray(res.data) ? res.data : []))
      .catch(console.error)
      .finally(() => setUsersLoading(false)) as Promise<void>;
  };

  const refreshExceptions = (): Promise<void> => {
    setExceptionsLoading(true);
    return axios
      .get<ExceptionDoc[]>(`${BOT_API}/bot/api/admin/exceptions`)
      .then((res) => setExceptionsData(Array.isArray(res.data) ? res.data : []))
      .catch(console.error)
      .finally(() => setExceptionsLoading(false)) as Promise<void>;
  };

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
