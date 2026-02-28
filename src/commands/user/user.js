const { SlashCommandBuilder } = require("discord.js");
const levelCommand = require("./level.js");
const rankingsCommand = require("./rankings.js");

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

module.exports = {
  data: new SlashCommandBuilder()
    .setName("user")
    .setDescription("Discord User Commands")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("level")
        .setDescription("View your or another user's level and exp")
        .addUserOption((option) =>
          option
            .setName("user")
            .setDescription("The user you would like to view")
            .setRequired(false)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("rankings")
        .setDescription("View the server leaderboard")
    ),

  // ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

  async execute(interaction) {
    try {
      // Parse the comand arguments
      const subcommandOption = interaction.options.getSubcommand();

      // Execute the appropriate subcommand
      switch (subcommandOption) {
        case "level":
          await levelCommand.execute(interaction);
          break;
        case "rankings":
          await rankingsCommand.execute(interaction);
          break;
      }
    } catch (error) {
      await interaction.reply("Error - Could not execute user command");
    }
  },
};
