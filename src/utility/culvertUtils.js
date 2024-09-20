const culvertSchema = require("../culvertSchema.js");
const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const updateLocale = require("dayjs/plugin/updateLocale");
dayjs.extend(utc);
dayjs.extend(updateLocale);

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

/**
 * Finds a character based on the given name
 *
 * @param {Object} interaction - The interaction object from Discord.js.
 * @param {string} characterName - The character name to be used for the query.
 */

async function findCharacter(interaction, characterName) {
  const user = await culvertSchema.findOne(
    {
      "characters.name": { $regex: `^${characterName}$`, $options: "i" },
    },
    { "characters.$": 1 }
  );

  if (!user) {
    await interaction.reply(
      `Error - The character **${characterName}** is not linked to any user`
    );
    return null;
  }

  return user.characters[0];
}

/**
 * Check if a character already exists in the database (is linked to a user)
 *
 * @param {Object} interaction - The interaction object from Discord.js.
 * @param {string} characterName - The character name to be used for the query.
 */

async function isCharacterLinked(interaction, characterName) {
  const characterLinked = await culvertSchema.exists({
    "characters.name": { $regex: `^${characterName}$`, $options: "i" },
  });

  if (!characterLinked) {
    await interaction.reply(
      `Error - The character **${characterName}** is not linked to any user`
    );
    return false;
  }

  return true;
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
 * Return the properly cased name of a character
 *
 * @param {string} characterName - The character name to be used for the query.
 */

async function getCasedName(characterName) {
  const casedName = await culvertSchema.findOne(
    { "characters.name": { $regex: `^${characterName}$`, $options: "i" } },
    { "characters.$": 1 }
  );

  return casedName.characters[0].name;
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
  findCharacter,
  isCharacterLinked,
  getAllCharacters,
  getCasedName,
  getResetDates,
};
