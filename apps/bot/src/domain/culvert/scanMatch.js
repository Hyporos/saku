const dayjs = require("dayjs");
const culvertSchema = require("../../schemas/culvertSchema.js");
const exceptionSchema = require("../../schemas/exceptionSchema.js");
const { normalizeName, nameMatch, getAllCharacters } = require("./utils.js");

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

// A name read with trailing dots was cut off by the guild list.
const isCut = (value) => /\.$/.test(value);

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
 * Split a guild list name cell into its two names.
 *
 * Since the 2026-11 guild list layout, guild membership belongs to an account group, and a cell reads
 * "Character(Main)": whichever character the member is on (it can change freely within the group),
 * then the group's representative, their main, in brackets. One-character accounts read
 * "wrignt(wrignt)". The column truncates the whole cell, so "Caycia(Cay.." and "Beezle(Bee" (dots
 * lost) are normal reads.
 *
 * @param {string} scannedName - One name cell as read off the screenshot.
 * @returns {{outer: string, inner: string|null}} - inner is null when there is no bracket. An inner
 *   name whose closing bracket is missing is cut off, so it comes back ending in ".." to say so.
 */
function splitScannedName(scannedName) {
  const raw = String(scannedName ?? "").replace(/\s+/g, "");
  const open = raw.indexOf("(");
  if (open === -1) return { outer: raw, inner: null };

  const outer = raw.slice(0, open);
  const rest = raw.slice(open + 1);
  const close = rest.indexOf(")");
  let inner = close === -1 ? rest : rest.slice(0, close);
  if (close === -1 && !/\.{1,3}$/.test(inner)) inner += "..";
  return { outer, inner: inner.replace(/^\.+$/, "") || null };
}

