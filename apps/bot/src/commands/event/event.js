const { SlashCommandBuilder } = require("discord.js");
const addCommand = require("./add.js");
const subtractCommand = require("./subtract.js");
const mobcountCommand = require("./mobcount.js");
const leaderboardCommand = require("./leaderboard.js");

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

module.exports = {
  data: new SlashCommandBuilder()
    .setName("event")
    .setDescription("Saku Event Commands")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("add")
        .setDescription("Log the number of mobs you've hunted")
        .addIntegerOption((option) =>
          option
            .setName("count")
            .setDescription("Mob count to add")
            .setRequired(true)
        )
        .addUserOption((option) => 
          option
            .setName("user")
            .setDescription("[ADMIN] The user you wish to add mob count to")
            .setRequired(false)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("subtract")
        .setDescription("[ADMIN] Subtract mob count from a user's total")
        .addIntegerOption((option) =>
          option
            .setName("count")
            .setDescription("Mob count to subtract")
            .setRequired(true)
        )
        .addUserOption((option) => 
          option
            .setName("user")
            .setDescription("The user you wish to subtract mob count from")
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("mobcount")
        .setDescription("View the amount of mobs you've hunted this event")
        .addUserOption((option) => 
          option
            .setName("user")
            .setDescription("The user's mob count you wish to view")
            .setRequired(false)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("leaderboard")
        .setDescription("View the mob count leaderboard")
    ),

  // ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

  async execute(interaction) {
    // Restrict command usage to specific channels
    const ALLOWED_CHANNEL_IDS = [
      "1416900120972230676",
      "1090002887410729090",
    ];

    if (!ALLOWED_CHANNEL_IDS.includes(interaction.channelId)) {
      return interaction.reply({
        content: "Error - You can only use this command in the designated event channels",
        ephemeral: true,
      });
    }

    try {
      // Parse the comand arguments
      const subcommandOption = interaction.options.getSubcommand();

      // Execute the appropriate subcommand
      switch (subcommandOption) {
        case "add":
          await addCommand.execute(interaction);
          break;
        case "subtract":
          await subtractCommand.execute(interaction);
          break;
        case "mobcount":
          await mobcountCommand.execute(interaction);
          break;
        case "leaderboard":
          await leaderboardCommand.execute(interaction);
          break;
      }
    } catch (error) {
      await interaction.reply("Error - Could not execute event command");
    }
  },
};
