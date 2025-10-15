const { Events } = require("discord.js");

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction) {
    // Handle Slash Commands
    if (interaction.isChatInputCommand()) {
      const command = interaction.client.commands.get(interaction.commandName);

      // Display an error if an invalid command was entered
      if (!command) {
        console.error(
          `Error - No command matching /${interaction.commandName} was found`
        );
        return;
      }

      // Create a list of culvert commands
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
        "exception",
        "export",
        "scan",
        "finalize",
        "wos",
        "changeid",
        "fatal",
      ];

      // Create a list of bee-exclusive and owner-exclusive commands
      const beeCommands = [
        "link",
        "unlink",
        "rename",
        "correct",
        "exception",
        "scan",
        "finalize",
        "wos",
        "changeid",
        "export",
        "say",
        "guildprofile",
        "subtract",
      ];
      const ownerCommands = ["reload"];

      // Display an error message if guests try to use culvert commands
      if (
        interaction.member.roles.cache.has("720006084252663868") &&
        culvertCommands.includes(interaction.commandName)
      ) {
        interaction.reply(
          `Error - Guests do not have permission to use this command`
        );
        return;
      }

      // Display an error message if members try to use bee commands
      if (
        !interaction.member.roles.cache.has("720001044746076181") &&
        interaction.user.id !== "631337640754675725" && // Add myself as an exception to use the bee commands
        beeCommands.includes(interaction.commandName)
      ) {
        interaction.reply(
          `Error - Members do not have permission to use this command`
        );
        return;
      }

      // Display an error message if members try to use owner commands
      if (
        interaction.user.id !== "631337640754675725" &&
        ownerCommands.includes(interaction.commandName)
      ) {
        interaction.reply(
          `Error - You do not have permission to use this command`
        );
        return;
      }

      // Display an error message if the command fails
      try {
        await command.execute(interaction);
      } catch (error) {
        console.error(
          `Error - Could not execute the /${interaction.commandName} command`
        );
        console.error(error);
      }
    }

    // Handle autocomplete functionality
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
