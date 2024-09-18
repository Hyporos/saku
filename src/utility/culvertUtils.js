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

/**
 * Logs a message to the console and sends a reply to the Discord channel.
 *
 * @param {Object} interaction - The interaction object from Discord.js.
 * @param {string|Object} message - The message or object to be sent and logged.
 */

function handleResponse(interaction, message, customLogMessage) {
  // Determine if `message` is an object
  if (typeof message === "object") {
    // Extract relevant properties, if present
    const { content, files, embeds, components, ephemeral } = message;

    // Use the custom log message if provided, otherwise use the content
    const logMessage = `/${interaction.commandName}: ${
      customLogMessage || (content ? content.replace(/\*/g, "") : "")
    }`;

    console.log(logMessage);
    interaction.reply({
      content: content || "",
      files: files || [],
      embeds: embeds || [],
      components: components || [],
      ephemeral: ephemeral || false,
    });
  } else {
    // Handle the case where `message` is a string
    const logMessage = `/${interaction.commandName}: ${
      customLogMessage || message.replace(/\*/g, "")
    }`;

    console.log(logMessage);
    interaction.reply(message);
  }
}

module.exports = { findUserByCharacter, getResetDates, handleResponse };
