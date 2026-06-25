import { useState, useCallback, useEffect } from "react";
import axios from "axios";
import { BOT_API } from "../constants";
import type { ActionLogEntry } from "../types";

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

const MAX_ENTRIES = 500;

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

export const useActionLog = () => {
  const [actionLog, setActionLog] = useState<ActionLogEntry[]>([]);

  const refreshActionLog = useCallback(async () => {
    try {
      const res = await axios.get<ActionLogEntry[]>(`${BOT_API}/bot/api/admin/action-log`, {
        params: { limit: MAX_ENTRIES },
      });
      setActionLog(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      console.error("Failed to fetch action log:", error);
    }
  }, []);

  useEffect(() => {
    refreshActionLog();
  }, [refreshActionLog]);

  const clearActionLog = useCallback(() => {
    return axios
      .delete(`${BOT_API}/bot/api/admin/action-log`)
      .then(() => setActionLog([]));
  }, []);

  return { actionLog, clearActionLog, refreshActionLog };
};
