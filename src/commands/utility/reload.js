const { SlashCommandBuilder } = require("discord.js");

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

module.exports = {
  data: new SlashCommandBuilder()
    .setName("reload")
    .setDescription("Reloads a command")
    .addStringOption((option) =>
      option
        .setName("category")
        .setDescription("The category of the command")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("command")
        .setDescription("The command to reload")
        .setRequired(true)
    ),
  // ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

  async execute(interaction) {
    // Parse the command arguments
    const categoryOption = interaction.options
      .getString("category", true)
      .toLowerCase();
    const commandOption = interaction.options
      .getString("command", true)
      .toLowerCase();

    // Fetch the command name, return if nonexistent
    const command = interaction.client.commands.get(commandOption);

    if (!command) {
      return interaction.reply(
        `Error - Could not find the command \`/${commandOption}\``
      );
    }

    // Clear the command cache
    delete require.cache[
      require.resolve(`../${categoryOption}/${command.data.name}.js`)
    ];

    // Reload the specified command via deletion / reloading
    try {
      interaction.client.commands.delete(command.data.name);
      const newCommand = require(`../${categoryOption}/${command.data.name}.js`);
      interaction.client.commands.set(newCommand.data.name, newCommand);

      // Handle responses
      await interaction.reply(
        `The \`/${newCommand.data.name}\` command was reloaded`
      );
    } catch (error) {
      console.error(error);
      await interaction.reply(
        `Error - Could not reload the command \`/${command.data.name}\`:\n\`${error.message}\``
      );
    }
  },
};
