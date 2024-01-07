const { SlashCommandBuilder } = require("discord.js");

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

module.exports = {
  data: new SlashCommandBuilder()
    .setName("reload")
    .setDescription("Reloads a command.")
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
    const categoryName = interaction.options
      .getString("category", true)
      .toLowerCase();
    const commandName = interaction.options
      .getString("command", true)
      .toLowerCase();

    const command = interaction.client.commands.get(commandName);

    if (!command) {
      return interaction.reply(
        `Error ⎯ Could not find the command \`/${commandName}\``
      );
    }

    delete require.cache[
      require.resolve(`../${categoryName}/${command.data.name}.js`)
    ];

    try {
      interaction.client.commands.delete(command.data.name);
      const newCommand = require(`../${categoryName}/${command.data.name}.js`);
      interaction.client.commands.set(newCommand.data.name, newCommand);
      
      await interaction.reply(
        `The \`/${newCommand.data.name}\` command was reloaded`
      );
    } catch (error) {
      console.error(error);
      await interaction.reply(
        `Error ⎯ Could not reload the command \`/${command.data.name}\`:\n\`${error.message}\``
      );
    }
  },
};
