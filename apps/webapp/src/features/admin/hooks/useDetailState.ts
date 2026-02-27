import { useState, useEffect } from "react";
import axios from "axios";
import { BOT_API } from "../constants";
import { toInputDate } from "../utils";
import type {
  CharDetail,
  CharEdits,
  CharApiData,
  OwnerData,
  UserMemberData,
  ScoreInlineEditState,
  SortState,
  UserDoc,
  UserDetail,
  PrevContext,
} from "../types";

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

interface DetailStateInput {
  userData: UserDoc[];
}

/**
 * Owns all character detail and user detail state, including inline editing,
 * score view, and live API data fetched from the MapleStory rankings endpoint.
 * Effects here are scoped to detail-level concerns only (fetching, syncing, resetting).
 */
export function useDetailState({ userData }: DetailStateInput) {
  // ⎯⎯ Detail drill-down ⎯⎯ //
  const [charDetail, setCharDetail] = useState<CharDetail | null>(null);
  const [userDetail, setUserDetail] = useState<UserDetail | null>(null);
  const [prevContext, setPrevContext] = useState<PrevContext | null>(null);

  // ⎯⎯ User detail ⎯⎯ //
  const [userMemberData, setUserMemberData] = useState<UserMemberData | null>(null);
  const [userDetailCharSort, setUserDetailCharSort] = useState<SortState | null>(null);
  const [selUserDetailChars, setSelUserDetailChars] = useState<Set<string>>(new Set());

  // ⎯⎯ Character detail — inline edits ⎯⎯ //
  const [charEdits, setCharEdits] = useState<CharEdits>({ memberSince: "", avatar: "", graphColor: "" });
  const [charEditsDirty, setCharEditsDirty] = useState(false);
  const [memberSinceDirty, setMemberSinceDirty] = useState(false);
  const [graphColorDirty, setGraphColorDirty] = useState(false);

  // ⎯⎯ Character detail — score view ⎯⎯ //
  const [detailScoreSort, setDetailScoreSort] = useState<SortState | null>({ field: "date", dir: "desc" });
  const [detailScorePage, setDetailScorePage] = useState(1);
  const [detailDateFrom, setDetailDateFrom] = useState("");
  const [detailDateTo, setDetailDateTo] = useState("");
  const [charApiData, setCharApiData] = useState<CharApiData | null>(null);
  const [charApiDataFor, setCharApiDataFor] = useState<string>("");
  const [charApiLoading, setCharApiLoading] = useState(false);
  const [charApiError, setCharApiError] = useState(false);
  const [ownerData, setOwnerData] = useState<OwnerData | null>(null);
  const [scoreInlineEdit, setScoreInlineEdit] = useState<ScoreInlineEditState | null>(null);
  const [selDetailScores, setSelDetailScores] = useState<Set<string>>(new Set());

  // ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //
  // Effects

  // Keep detail views in sync after data refresh
  useEffect(() => {
    if (charDetail) {
      const owner = userData.find((u) => u._id === charDetail.userId);
      const updated = owner?.characters.find((c) => c.name === charDetail.name);
      if (updated) {
        const participated = updated.scores.filter((s) => s.score > 0).length;
        const total = updated.scores.length;
        setCharDetail({
          ...updated,
          userId: charDetail.userId,
          scoreCount: total,
          participationRate: total > 0 ? Math.round((participated / total) * 100) : 0,
        });
      }
    }
    if (userDetail) {
      const updated = userData.find((u) => u._id === userDetail._id);
      if (updated) setUserDetail(updated);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userData]);

  // Reset inline edits and score view when switching characters
  useEffect(() => {
    if (charDetail) {
      setCharEdits({
        memberSince: toInputDate(charDetail.memberSince),
        avatar: charDetail.avatar ?? "",
        graphColor: charDetail.graphColor ?? "255,189,213",
      });
      setCharEditsDirty(false);
      setMemberSinceDirty(false);
      setGraphColorDirty(false);
    }
    setDetailScoreSort({ field: "date", dir: "desc" });
    setDetailScorePage(1);
    setDetailDateFrom("");
    setDetailDateTo("");
    setScoreInlineEdit(null);
    setSelDetailScores(new Set());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [charDetail?.name, charDetail?.userId]);

  // Reset user detail selection when switching users
  useEffect(() => {
    if (userDetail) {
      setUserDetailCharSort(null);
      setSelUserDetailChars(new Set());
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userDetail?._id]);

  // Fetch Discord member data when user detail opens
  useEffect(() => {
    if (!userDetail) { setUserMemberData(null); return; }
    axios
      .get(`${BOT_API}/bot/api/admin/member/${encodeURIComponent(userDetail._id)}`)
      .then((res) => setUserMemberData(res.data))
      .catch(() => setUserMemberData(null));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userDetail?._id]);

  // Fetch MapleStory rankings data when character detail opens
  useEffect(() => {
    if (!charDetail) {
      setCharApiData(null);
      setCharApiDataFor("");
      setCharApiError(false);
      return;
    }
    const targetName = charDetail.name;
    setCharApiLoading(true);
    setCharApiError(false);
    axios
      .get(`${BOT_API}/bot/api/rankings/${encodeURIComponent(targetName)}`)
      .then((res) => { setCharApiData(res.data); setCharApiDataFor(targetName); })
      .catch(() => setCharApiError(true))
      .finally(() => setCharApiLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [charDetail?.name]);

  // Resolve character owner — check userData cache first, then fetch
  useEffect(() => {
    if (!charDetail) { setOwnerData(null); return; }
    const cached = userData.find((u) => String(u._id) === String(charDetail.userId));
    if (cached) {
      setOwnerData({
        _id: String(cached._id),
        username: cached.username ?? null,
        nickname: cached.nickname ?? null,
        avatarUrl: cached.avatarUrl ?? null,
      });
      return;
    }
    axios
      .get(`${BOT_API}/bot/api/admin/member/${encodeURIComponent(charDetail.userId)}`)
      .then((res) => setOwnerData(res.data))
      .catch(console.error);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [charDetail?.userId]);

  return {
    charDetail, setCharDetail,
    userDetail, setUserDetail,
    prevContext, setPrevContext,
    userMemberData, userDetailCharSort, setUserDetailCharSort,
    selUserDetailChars, setSelUserDetailChars,
    charEdits, setCharEdits, charEditsDirty, setCharEditsDirty,
    memberSinceDirty, setMemberSinceDirty, graphColorDirty, setGraphColorDirty,
    detailScoreSort, setDetailScoreSort, detailScorePage, setDetailScorePage,
    detailDateFrom, setDetailDateFrom, detailDateTo, setDetailDateTo,
    charApiData, charApiDataFor, charApiLoading, charApiError, ownerData,
    scoreInlineEdit, setScoreInlineEdit, selDetailScores, setSelDetailScores,
  };
}
