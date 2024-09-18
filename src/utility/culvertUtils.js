const culvertSchema = require("../culvertSchema.js");

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
 * Logs a message to the console and sends a reply to the discord channel.
 *
 * @param {Object} interaction - The interaction object from Discord.js.
 * @param {string} message - The success or error message to be sent and logged.
 */

function handleResponse(interaction, message) {
  logMessage = `/${interaction.commandName}: ${message.replace(/\*/g, "")}`;

  console.log(logMessage);
  interaction.reply(message);
}

module.exports = { findUserByCharacter, handleResponse };
