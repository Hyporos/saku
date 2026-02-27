import dayjs from "dayjs";

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

/** Convert stored "R,G,B" string to a CSS color value */
export const rgbCss = (v: string) => `rgb(${v})`;

/** Convert "MMM DD, YYYY" → YYYY-MM-DD for <input type="date"> */
export const toInputDate = (stored: string) => {
  const d = dayjs(stored);
  return d.isValid() ? d.format("YYYY-MM-DD") : "";
};

/** Convert YYYY-MM-DD → "MMM DD, YYYY" for storage */
export const toStoredDate = (input: string) => {
  const d = dayjs(input);
  return d.isValid() ? d.format("MMM DD, YYYY") : input;
};

/** Normalize character name for URL slug while preserving accent distinctions */
export const normalizeCharName = (name: string) =>
  name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-");

/**
 * Build a collision-free URL slug for a character name.
 * If two characters normalise to the same slug, the second gets "_2", third "_3", etc.
 * allChars must include ALL characters across all users (the full flat list).
 */
export const charSlug = (
  name: string,
  allChars: Array<{ name: string; userId: string }>
) => {
  const normalized = normalizeCharName(name);
  const matches = allChars
    .filter((c) => normalizeCharName(c.name) === normalized)
    .sort((a, b) => a.name.localeCompare(b.name) || a.userId.localeCompare(b.userId));
  const idx = matches.findIndex((c) => c.name === name);
  return idx <= 0 ? normalized : `${normalized}_${idx + 1}`;
};
