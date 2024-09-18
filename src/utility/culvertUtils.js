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
 * Logs a message to the console and sends a reply to the Discord channel.
 *
 * @param {Object} interaction - The interaction object from Discord.js.
 * @param {string|Object} message - The message or object to be sent and logged.
 */

function handleResponse(interaction, message) {
  // Determine if `message` is an object
  if (typeof message === 'object') {
    // Extract relevant properties, if present
    const { content, files, embeds, components, ephemeral } = message;

    // Construct log message from content if available
    const logMessage = `/${interaction.commandName}: ${content ? content.replace(/\*/g, '') : ''}`;

    console.log(logMessage);
    interaction.reply({
      content: content || '',
      files: files || [],
      embeds: embeds || [],
      components: components || [],
      ephemeral: ephemeral || false,
    });
  } else {
    // Handle the case where `message` is a string
    const logMessage = `/${interaction.commandName}: ${message.replace(/\*/g, '')}`;

    console.log(logMessage);
    interaction.reply(message);
  }
}

module.exports = { findUserByCharacter, handleResponse };
