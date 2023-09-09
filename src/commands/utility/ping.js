const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Check Saku's response time"),

  // ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

  async execute(client, interaction) {
    const beforeEmbed = new EmbedBuilder()
      .setColor(0xffc3c5)
      .setDescription("Pinging...");

    const message = await interaction.reply({
      embeds: [beforeEmbed],
      fetchReply: true,
    });

    const afterEmbed = new EmbedBuilder()
      .setColor(0xffc3c5)
      .setAuthor({
        name: "Pong!",
        iconURL:
          "https://cdn.discordapp.com/attachments/1147319860481765500/1149549510066978826/Saku.png",
      })
      .setDescription(
        `**Latency** ⎯ ${
          message.createdTimestamp - interaction.createdTimestamp
        }ms\n**API** ⎯ ${client.ws.ping}ms`
      );

    interaction.editReply({ embeds: [afterEmbed] });
  },
};
