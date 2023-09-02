const { SlashCommandBuilder } = require("discord.js");
const { EmbedBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("bonk")
    .setDescription("Check Saku's response time"),
  async execute(client, interaction) {
    const beforeEmbed = new EmbedBuilder()
      .setColor(0xffc3c5)
      .setDescription("Bonking...");

    const sent = await interaction.reply({
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
        `Latency⠀⎯⠀**${
          sent.createdTimestamp - interaction.createdTimestamp
        }ms**\nAPI⠀⎯⠀**${client.ws.ping}ms**`
      );

    interaction.editReply({ embeds: [afterEmbed] });
  },
};
