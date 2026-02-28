const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const dayjs = require("dayjs");

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

module.exports = {
  data: new SlashCommandBuilder()
    .setName("guildprofile")
    .setDescription("View the culvert profile of the guild"),

  // ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

  async execute(interaction) {
    // Parse the command arguments

    function getPreviousScores() {
      let content = "\u0060\u0060\u0060";

      content = content.concat("5. Excel\t\t   1,532,556\n")
      content = content.concat("6. Sunset\t\t  1,432,556\n")
      content = content.concat("7. Saku\t\t    1,332,556\n")
      content = content.concat("8. Imperium\t\t1,232,556\n")
      content = content.concat("9. Bounce\t\t  1,132,556\n")

      content = content.concat(
        "\u0060\u0060\u0060"
      );

      return content;
    }

    const guildProfile = new EmbedBuilder()
      .setColor(0xffc3c5)
      .setTitle("Saku")
      .setAuthor({ name: "Guild Profile" })
      .setThumbnail(
        "https://cdn.discordapp.com/attachments/1147319860481765500/1149549510066978826/Saku.png"
      )
      .addFields(
        {
          name: "Weekly Score",
          value: "1,589,253",
          inline: true,
        },
        {
          name: "Weekly Rank",
          value: `7`,
          inline: true,
        },
        {
          name: "Participation Rate",
          value: `189/200`,
          inline: true,
        }
      )
      .addFields({
        name: "Weekly Standings",
        value: getPreviousScores(),
        inline: false,
      })
      .setFooter({
        text: "Check guild rankings with /guildrankings • Don't forget to run culvert!",
        iconURL:
          "https://cdn.discordapp.com/attachments/1147319860481765500/1149549510066978826/Saku.png",
      });

      interaction.reply({embeds: [guildProfile]})
  },
};
