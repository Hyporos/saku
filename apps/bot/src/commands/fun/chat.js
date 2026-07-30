const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const { askSaku, isBee, canChat, onCooldown, NOT_MEMBER_NOTICE } = require("../../utility/sakuChat.js");

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

module.exports = {
  data: new SlashCommandBuilder()
    .setName("chat")
    .setDescription("Chat with Saku AI — ask about your scores, rankings, or MapleStory (Saku remembers your chat)")
    .addStringOption((option) =>
      option.setName("message").setDescription("What do you want to say to Saku?").setRequired(true)
    ),

  async execute(interaction) {
    if (!canChat(interaction.member, interaction.user.id)) {
      return interaction.reply({ content: NOT_MEMBER_NOTICE, flags: MessageFlags.Ephemeral });
    }

    if (onCooldown(interaction.user.id)) {
      return interaction.reply({ content: "Slow down — give Saku a few seconds to think! 🐝", flags: MessageFlags.Ephemeral });
    }

    const message = interaction.options.getString("message");
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      const username = interaction.member?.displayName || interaction.user.username;
      const reply = await askSaku({
        userId: interaction.user.id,
        username,
        message,
        isBee: isBee(interaction.member, interaction.user.id),
        isPrivate: true, // /chat is ephemeral
        channel: interaction.channel,
        guild: interaction.guild,
      });

      // Shrink the echo of their own question rather than the answer they asked for.
      const room = Math.max(2000 - reply.length - 14, 40);
      const shown = message.length > room ? `${message.slice(0, room)}…` : message;
      let out = `**You:** ${shown}\n\n${reply}`;
      if (out.length > 2000) out = out.slice(0, 2000);

      await interaction.editReply({ content: out, allowedMentions: { parse: [] }, flags: MessageFlags.SuppressEmbeds });
    } catch (err) {
      console.error("Error - /chat failed:", err);
      await interaction.editReply("Error - Saku's brain short-circuited. Try again in a moment.");
    }
  },
};
