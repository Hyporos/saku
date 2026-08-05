const { SlashCommandBuilder, ChannelType, MessageFlags } = require("discord.js");
const actionLogSchema = require("../../schemas/actionLogSchema.js");

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

module.exports = {
  data: new SlashCommandBuilder()
    .setName("say")
    .setDescription("[BEE] Have Saku relay a message for you in the specified channel")
    .addStringOption((option) =>
      option.setName("message").setDescription("The message you would like Saku to send").setRequired(true)
    )
    .addChannelOption((option) =>
      option
        .setName("channel")
        .setDescription("The channel where would like to send the message")
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    ),

  // ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

  async execute(interaction) {
    // Parse the command arguments
    const message = interaction.options.getString("message");
    const channel = interaction.options.getChannel("channel");

    // Handle responses, in the specified channel
    try {
      await channel.send({
        content: message,
        // Whatever goes out here goes out AS Saku, so an @everyone in it reads as the bot doing it to
        // the whole server. Individual users and roles still ping, which is what relaying an
        // announcement actually needs; everyone and here do not.
        allowedMentions: { parse: ["users", "roles"] },
      });

      // Recorded like every other Bee action. This is the one command that puts words in Saku's own
      // voice, so who put them there matters more here than anywhere, and it was the only Bee command
      // leaving no trace at all.
      await actionLogSchema
        .create({
          action: "Say",
          target: `#${channel.name}`,
          details: `Relayed a message in #${channel.name} | Message: ${message}`,
          category: "create",
          actorId: interaction.user.id,
        })
        // A failed log must not report the message as failed, because it did send.
        .catch((error) => console.error("Error - Could not record /say:", error?.message ?? error));

      await interaction.reply({
        content: `Message has been successfully sent in ${channel.toString()}`,
        flags: MessageFlags.Ephemeral,
      });
    } catch (error) {
      // The old version swallowed this entirely, so a permission problem in the target channel looked
      // identical to a message Discord rejected.
      console.error("Error - /say could not send:", error?.message ?? error);
      await interaction
        .reply({ content: "Error - Message could not be sent", flags: MessageFlags.Ephemeral })
        .catch(() => {});
    }
  },
};
