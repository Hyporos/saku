const culvertSchema = require("../../schemas/culvertSchema.js");
const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const updateLocale = require("dayjs/plugin/updateLocale");
dayjs.extend(utc);
dayjs.extend(updateLocale);

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

// Names used to be interpolated straight into a regex, so anything containing regex syntax either
// matched the wrong character ("a.b" matches "axb") or threw and took the command down with it
// ("Jo(n" is an unterminated group).
const REGEX_CHARS = /[.*+?^${}()|[\]\\]/g;

// The official rankings, which is where a character's real capitalisation, class and level come from.
// This query string was written out in five separate files — /character, /profile, Saku's chat, and
// two API routes — so the day Nexon changes it, five things break and four of them are somewhere
// nobody thought to look. Each caller still applies its own timeout and reads its own fields, because
// those genuinely differ; only the address is shared.
//
// Callers must treat an empty `ranks` array as "not found": the API answers 200 for a name that does
// not exist, so a rejected promise is not the miss signal.
const RANKINGS_URL = (name) =>
  `https://www.nexon.com/api/maplestory/no-auth/ranking/v2/na?type=overall&id=legendary&reboot_index=1&page_index=1&character_name=${encodeURIComponent(name)}`;

// The human-facing page for the same character, for linking out to.
const RANKINGS_PAGE = (name) =>
  `https://www.nexon.com/maplestory/rankings/north-america/overall-ranking/legendary?world_type=heroic&search_type=character-name&search=${encodeURIComponent(name)}`;

/**
 * The key a character name is stored under in the cached rankings metadata.
 *
 * Deliberately lossy: it folds the characters people routinely mistake for one another in a name, so
 * a lookup still lands when someone types Rally for RaIly. Anything reading that collection has to key
 * through this exact function — a plain toLowerCase() misses 73 of the 202 names currently linked.
 *
 * @param {string} name - The character name to normalize.
 * @returns {string} - The normalized key.
 */

function normalizeName(name) {
  return String(name ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[il1|!]/g, "i")
    .replace(/[o0]/g, "o");
}

/**
 * Build a case-insensitive exact match for a character name.
 *
 * @param {string} characterName - The character name to match.
 * @returns {Object} - A MongoDB query fragment.
 */

const nameMatch = (characterName) => ({
  $regex: `^${String(characterName).replace(REGEX_CHARS, "\\$&")}$`,
  $options: "i",
});

/**
 * Check if a character has a submitted score on the given date
 *
 * @param {string} characterName - The character name to be used for the query.
 * @param {string} scoreDate - The date to check for scores
 * @returns {Promise<boolean>} - Whether a score already exists for that week.
 */

async function isScoreSubmitted(characterName, scoreDate) {
  return Boolean(
    await culvertSchema.exists({
      characters: {
        $elemMatch: {
          name: nameMatch(characterName),
          "scores.date": scoreDate,
        },
      },
    })
  );
}


/**
 * Gets a list of all currently linked characters
 */

async function getAllCharacters() {
  return await culvertSchema.aggregate([
    {
      $unwind: "$characters",
    },
    {
      $replaceRoot: { newRoot: "$characters" },
    },
  ]);
}


/**
 * Gets the current reset and last reset dates based on Thursday 12:00 AM UTC.
 *
 * @returns {Object} An object containing the current reset, last reset and next reset dates.
 */

function getResetDates() {
  dayjs.updateLocale("en", {
    weekStart: 4, // Week starts on Thursday 12:00 AM UTC
  });

  const reset = dayjs()
    .utc()
    .startOf("week")
    .subtract(1, "day")
    .format("YYYY-MM-DD");

  const lastReset = dayjs()
    .utc()
    .startOf("week")
    .subtract(8, "day")
    .format("YYYY-MM-DD");

  const nextReset = dayjs().utc().startOf("week").add(7, "day");

  return { reset, lastReset, nextReset };
}

module.exports = {
  normalizeName,
  nameMatch,
  RANKINGS_URL,
  RANKINGS_PAGE,
  isScoreSubmitted,
  getAllCharacters,
  getResetDates,
};
