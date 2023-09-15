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
    let lifetimeList = [];

    for (const user of users) {
      const totalScore = await culvertSchema.aggregate([
        {
          $unwind: "$characters",
        },
        {
          $unwind: "$characters.scores",
        },
        {
          $match: {
            "characters.name": {
              $regex: `^${user.characters.name}`,
              $options: "i",
            },
          },
        },
        {
          $group: {
            _id: null,
            total_score: {
              $sum: "$characters.scores.score",
            },
          },
        },
      ]);
      lifetimeList.push({
        name: user.characters.name,
        score: totalScore[0]?.total_score,
      });
    }

    // Sort the array of lifetime scores
    lifetimeList.sort((a, b) => {
      if (a.score === undefined) {
        return -1;
      }
      if (b.score === undefined) {
        return 1;
      }
      return a.score - b.score;
    });

    // Create the wos list embed field
    let firstRank = 0;
    let lastRank = 8;
    let page = 1;
    let placement = 1;
    const maxPage = Math.ceil(lifetimeList.length / 8);

    function getLifetimeRank() {
      let content = "\u0060\u0060\u0060";

      let padding = 20;

      for (let i = firstRank; i < lastRank; i++) {
        if (placement > 9) padding = 19; // Adjust padding based on placement length
        if (placement > 99) padding = 18;
        if (lifetimeList[i]?.name) { 
          content = content.concat(
            `${placement}. ${lifetimeList[i].name.padEnd(padding, " ")}${
              lifetimeList[i].score?.toLocaleString("en-US") || 0
            }\n`
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