// One name, no brackets: the matching this module has always done.
function matchPlainName(scannedName, linkedNames) {
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
 * Resolve a name read off a screenshot to a linked character name.
 *
 * The main in brackets comes first: it is the one name that stays put while the character before it
 * changes week to week, and one account group is one row, so a week's score always lands on the main.
 * The character before the bracket settles a tie between short-prefix matches, and is the fallback
 * for someone whose linked character isn't their main.
 *
 * @param {string} scannedName - One name cell as read off the screenshot.
 * @param {string[]} linkedNames - Lowercased names of every linked character.
 * @param {(name: string) => string} [applyException] - The misread table, applied to each half of a
 *   bracketed cell as well as the whole, since exceptions are stored per character name.
 * @param {Map} [groups] - From groupIndex. A declared group decides the row before anything else.
 * @returns {{name: string|null, candidates: string[], truncated: boolean}}
 */
function matchScannedName(scannedName, linkedNames, applyException = (n) => n, groups = null) {
  const declared = groups?.size ? groupMatch(String(scannedName ?? "").trim(), groups, applyException) : null;
  if (declared) {
    const name = declared.scoresTo.toLowerCase();
    return { name, candidates: [name], truncated: false };
  }

  const whole = applyException(String(scannedName ?? "").trim());
  const { outer, inner } = splitScannedName(whole);
  if (inner === null) return matchPlainName(whole, linkedNames);

  const main = matchPlainName(applyException(inner), linkedNames);
  if (main.candidates.length > 1 && outer) {
    const hint = fold(outer);
    const better = main.candidates.find((c) => fold(c) === hint) ?? main.candidates.find((c) => fold(c).startsWith(hint) || hint.startsWith(fold(c)));
    if (better) main.name = better;
  }
  if (main.name) return main;

  return outer ? matchPlainName(applyException(outer), linkedNames) : main;
}

/**
 * The name to show a bee when nothing matched: both halves of a bracketed cell, readable.
 *
 * @param {string} scannedName
 */
function displayScannedName(scannedName) {
  const { outer, inner } = splitScannedName(scannedName);
  return inner === null ? outer : `${outer} (${inner})`;
}

// Lowercase, no whitespace, no trailing dots: the one key every exception is stored and looked up by.
const toKey = exceptionSchema.toKey;

/**
 * Build the misread→real name lookup from exception records already in hand.
 *
 * Main mappings come along too: applied to the bracketed half they turn a representative into the
 * linked character, which is all /culvertping needs from them.
 *
 * @param {Array<{exception: string, name: string}>} exceptions
 * @returns {(name: string) => string} - Maps a misread name to its real one, or returns it unchanged.
 */
function exceptionMapper(exceptions) {
  const byMisread = new Map();
  for (const e of exceptions ?? []) {
    const key = toKey(e.exception);
    if (key) byMisread.set(key, e.name);
  }
  return (scannedName) => byMisread.get(toKey(scannedName)) ?? scannedName;
}

// A cut name shorter than this is too little to pick a group by.
const GROUP_PREFIX = 3;

/**
 * Index the account groups members declared with /character group, by every name in them.
 *
 * Keys are folded like every other name comparison here. A name two people both declared (validation
 * refuses that, but older or hand-edited data could have it) maps to null, so it decides nothing.
 *
 * @param {Array<{_id: string, characters?: Array<{name: string}>, group?: Object}>} roster
 * @returns {Map<string, {discordId: string, scoresTo: string}|null>}
 */
function groupIndex(roster) {
  const byName = new Map();
  for (const user of roster ?? []) {
    const group = user?.group;
    const linked = (user?.characters ?? []).filter((c) => c?.name);
    if (!group?.main || linked.length === 0) continue;
    // scoresTo is checked when the group is saved; a character unlinked since falls back to the first.
    const target = linked.find((c) => c.name.toLowerCase() === String(group.scoresTo ?? "").toLowerCase()) ?? linked[0];
    const entry = { discordId: String(user._id), scoresTo: target.name };
    for (const name of [group.main, ...(group.characters ?? [])]) {
      const key = fold(toKey(name));
      if (!key) continue;
      const existing = byName.get(key);
      byName.set(key, existing === undefined || existing?.discordId === entry.discordId ? entry : null);
    }
  }
  return byName;
}

// One name against the declared groups: exact, or by prefix when it is cut and only one person fits.
function groupFor(read, groups) {
  if (!read) return null;
  const key = fold(toKey(read));
  if (!key) return null;
  if (!isCut(read)) return groups.get(key) ? { ...groups.get(key), cut: false } : null;
  if (key.length < GROUP_PREFIX) return null;

  const owners = new Map();
  for (const [name, entry] of groups) {
    if (entry && name.startsWith(key)) owners.set(entry.discordId, entry);
  }
  return owners.size === 1 ? { ...[...owners.values()][0], cut: true } : null;
}

/**
 * Decide a group someone is declaring, against everyone else's characters and groups. Names come in
 * already checked against the rankings, in their real spelling.
 *
 * @param {Object} input
 * @param {string} input.discordId - Whose group it is.
 * @param {string} input.main - The bracketed representative.
 * @param {string[]} [input.alts] - The other characters in the group.
 * @param {string|null} [input.scoresTo] - The linked character scores go to, as typed.
 * @param {Array<{_id: string, characters?: Array<{name: string}>, group?: Object}>} input.roster
 * @returns {{group: {main: string, characters: string[], scoresTo: string}}|{error: string}}
 */
function planGroup({ discordId, main, alts = [], scoresTo = null, roster }) {
  const owner = (roster ?? []).find((user) => String(user._id) === String(discordId));
  const linked = (owner?.characters ?? []).map((c) => c?.name).filter(Boolean);
  if (linked.length === 0) {
    return { error: "No character is linked to this account yet, so there is nothing for the group's scores to go to. Ask a bee to link one with `/character link` first" };
  }

  const names = [main, ...alts].filter(Boolean);
  const seen = new Set();
  for (const name of names) {
    const key = name.toLowerCase();
    if (seen.has(key)) return { error: `**${name}** is in the group twice` };
    seen.add(key);
  }

  for (const user of roster ?? []) {
    if (String(user._id) === String(discordId)) continue;
    const theirs = new Set((user.characters ?? []).map((c) => c?.name && fold(c.name)).filter(Boolean));
    const grouped = new Set([user.group?.main, ...(user.group?.characters ?? [])].filter(Boolean).map((n) => fold(n)));
    for (const name of names) {
      if (theirs.has(fold(name))) return { error: `**${name}** is linked to someone else` };
      if (grouped.has(fold(name))) return { error: `**${name}** is already in someone else's group` };
    }
  }

  let target;
  if (scoresTo) {
    target = linked.find((name) => name.toLowerCase() === String(scoresTo).toLowerCase());
    if (!target) return { error: `**${scoresTo}** is not one of the linked characters (${linked.join(", ")})` };
  } else {
    target = linked.find((name) => name.toLowerCase() === main.toLowerCase()) ?? linked[0];
  }

  return { group: { main, characters: alts.filter(Boolean), scoresTo: target } };
}

// The in-game Group List window holds at most six characters.
const GROUP_SIZE = 6;
const GROUP_LIST_HEADERS = new Set(["name", "names", "job", "level", "group", "grouplist"]);

/**
 * Turn the model's read of a Group List screenshot into names. The prompt asks for one bare name per
 * line, but a header, a bullet, a stray Job/Level column or a repeated row must not become a name.
 *
 * @param {string} text - The model's raw answer.
 * @returns {string[]} Up to six names, in row order, each once (case-insensitive).
 */
function parseGroupList(text) {
  const names = [];
  const seen = new Set();
  for (const line of String(text ?? "").split(/\r?\n/)) {
    const cell = line.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, "").trim();
    const name = (cell.split(/\s+/)[0] ?? "").replace(/^[`*"'|]+|[`*"'|:]+$/g, "");
    if (!name || GROUP_LIST_HEADERS.has(name.toLowerCase())) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(name);
    if (names.length === GROUP_SIZE) break;
  }
  return names;
}

/**
 * Resolve a cell through the declared groups alone. The bracketed main is checked first, then the
 * character before it, each as read and through the misread table.
 *
 * @param {string} raw - The cell as read.
 * @param {Map} groups - From groupIndex.
 * @param {(name: string) => string} misread - The misread table.
 * @param {(name: string) => string|null} [ownerOf] - Who a linked character belongs to. A cut main that
 *   fits one group still loses to a character beside it that is plainly somebody else's.
 * @returns {{discordId: string, scoresTo: string, cut: boolean}|null}
 */
function groupMatch(raw, groups, misread = (n) => n, ownerOf = () => null) {
  if (!groups?.size) return null;
  const plain = splitScannedName(raw);
  const read = splitScannedName(misread(raw));
  const reads = (...values) => [...new Set(values.filter(Boolean).flatMap((v) => [v, misread(v)]))];

  // No bracket: the cell is one name.
  if (plain.inner === null && read.inner === null) {
    for (const value of reads(plain.outer, read.outer)) {
      const hit = groupFor(value, groups);
      if (hit) return hit;
    }
    return null;
  }

  const outers = reads(plain.outer, read.outer);
  let outerOwner = null;
  for (const value of outers) {
    const hit = !isCut(value) && groupFor(value, groups);
    outerOwner = hit ? hit.discordId : ownerOf(value);
    if (outerOwner) break;
  }

  for (const value of reads(plain.inner, read.inner)) {
    const hit = groupFor(value, groups);
    if (!hit) continue;
    if (hit.cut && outerOwner && outerOwner !== hit.discordId) break;
    return hit;
  }

  for (const value of outers) {
    const hit = !isCut(value) && groupFor(value, groups);
    if (hit) return hit;
  }
  return null;
}

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //
// A whole scan, decided in one place: who each row is, what gets saved, what Saku learned, and what a
// bee has to look at. /scan and the webapp's scanner route both call this and only do the writes.

const SANDBAG = 0.85;
// A score this far outside a character's own range is more likely the wrong person than a good week.
const SANITY_HISTORY = 3;
const SANITY_HIGH = 1.5;
const SANITY_LOW = 0.5;
const RECENT_WEEKS = 5;
// Pairing a missing person with an unmatched row: at most one edit per three letters, or a score
// within 30% of their recent average when the names have nothing in common.
const NAME_CLOSE = 0.34;
const SCORE_CLOSE = 0.3;

function editDistance(a, b) {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let corner = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const next = Math.min(prev[j] + 1, prev[j - 1] + 1, corner + (a[i - 1] === b[j - 1] ? 0 : 1));
      corner = prev[j];
      prev[j] = next;
    }
  }
  return prev[b.length];
}

