const { SlashCommandBuilder, ChannelType } = require("discord.js");

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

module.exports = {
  data: new SlashCommandBuilder()
    .setName("say")
    .setDescription(
      "Have Saku relay a message for you in the specified channel"
    )
    .addStringOption((option) =>
      option
        .setName("message")
        .setDescription("The message you would like Saku to send")
        .setRequired(true)
    )
    .addChannelOption((option) =>
      option
        .setName("channel")
        .setDescription("The channel where would like to send the message")
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    ),

  // ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

  async execute(interaction, client) {
    // Parse the command arguments
    const message = interaction.options.getString("message");
    const channel = interaction.options.getChannel("channel");

    // Handle responses, in the specified channel
    try {
      await channel.send(message);
      await interaction.reply({
        content: `Message has been successfully sent in ${channel.toString()}`,
        ephemeral: true,
      });
    } catch (error) {
      await interaction.reply({
        content: "Error - Message could not be sent",
        ephemeral: true,
      });
    }
  },
};
