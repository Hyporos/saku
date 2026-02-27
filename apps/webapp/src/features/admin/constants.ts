// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

// Proxy base — browser calls server.js which forwards to the bot server-side,
// avoiding Mixed Content errors when the webapp is on HTTPS.
export const BOT_API = import.meta.env.VITE_BOT_API_URL ?? "http://localhost:8000";

export const PAGE_SIZE = 10;
export const SCORE_DETAIL_PAGE_SIZE = 10;

// Fields that hold date strings which must be compared by value, not lexicographically
export const DATE_SORT_FIELDS = new Set(["memberSince", "joinedAt"]);

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

// The 9 graph colors available via /graphcolor, stored as raw RGB strings
export const GRAPH_COLORS = [
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

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

export const inputCls =
  "bg-background border border-tertiary/20 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-accent/40 transition-colors w-full";
