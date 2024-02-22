const { Events } = require("discord.js");

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction) {
    // Handle Slash Commands
    if (interaction.isChatInputCommand()) {
      const command = interaction.client.commands.get(interaction.commandName);

      if (!command) {
        console.error(
          `Error - No command matching /${interaction.commandName} was found`
        );
        return;
      }

      const culvertCommands = [
        "gpq",
        "profile",
        "graph",
        "graphcolor",
        "rankings",
        "link",
        "unlink",
        "rename",
        "correct",
        "scan",
        "checkscores",
        "wos",
      ];

      const beeCommands = ["link", "unlink", "rename", "correct", "scan", "checkscores", "wos", "say", "export"];
      const ownerCommands = ["import", "reload"];

      if (
        interaction.member.roles.cache.has("720006084252663868") &&
        culvertCommands.includes(interaction.commandName)
      ) {
        interaction.reply(
          `Error - Guests do not have permission to use this command`
        );
        return;
      }

      if (
        !interaction.member.roles.cache.has("720001044746076181") &&
        interaction.user.id !== "631337640754675725" && // Add me as an exception to use the commands
        beeCommands.includes(interaction.commandName)
      ) {
        interaction.reply(
          `Error - Members do not have permission to use this command`
        );
        return;
      }

      if (
        interaction.user.id !== "631337640754675725" &&
        ownerCommands.includes(interaction.commandName)
      ) {
        interaction.reply(
          `Error - You do not have permission to use this command`
        );
        return;
      }

      try {
        await command.execute(interaction);
      } catch (error) {
        console.error(
          `Error - Could not execute the /${interaction.commandName} command`
        );
        console.error(error);
      }
    }
    // Handle Autocomplete
    else if (interaction.isAutocomplete()) {
      const command = interaction.client.commands.get(interaction.commandName);

      if (!command) return;

      try {
        await command.autocomplete(interaction);
      } catch (error) {
        console.error(error);
      }
    }
  },
};
