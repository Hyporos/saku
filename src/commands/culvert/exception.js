const { SlashCommandBuilder } = require("discord.js");
const exceptionSchema = require("../../schemas/exceptionSchema.js");

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
    const exceptionExists = await exceptionSchema.exists({
      exception: {
        $regex: `^${exceptionOption}$`,
        $options: "i",
      },
    });

    if (exceptionExists) {
      return interaction.reply(
        `Error - The exception **${exceptionOption}** has already been made`
      );
    }

    // Create an exception for the character
    await exceptionSchema.create({
      name: nameOption,
      exception: exceptionOption,
    });

    // Handle responses
    interaction.reply(
      `**${exceptionOption}** has been set as an exception for **${nameOption}**`
    );
  },
};
