const { SlashCommandBuilder } = require("discord.js");
const botSchema = require("../../exceptionSchema.js");
const { handleResponse } = require("../../utility/culvertUtils.js");

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

module.exports = {
  data: new SlashCommandBuilder()
    .setName("exception")
    .setDescription("Add a character exception to /scan")
    .addStringOption((option) =>
      option
        .setName("name")
        .setDescription("The name of the character")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("exception")
        .setDescription(
          "The alternative name, which is being incorrectly scanned"
        )
        .setRequired(true)
    ),

  // ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

  async execute(interaction) {
    // Parse the command arguments
    const nameOption = interaction.options.getString("name");
    const exceptionOption = interaction.options.getString("exception");

    // Check if the exception has already been made
    const exceptionExists = await botSchema.exists({
      exception: {
        $regex: `^${exceptionOption}$`,
        $options: "i",
      },
    });

    if (exceptionExists) {
      return handleResponse(
        interaction,
        `Error - The exception **${exceptionOption}** has already been made`
      );
    }

    // Create an exception for the character
    await botSchema.create({
      name: nameOption,
      exception: exceptionOption,
    });

    // Handle responses
    return handleResponse(
      interaction,
      `**${exceptionOption}** has been set as an exception for **${nameOption}**`
    );
  },
};