const isActive = (character, week) =>
  !character.memberSince || dayjs(character.memberSince).isBefore(dayjs(week).add(1, "week"));

/**
 * A character's past scores, without the week being scanned.
 *
 * @returns {{count: number, best: number, average: number}}
 */
function scoreHistory(scores, week) {
  const past = (scores ?? [])
    .filter((s) => String(s.date) !== String(week) && Number(s.score) > 0)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const best = past.reduce((max, s) => Math.max(max, s.score), 0);
  const recent = past.slice(0, RECENT_WEEKS);
  const average = recent.length ? recent.reduce((sum, s) => sum + s.score, 0) / recent.length : 0;
  return { count: past.length, best, average };
}

function sanityProblem(character, score, week) {
  if (!(score > 0)) return null;
  const { count, best, average } = scoreHistory(character.scores, week);
  if (count < SANITY_HISTORY) return null;
  if (score > best * SANITY_HIGH) return { reason: "high", best, average: Math.round(average) };
  if (score < average * SANITY_LOW) return { reason: "low", best, average: Math.round(average) };
  return null;
}

// The unmatched row most likely to be this person: by name first, then by score.
function likeliestRow(person, rows, week) {
  const names = person.characters.map((c) => c.name);
  let best = null;
  for (const row of rows) {
    const { outer, inner } = splitScannedName(row.raw);
    for (const piece of [inner, outer]) {
      const read = fold(toKey(piece));
      if (read.length < 3) continue;
      for (const name of names) {
        const target = fold(name);
        const distance = editDistance(read, isCut(piece ?? "") ? target.slice(0, read.length) : target) / read.length;
        if (!best || distance < best.distance) best = { row, character: name, distance, by: "name" };
      }
    }
  }
  if (best && best.distance <= NAME_CLOSE) return best;

  // Only one character per group is scored a week, so the person's week is their best across them.
  const byWeek = new Map();
  for (const c of person.characters) {
    for (const s of c.scores ?? []) byWeek.set(s.date, Math.max(byWeek.get(s.date) ?? 0, Number(s.score) || 0));
  }
  const { average } = scoreHistory([...byWeek].map(([date, score]) => ({ date, score })), week);
  if (!(average > 0)) return null;

  let closest = null;
  for (const row of rows) {
    if (!(row.score > 0)) continue;
    const off = Math.abs(row.score / average - 1);
    if (off <= SCORE_CLOSE && (!closest || off < closest.distance)) {
      closest = { row, character: person.characters.find((c) => isActive(c, week))?.name ?? names[0], distance: off, by: "score" };
    }
  }
  return closest;
}

