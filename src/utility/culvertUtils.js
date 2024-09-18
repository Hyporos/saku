const culvertSchema = require("../culvertSchema.js");
const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const updateLocale = require("dayjs/plugin/updateLocale");
dayjs.extend(utc);
dayjs.extend(updateLocale);

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

/**
 * Finds a user object based on the given character name
 *
 * @param {Object} interaction - The interaction object from Discord.js.
 * @param {string} characterOption - The character name to be used for the query.
 */

async function findUserByCharacter(interaction, characterOption) {
  const user = await culvertSchema.findOne({
    "characters.name": { $regex: `^${characterOption}$`, $options: "i" },
  });

  if (!user) {
    await interaction.reply(
      `Error - The character **${characterOption}** has not yet been linked`
    );
    return null;
  }

  return user;
}

/**
 * Gets the current reset and last reset dates based on the day of Wednesday.
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

module.exports = { findUserByCharacter, getResetDates };
