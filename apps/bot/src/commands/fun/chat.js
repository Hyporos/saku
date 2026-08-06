const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const { askSaku, isBee, canChat, collectImages, onCooldown, NOT_MEMBER_NOTICE } = require("../../features/chat/index.js");

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

module.exports = {
  data: new SlashCommandBuilder()
    .setName("chat")
    .setDescription("Chat with Saku AI — ask about your scores, rankings, or MapleStory (Saku remembers your chat)")
    .addStringOption((option) =>
      option.setName("message").setDescription("What do you want to say to Saku?").setRequired(true)
    )
    // Pinging Saku with a screenshot has always worked; /chat was the only way in that couldn't see one,
    // so asking about gear or a score screen privately meant describing it in words.
    .addAttachmentOption((option) =>
      option.setName("image").setDescription("A screenshot for Saku to look at (gear, a boss drop, a score screen)")
    ),

  async execute(interaction) {
    if (!canChat(interaction.member, interaction.user.id)) {
      return interaction.reply({ content: NOT_MEMBER_NOTICE, flags: MessageFlags.Ephemeral });
    }

    if (onCooldown(interaction.user.id)) {
      return interaction.reply({
        content: "Slow down — give Saku a few seconds to think! 🐝",
        flags: MessageFlags.Ephemeral,
      });
    }

    const message = interaction.options.getString("message");
    const attachment = interaction.options.getAttachment("image");

    // Rejected up front rather than dropped quietly: collectImages filters out anything it can't read,
    // and without this a PDF or a video came back as an answer that ignored the attachment entirely.
    if (attachment && !String(attachment.contentType).startsWith("image/")) {
      return interaction.reply({
        content: "Error - That attachment isn't an image Saku can look at",
        flags: MessageFlags.Ephemeral,
      });
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      const username = interaction.member?.displayName || interaction.user.username;
      const images = attachment ? await collectImages([attachment]) : [];
      const reply = await askSaku({
        userId: interaction.user.id,
        username,
        message,
        images,
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
      // Guarded: if the failure was the interaction itself timing out, the edit throws too, and that
      // second throw is what actually reached the console as an unhandled rejection.
      await interaction.editReply("Error - Saku's brain short-circuited. Try again in a moment.").catch(() => {});
    }
  },
};
