const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

// The two coarsest units that still say something. A bot up for three days reads as "3d 4h", not as
// 4,412 minutes, and one up for a minute still gets seconds.
function uptime(ms) {
  const seconds = Math.floor(ms / 1000);
  const parts = [
    [Math.floor(seconds / 86400), "d"],
    [Math.floor((seconds % 86400) / 3600), "h"],
    [Math.floor((seconds % 3600) / 60), "m"],
    [seconds % 60, "s"],
  ].filter(([value]) => value > 0);
  return (
    parts
      .slice(0, 2)
      .map(([value, unit]) => `${value}${unit}`)
      .join(" ") || "0s"
  );
}

module.exports = {
  data: new SlashCommandBuilder().setName("ping").setDescription("Check Saku's response time"),

  // ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

  async execute(interaction) {
    // Deferring first is what makes the round trip measurable: the gap between the interaction and the
    // reply Discord created for it. `fetchReply: true` used to do this in one call, but it is
    // deprecated in discord.js 14, so the reply is fetched explicitly instead.
    await interaction.deferReply();
    const sent = await interaction.fetchReply();

    // -1 until the first heartbeat comes back, which is exactly what a fresh restart looks like.
    // Printing it raw made a healthy bot report "-1ms" for its first few seconds.
    const gateway = interaction.client.ws.ping;

    const pong = new EmbedBuilder()
      .setColor(0xffc3c5)
      .setAuthor({
        name: "Pong!",
        iconURL: "https://cdn.discordapp.com/attachments/1147319860481765500/1149549510066978826/Saku.png",
      })
      .setDescription(
        `**Latency** - ${sent.createdTimestamp - interaction.createdTimestamp}ms\n` +
          `**API** - ${gateway < 0 ? "measuring…" : `${gateway}ms`}\n` +
          `**Uptime** - ${uptime(interaction.client.uptime ?? 0)}`
      );

    await interaction.editReply({ embeds: [pong] });
  },
};
