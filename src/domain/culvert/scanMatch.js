const exceptionSchema = require("../../schemas/exceptionSchema.js");
const { normalizeName, getAllCharacters } = require("./utils.js");

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //
// Turning a name read off a screenshot into a name that is actually linked.
//
// This existed three times — in /scan, in /culvertping and in the webapp's scanner route — and the
// three had drifted apart rather than staying in step. /scan folded confusable letters, /culvertping
// did not, and only the route had the exact-match fast path and the I/l retry. Whichever one you were
// looking at, the other two were quietly worse at the same job.
//
// Nothing here touches the database or Discord. Callers pass in the names they already hold and get a
// name back; how they turn that into a character is their own business, which is what lets the command
// and the route keep their very different data access and still agree on the answer.

// MapleStory renders l and I identically, and the guild list truncates long names with an ellipsis.
// Between the two, an OCR read is rarely character-for-character correct, so a name is matched on its
// first four and last four letters rather than as a whole.
const EDGE = 4;
const REGEX_CHARS = /[.*+?^${}()|[\]\\]/g;
const escapeRegex = (value) => String(value).replace(REGEX_CHARS, "\\$&");

// The scanned side is normalized with the same folding used everywhere else names are compared, so
// there is one answer to "are these the same name" rather than one per caller. It also strips accents,
// which only ever helps here: a linked name cannot contain one (link rejects anything outside
// [A-Za-z0-9]), so the only accents in play are ones OCR invented.
const fold = (value) => normalizeName(value);

/**
 * Split a scanned name into the pieces matching works on.
 *
 * @param {string} scannedName - One name as read off the screenshot.
 */
function parseScannedName(scannedName) {
  const raw = String(scannedName ?? "");
  const ellipsis = raw.match(/\.{1,3}$/)?.[0] ?? "";
  const truncated = ellipsis.length > 0;
  const stem = truncated ? raw.slice(0, -ellipsis.length) : raw;

  return {
    raw,
    truncated,
    stem,
    beginning: stem.substring(0, EDGE),
    // A truncated name has no trustworthy ending — that is what the ellipsis is telling us.
    ending: truncated ? null : stem.substring(Math.max(0, stem.length - EDGE)),
  };
}

/**
 * Every linked name a scanned name could plausibly be.
 *
 * @param {Object} parsed - The result of parseScannedName.
 * @param {string[]} linkedNames - Lowercased names of every linked character.
 * @returns {string[]} - Matching names, lowercased.
 */
function candidatesFor(parsed, linkedNames) {
  const hits = [];
  if (!parsed.stem) return hits;

  if (parsed.truncated) {
    const prefix = fold(parsed.stem);
    for (const name of linkedNames) {
      if (fold(name).startsWith(prefix)) hits.push(name);
    }
    return hits;
  }

  // Escaped because this is OCR output, not a name anyone typed: a stray bracket used to be
  // interpolated straight into the pattern, where it either matched the wrong character or threw and
  // took the whole scan down with it.
  const edges = new RegExp(`^${escapeRegex(fold(parsed.beginning))}|${escapeRegex(fold(parsed.ending))}$`, "i");
  for (const name of linkedNames) {
    if (edges.test(fold(name))) hits.push(name);
  }
  return hits;
}

/**
 * Pick one name out of several candidates.
 *
 * @param {Object} parsed - The result of parseScannedName.
 * @param {string[]} candidates - Names from candidatesFor.
 * @returns {string|null} - The chosen name, lowercased.
 */
function pickCandidate(parsed, candidates) {
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];

  const search = fold(parsed.truncated ? parsed.stem : parsed.raw);
  let chosen = null;
  for (const candidate of candidates) {
    const folded = fold(candidate);
    const hit = parsed.truncated ? folded.startsWith(search) : folded.includes(search);
    if (!hit) continue;
    chosen = candidate;
    // A truncated name has many legitimate completions and no way to choose between them, so the
    // first is taken. A full name keeps scanning, because a later candidate containing the whole
    // scanned name is the better read of the two.
    if (parsed.truncated) break;
  }
  return chosen;
}