/**
 * Resolve every row of one screenshot against the roster.
 *
 * A row is one account group, read as "Character(Main)". A group a member declared decides the row
 * first (either name, bracket first). Otherwise the main is matched through a main mapping or a linked
 * name. When it is unknown but the character before it is exactly a linked
 * character, Saku learns main → that character so next week matches whichever character they are on.
 *
 * @param {Object} input
 * @param {Array<{name: string, score: number}>} input.rows - From parseScanEntries, cells as read.
 * @param {Array<{_id: string, characters: Array, group?: Object}>} input.roster - culvertSchema documents.
 * @param {Array<{_id?: any, name: string, exception: string, kind?: string, source?: string}>} input.mappings
 *   - Every exception record, misreads and mains.
 * @param {string} input.week - The Wednesday being scanned, "YYYY-MM-DD".
 */
function resolveScan({ rows, roster, mappings = [], week }) {
  const characters = new Map();
  const people = new Map();
  for (const user of roster ?? []) {
    const discordId = String(user._id);
    const person = { discordId, characters: [] };
    for (const character of user.characters ?? []) {
      if (!character?.name) continue;
      const entry = { ...character, discordId };
      characters.set(character.name.toLowerCase(), entry);
      person.characters.push(entry);
    }
    if (person.characters.length > 0) people.set(discordId, person);
  }
  const linkedNames = [...characters.keys()];

  const misread = exceptionMapper((mappings ?? []).filter((m) => m.kind !== "main"));
  const mains = new Map();
  const mainOf = new Map();
  for (const mapping of mappings ?? []) {
    if (mapping.kind !== "main") continue;
    const key = toKey(mapping.exception);
    const character = characters.get(String(mapping.name).toLowerCase());
    if (!key || !character) continue;
    const entry = { id: mapping._id ? String(mapping._id) : null, key, name: character.name, source: mapping.source ?? "manual" };
    mains.set(key, { ...entry, character });
    mainOf.set(character.discordId, entry);
  }

  // Declared groups outrank everything below: learned mains, misreads and fuzzy names.
  const groups = groupIndex(roster);
  const ownerOf = (name) => characters.get(String(name).toLowerCase())?.discordId ?? null;

  // Linked names and mapped mains a truncated read could be.
  function byPrefix(read) {
    const prefix = fold(toKey(read));
    const found = new Map();
    if (!prefix) return [];
    for (const name of linkedNames) if (fold(name).startsWith(prefix)) found.set(name, characters.get(name));
    for (const [key, main] of mains) if (fold(key).startsWith(prefix)) found.set(main.character.name.toLowerCase(), main.character);
    return [...found.values()];
  }

  // One person among the candidates, or null when the character beside them doesn't settle it.
  function settle(candidates, outerExact, outerRead) {
    const owners = new Set(candidates.map((c) => c.discordId));
    const sameName = candidates.find((c) => outerRead && fold(c.name) === fold(outerRead));
    if (owners.size === 1) return sameName ?? candidates[0];
    if (outerExact && owners.has(outerExact.discordId)) {
      return candidates.find((c) => c.name === outerExact.name) ?? candidates.find((c) => c.discordId === outerExact.discordId);
    }
    return sameName ?? null;
  }

  function resolvePlain(cell) {
    const parsed = parseScannedName(cell);
    if (parsed.truncated) {
      const candidates = byPrefix(parsed.stem);
      if (candidates.length === 0) return { character: null };
      const chosen = settle(candidates, null, null);
      return chosen ? { character: chosen, via: "name" } : { character: null, suggestions: candidates.map((c) => c.name) };
    }
    const mapped = mains.get(toKey(cell));
    if (mapped) return { character: mapped.character, via: "mapping" };
    const { name } = matchPlainName(cell, linkedNames);
    return { character: name ? characters.get(name) : null, via: "name" };
  }

  function resolveRow(raw) {
    const declared = groupMatch(raw.trim(), groups, misread, ownerOf);
    if (declared) {
      const character = characters.get(declared.scoresTo.toLowerCase());
      if (character) return { character, via: "group" };
    }

    const cell = misread(raw.trim());
    const { outer, inner } = splitScannedName(cell);
    if (inner === null) return resolvePlain(cell);

    const outerRead = outer ? misread(outer) : "";
    const outerExact = outerRead && !isCut(outerRead) ? characters.get(outerRead.toLowerCase()) ?? null : null;
    const innerRead = misread(inner);
    const truncated = isCut(innerRead);
    const key = toKey(innerRead);

    if (truncated) {
      const candidates = byPrefix(innerRead);
      if (candidates.length > 0) {
        const chosen = settle(candidates, outerExact, outerRead);
        if (chosen) return { character: chosen, via: "main" };
        return { character: null, suggestions: candidates.map((c) => c.name) };
      }
    } else {
      const mapped = mains.get(key);
      if (mapped) return { character: mapped.character, via: "mapping" };
      const linked = characters.get(key);
      if (linked) return { character: linked, via: "main" };
    }

    // The main is unknown. A near miss on a linked name still counts when nothing contradicts it.
    const fuzzy = truncated ? null : matchPlainName(innerRead, linkedNames).name;
    const near = fuzzy ? characters.get(fuzzy) : null;
    if (near && (!outerExact || outerExact.discordId === near.discordId)) return { character: near, via: "main" };

    // Learning needs the whole main: a cut one could be the start of somebody else's.
    // A name somebody declared in a group is theirs, never a main to learn for anyone else.
    if (outerExact) return { character: outerExact, via: "outer", learn: truncated || !key || groups.has(fold(key)) ? null : key };

    const fallback = outerRead ? matchPlainName(outerRead, linkedNames).name : null;
    if (fallback) return { character: characters.get(fallback), via: "outer-fuzzy" };
    return { character: null };
  }

  const resolved = (rows ?? []).map((row) => {
    const raw = String(row.name ?? "");
    const score = Number(row.score);
    return { raw, score, isNaN: Number.isNaN(score), ...resolveRow(raw) };
  });

  // ⎯⎯ One row, one person ⎯⎯ //
  const byPerson = new Map();
  for (const row of resolved) {
    if (!row.character) {
      row.status = row.suggestions?.length ? "ambiguous" : "notFound";
    } else if (!isActive(row.character, week)) {
      row.status = "absent";
    } else {
      const list = byPerson.get(row.character.discordId) ?? [];
      list.push(row);
      byPerson.set(row.character.discordId, list);
    }
  }

  const conflicts = [];
  for (const [discordId, list] of byPerson) {
    if (list.length < 2) continue;
    for (const row of list) row.status = "conflict";
    conflicts.push({
      discordId,
      characters: [...new Set(list.map((r) => r.character.name))],
      rows: list.map((r) => ({ raw: r.raw, score: r.score })),
    });
  }

  // ⎯⎯ Saves, learning and the score check ⎯⎯ //
  const saves = [];
  const learned = [];
  const checks = [];
  for (const row of resolved) {
    if (row.status) continue;
    const character = row.character;

    // Only a row matched without its main is checked; a known main is already proof of who it is.
    const problem = row.via === "outer" || row.via === "outer-fuzzy" ? sanityProblem(character, row.score, week) : null;
    if (problem) {
      row.status = "check";
      checks.push({ raw: row.raw, name: character.name, discordId: character.discordId, score: row.score, main: row.learn ?? null, ...problem });
      continue;
    }

    row.status = "saved";
    const best = [...(character.scores ?? [])].reduce((max, s) => Math.max(max, Number(s.score) || 0), 0);
    if (!row.isNaN && row.score !== 0 && row.score < best * SANDBAG) {
      row.sandbag = true;
      row.personalBest = best;
    }
    saves.push({
      name: character.name,
      discordId: character.discordId,
      score: row.isNaN ? 0 : row.score,
      replace: (character.scores ?? []).some((s) => String(s.date) === String(week)),
    });

    if (row.learn) {
      const previous = mainOf.get(character.discordId);
      learned.push({
        key: row.learn,
        name: character.name,
        discordId: character.discordId,
        raw: row.raw,
        score: row.score,
        replaces: previous && previous.key !== row.learn ? { id: previous.id, key: previous.key, name: previous.name, source: previous.source } : null,
      });
    }
  }

  // ⎯⎯ Coverage ⎯⎯ //
  const seen = new Set(resolved.filter((r) => r.character).map((r) => r.character.discordId));
  const unmatched = resolved.filter((r) => r.status === "notFound" || r.status === "ambiguous");
  const missing = [];
  for (const person of people.values()) {
    if (seen.has(person.discordId) || !person.characters.some((c) => isActive(c, week))) continue;
    const pair = unmatched.length ? likeliestRow(person, unmatched, week) : null;
    missing.push({
      discordId: person.discordId,
      characters: person.characters.map((c) => c.name),
      suggestion: pair
        ? {
            raw: pair.row.raw,
            display: displayScannedName(pair.row.raw),
            main: toKey(splitScannedName(pair.row.raw).inner ?? pair.row.raw),
            character: pair.character,
            score: pair.row.score,
            by: pair.by,
          }
        : null,
    });
  }

  return {
    rows: resolved.map((row) => ({
      raw: row.raw,
      name: row.character?.name ?? row.raw,
      score: row.score,
      isNaN: row.isNaN,
      status: row.status,
      via: row.via ?? null,
      discordId: row.character?.discordId ?? null,
      sandbag: Boolean(row.sandbag),
      ...(row.personalBest ? { personalBest: row.personalBest } : {}),
      ...(row.suggestions?.length ? { suggestions: row.suggestions } : {}),
    })),
    saves,
    learned,
    conflicts,
    checks,
    missing,
  };
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
 * Everything a scan needs before it can read a screenshot: the names to match against, the misread
 * table to apply and the declared groups.
 *
 * @returns {Promise<{linkedNames: string[], applyException: (name: string) => string, groups: Map}>}
 */
async function loadScanRoster() {
  const [characters, applyException, grouped] = await Promise.all([
    getAllCharacters(),
    loadExceptions(),
    culvertSchema.find({ group: { $exists: true } }, { characters: 1, group: 1 }).lean(),
  ]);
  return {
    linkedNames: characters.filter((c) => c.name).map((c) => c.name.toLowerCase()),
    applyException,
    groups: groupIndex(grouped),
  };
}

/**
 * Point a representative at a linked character, keeping one main mapping per person: any other main
 * mapping on that person's characters is removed and handed back, so an undo can put it back.
 *
 * @param {{key: string, name: string, source: "auto"|"manual"}} mapping
 * @returns {Promise<{saved: Object, replaced: Object[]}|null>} - null when the character isn't linked.
 */
async function saveMainMapping({ key, name, source }) {
  const exception = toKey(key);
  const owner = await culvertSchema.findOne({ "characters.name": nameMatch(name) }, { characters: 1 }).lean();
  const character = owner?.characters.find((c) => c.name.toLowerCase() === String(name).toLowerCase());
  if (!exception || !character) return null;

  const discordId = String(owner._id);
  const replaced = await exceptionSchema
    .find({
      kind: "main",
      exception: { $ne: exception },
      name: { $in: owner.characters.map((c) => c.name) },
    })
    .lean();
  if (replaced.length > 0) await exceptionSchema.deleteMany({ _id: { $in: replaced.map((r) => r._id) } });

  const saved = await exceptionSchema
    .findOneAndUpdate(
      { kind: "main", exception },
      { $set: { name: character.name, exception, kind: "main", source, discordId, updatedAt: new Date() } },
      { upsert: true, new: true }
    )
    .lean();
  return { saved, replaced };
}

/**
 * Take learned mappings back: delete each, and restore whatever it replaced.
 *
 * @param {Array<{id: string, replaces?: {key: string, name: string, source?: string}|null}>} learned
 * @returns {Promise<number>} - How many were removed.
 */
async function undoMainMappings(learned) {
  let removed = 0;
  for (const item of learned ?? []) {
    if (item.id && (await exceptionSchema.findByIdAndDelete(item.id))) removed++;
    if (item.replaces) await saveMainMapping({ key: item.replaces.key, name: item.replaces.name, source: item.replaces.source ?? "manual" });
  }
  return removed;
}

/**
 * Save what Saku learned from a scan, logging each one, and hand back what an undo needs.
 *
 * @param {Array} learned - resolveScan's learned list.
 * @param {(entry: {action: string, target: string, details: string, category: string}) => Promise} log
 * @returns {Promise<Array>} - The learned items with the saved mapping's id, and what each replaced.
 */
async function saveLearned(learned, log) {
  const saved = [];
  for (const item of learned ?? []) {
    const result = await saveMainMapping({ key: item.key, name: item.name, source: "auto" });
    if (!result) continue;
    const previous = result.replaced[0];
    const replaces = previous ? { key: previous.exception, name: previous.name, source: previous.source } : null;
    saved.push({ ...item, id: String(result.saved._id), replaces });
    await log({
      action: replaces ? "Change Main" : "Learn Main",
      target: item.name,
      details: `Main ${item.key} → ${item.name} | Row: ${item.raw}${replaces ? ` | Replaced: ${replaces.key}` : ""}`,
      category: replaces ? "edit" : "create",
    });
  }
  return saved;
}

/**
 * Write a scan's scores in one batch.
 *
 * @param {Array<{name: string, score: number, replace: boolean}>} saves - resolveScan's saves.
 * @param {string} week
 */
async function saveScanScores(saves, week) {
  const ops = (saves ?? []).map(({ name, score, replace }) =>
    replace
      ? {
          updateOne: {
            filter: { "characters.name": name, "characters.scores.date": week },
            update: { $set: { "characters.$[nameElem].scores.$[dateElem].score": score } },
            arrayFilters: [{ "nameElem.name": name }, { "dateElem.date": week }],
          },
        }
      : {
          updateOne: {
            filter: { "characters.name": name },
            update: { $addToSet: { "characters.$[nameElem].scores": { score, date: week } } },
            arrayFilters: [{ "nameElem.name": name }],
          },
        }
  );
  if (ops.length > 0) await culvertSchema.bulkWrite(ops, { ordered: false });
}

/**
 * Turn the model's raw output into scored entries.
 *
 * Each line is "CharacterName Score". The name is the first token and the score the last, which is
 * what keeps a class name in between from breaking the read.
 *
 * @param {string[]} lines - The model's response, split by newline.
 * @param {(name: string) => string} [applyException] - From loadExceptions; resolveScan applies its own.
 * @returns {{scores: Array, unreadable: Array, zeroed: Array}} - unreadable and zeroed hold the same
 *   objects that are in scores, so renaming one to its matched character updates all three.
 */
function parseScanEntries(lines, applyException = (n) => n) {
  const scores = [];
  const unreadable = [];
  const zeroed = [];

  for (const line of lines) {
    const parts = String(line).trim().split(/\s+/);
    // "Katie (bloom) 1234" keeps its bracket with the name; anything else after the name is ignored.
    const name = parts[1]?.startsWith("(") && parts.length > 2 ? parts[0] + parts[1] : parts[0];
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
  resolveScan,
  saveMainMapping,
  undoMainMappings,
  saveLearned,
  saveScanScores,
  splitScannedName,
  displayScannedName,
  parseScannedName,
  candidatesFor,
  pickCandidate,
  exceptionMapper,
  groupIndex,
  groupMatch,
  planGroup,
  parseGroupList,
  GROUP_SIZE,
  toKey,
  loadScanRoster,
  parseScanEntries,
};
