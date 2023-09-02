const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("bonk")
    .setDescription("Check Saku's response time"),
  async execute(client, interaction) {
    const beforeEmbed = new EmbedBuilder()
      .setColor(0xffc3c5)
      .setDescription("Bonking...");

    const message = await interaction.reply({
      embeds: [beforeEmbed],
      fetchReply: true,
    });

    const afterEmbed = new EmbedBuilder()
      .setColor(0xffc3c5)
      .setAuthor({
        name: "Bonk!",
        iconURL:
          "https://cdn.discordapp.com/emojis/1058627632641609748.webp?size=44&quality=lossless",
      })
      .setDescription(
        `**Latency** ⎯ ${
          message.createdTimestamp - interaction.createdTimestamp
        }ms\n**API** ⎯ ${client.ws.ping}ms`
      );

    interaction.editReply({ embeds: [afterEmbed] });
  },
};
