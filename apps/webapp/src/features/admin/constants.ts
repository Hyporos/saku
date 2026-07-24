import { apiBase } from "../../config/apiBase";

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

// Proxy base — browser calls server.js which forwards to the bot server-side,
// avoiding Mixed Content errors when the webapp is on HTTPS.
export const BOT_API = apiBase;

export const PAGE_SIZE = 10;
export const SCORE_DETAIL_PAGE_SIZE = 10;

// Fields that hold date strings which must be compared by value, not lexicographically
export const DATE_SORT_FIELDS = new Set(["memberSince", "joinedAt"]);

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

// The graph colors available via /graphcolor, stored as raw RGB strings.
// Keep in sync with COLORS in apps/bot/src/commands/culvert/graphColor.js
export const GRAPH_COLORS = [
  { name: "Saku Pink",  value: "255,189,213" },
  { name: "Hot Pink",   value: "232,60,150" },
  { name: "Red",        value: "189,36,36" },
  { name: "Coral",      value: "251,113,90" },
  { name: "Orange",     value: "214,110,45" },
  { name: "Gold",       value: "234,179,8" },
  { name: "Yellow",     value: "235,215,45" },
  { name: "Lime",       value: "132,204,22" },
  { name: "Green",      value: "58,180,31" },
  { name: "Mint Green", value: "173,235,179" },
  { name: "Cyan",       value: "34,211,238" },
  { name: "Blue",       value: "45,140,214" },
  { name: "Indigo",     value: "99,102,241" },
  { name: "Purple",     value: "145,68,207" },
  { name: "Lavender",   value: "200,160,240" },
  { name: "Slate",      value: "148,163,184" },
  { name: "White",      value: "240,240,240" },
];

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

export const inputCls =
  "bg-background border border-tertiary/20 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-accent/40 transition-colors w-full";
