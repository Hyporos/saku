const {
  SlashCommandBuilder,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  ComponentType,
} = require("discord.js");
const culvertSchema = require("../../culvertSchema.js");

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

module.exports = {
  data: new SlashCommandBuilder()
    .setName("wos")
    .setDescription("View the wall of shame..."),

  // ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

  async execute(client, interaction) {
    // Check if the sender is a Bee
    if (!interaction.member.roles.cache.has("720001044746076181") && interaction.user.id !== "631337640754675725"){
      return interaction.reply("Error ⎯ You do not have permission to use this command")
    }

    await interaction.deferReply();

    // Create buttons & row
    const previous = new ButtonBuilder()
      .setCustomId("previous")
      .setLabel("Prev")
      .setStyle(ButtonStyle.Secondary);

    const next = new ButtonBuilder()
      .setCustomId("next")
      .setLabel("Next")
      .setStyle(ButtonStyle.Secondary);

    const pagination = new ActionRowBuilder().addComponents(previous, next);

    // Find the character with the given name
    const users = await culvertSchema.aggregate([
      {
        $unwind: "$characters",
      },
    ]);

    // Calculate the sum of lifetime character scores
    let shameList = [];

    for (const user of users) {
      const totalScores = user.characters.scores.length;
      let missedScores = 0;

      for (const score of user.characters.scores) {
        if (score.score === 0) {
          missedScores++;
        }
      }

      if (((totalScores - missedScores) / totalScores) * 100 <= 60) {
        shameList.push({
          name: user.characters.name,
          totalScores: totalScores,
          submittedScores: totalScores - missedScores,
          rate: Math.round(((totalScores - missedScores) / totalScores) * 100),
        });
      }
    }

    // Sort the array of lifetime scores
    shameList.sort((a, b) => {
      // If the rate is NaN, move it to the back of the list
      if (isNaN(a.rate)) {
        return 1;
      } else if (isNaN(b.rate)) {
        return -1;
      }

      return a.rate - b.rate || a.totalScores - b.totalScores;
    });

    // Create the wos list embed field
    let firstRank = 0;
    let lastRank = 8;
    let page = 1;
    let placement = 1;
    const maxPage = Math.ceil(shameList.length / 8);

    function getLifetimeRank() {
      let content = "\u0060\u0060\u0060";

      let padding = 20;

      for (let i = firstRank; i < lastRank; i++) {
        if (placement > 9) padding = 19; // Adjust padding based on placement length
        if (placement > 99) padding = 18;
        if (shameList[i]?.name) {
          content = content.concat(
            `${placement}. ${shameList[i].name.padEnd(padding, " ")}${
              shameList[i].submittedScores
            }/${shameList[i].totalScores} (${shameList[i].rate}%)\n`
          );
        }
        placement++;
      }
      return content.concat("\u0060\u0060\u0060");
    }

    // Original embed
    const rankings = new EmbedBuilder()
      .setColor(0xa30d0e)
      .addFields({
        name: "Wall of Shame",
        value: `${getLifetimeRank()}`,
        inline: false,
      })
      .setFooter({ text: `Page ${page}/${maxPage}` });

    // Display responses via button collector
    const response = await interaction.editReply({
      embeds: [rankings],
      components: [pagination],
    });

    const filter = (i) => i.user.id === interaction.user.id;

    const collector = response.createMessageComponentCollector({
      componentType: ComponentType.Button,
      filter,
      idle: 120000,
    });

    collector.on("collect", async (interaction) => {
      // Handle button presses
      if (interaction.customId === "previous") {
        if (page <= 1) {
          placement -= 8; // prevent placement from changing
        } else {
          page--;
          firstRank -= 8;
          lastRank -= 8;
          placement -= 16;
        }
      } else if (interaction.customId === "next") {
        if (page >= maxPage) {
          placement -= 8;
        } else {
          firstRank += 8;
          lastRank += 8;
          page++;
        }
      }

      // New updated embed object // ! This should not be duplicated
      const rankingsUpdate = new EmbedBuilder()
        .setColor(0xa30d0e)
        .addFields({
          name: "Wall of Shame",
          value: `${getLifetimeRank()}`,
          inline: false,
        })
        .setFooter({ text: `Page ${page}/${maxPage}` });

      // Display new page
      await interaction.deferUpdate();

      await interaction.editReply({
        embeds: [rankingsUpdate],
        components: [pagination],
      });

      return;
    });

    // Disable the buttons after 2 minutes of idling
    collector.on("end", () => {
      previous.setDisabled(true);
      next.setDisabled(true);

      placement -= 8; // TODO: Figure out why this even goes up +8 when it disables

      // New updated embed object // ! This should not be duplicated
      const rankingsUpdate = new EmbedBuilder()
        .setColor(0xa30d0e)
        .addFields({
          name: "Wall of Shame",
          value: `${getLifetimeRank()}`,
          inline: false,
        })
        .setFooter({ text: `Page ${page}/${maxPage}` });

      interaction.editReply({
        embeds: [rankingsUpdate],
        components: [pagination],
      });
    });
  },
};
