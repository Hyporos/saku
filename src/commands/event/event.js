const { SlashCommandBuilder } = require("discord.js");
const addCommand = require("./add.js");
const subtractCommand = require("./subtract.js");
const mobcountCommand = require("./mobcount.js");

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
    ),

  // ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

  async execute(interaction) {
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
      }
    } catch (error) {
      await interaction.reply("Error - Could not execute event command");
    }
  },
};