/**
 * Resolve a name read off a screenshot to a linked character name.
 *
 * @param {string} scannedName - One name as read off the screenshot.
 * @param {string[]} linkedNames - Lowercased names of every linked character.
 * @returns {{name: string|null, candidates: string[], truncated: boolean}}
 */
function matchScannedName(scannedName, linkedNames) {
  const parsed = parseScannedName(scannedName);

  // An exception has already rewritten the name to exactly what is in the database, so an exact hit
  // is the answer and the fuzzy pass can only make it worse — short names in particular match half
  // the roster on a four-letter edge.
  const exact = parsed.raw.toLowerCase();
  if (!parsed.truncated && linkedNames.includes(exact)) {
    return { name: exact, candidates: [exact], truncated: false };
  }

  let candidates = candidatesFor(parsed, linkedNames);

  // Last resort for the one substitution OCR gets wrong most: the four letters this matches on can
  // both miss the confusable letter entirely, in which case folding never gets the chance to help.
  if (candidates.length === 0 && /[Il]/.test(parsed.raw)) {
    for (const variant of new Set([parsed.raw.replace(/l/g, "I"), parsed.raw.replace(/I/g, "l")])) {
      if (variant === parsed.raw) continue;
      const found = candidatesFor(parseScannedName(variant), linkedNames);
      if (found.length > 0) {
        candidates = found;
        break;
      }
    }
  }

  return { name: pickCandidate(parsed, candidates), candidates, truncated: parsed.truncated };
}

/**
 * Build the misread→real name lookup from exception records already in hand.
 *
 * @param {Array<{exception: string, name: string}>} exceptions
 * @returns {(name: string) => string} - Maps a misread name to its real one, or returns it unchanged.
 */
function exceptionMapper(exceptions) {
  const byMisread = new Map((exceptions ?? []).map((e) => [String(e.exception).toLowerCase(), e.name]));
  return (scannedName) => byMisread.get(String(scannedName ?? "").toLowerCase()) ?? scannedName;
}

/**
 * Read the OCR misread table once and return a function that applies it.
 *
 * Both commands used to call this per scanned name, each time re-reading the whole collection — a
 * full guild list cost one query per line to answer a question that never changes mid-scan. The
 * scanner route holds its own cached copy, so it builds the mapper directly instead.
 *
 * @returns {Promise<(name: string) => string>}
 */
async function loadExceptions() {
  return exceptionMapper(await exceptionSchema.find({}).lean());
}

/**
 * Everything a scan needs before it can read a screenshot: the names to match against and the misread
 * table to apply. Both commands opened with this exact pair.
 *
 * @returns {Promise<{linkedNames: string[], applyException: (name: string) => string}>}
 */
async function loadScanRoster() {
  const [characters, applyException] = await Promise.all([getAllCharacters(), loadExceptions()]);
  return {
    linkedNames: characters.filter((c) => c.name).map((c) => c.name.toLowerCase()),
    applyException,
  };
}

/**
 * Turn the model's raw output into scored entries.
 *
 * Each line is "CharacterName Score". The name is the first token and the score the last, which is
 * what keeps a class name in between from breaking the read.
 *
 * @param {string[]} lines - The model's response, split by newline.
 * @param {(name: string) => string} applyException - From loadExceptions.
 * @returns {{scores: Array, unreadable: Array, zeroed: Array}} - unreadable and zeroed hold the same
 *   objects that are in scores, so renaming one to its matched character updates all three.
 */
function parseScanEntries(lines, applyException) {
  const scores = [];
  const unreadable = [];
  const zeroed = [];

  for (const line of lines) {
    const parts = String(line).split(" ");
    const name = parts[0];
    if (!name) continue;

    const score = Number(parts.pop());
    const entry = { name: applyException(name), score, sandbag: false };

    if (isNaN(score)) unreadable.push(entry);
    else if (score === 0) zeroed.push(entry);
    scores.push(entry);
  }

  return { scores, unreadable, zeroed };
}

module.exports = {
  matchScannedName,
  parseScannedName,
  candidatesFor,
  pickCandidate,
  exceptionMapper,
  loadScanRoster,
  parseScanEntries,
};
