const {
  SlashCommandBuilder,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  ComponentType,
} = require("discord.js");
const culvertSchema = require("../../culvertSchema.js");
const dayjs = require("dayjs");

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

module.exports = {
  data: new SlashCommandBuilder()
    .setName("rankings")
    .setDescription("View the culvert leaderboard")
    .addStringOption((option) =>
      option
        .setName("category")
        .setDescription("The leaderboard category")
        .setRequired(true)
        .addChoices(
          { name: "Weekly", value: "weekly" },
          { name: "Lifetime", value: "lifetime" }
        )
    ),

  // ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

  async execute(client, interaction) {
    const category = interaction.options.getString("category");

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

    // Find the name of all characters
    const users = await culvertSchema.aggregate([
      {
        $unwind: "$characters",
      },
    ]);

    // Calculate the sum of lifetime character scores
    let lifetimeList = [];

    for (const user of users) {
      let totalScore = 0;

      for (const scoreObject of user.characters?.scores) {
        totalScore += scoreObject.score;
      }

      lifetimeList.push({
        name: user.characters.name,
        score: totalScore,
      });
    }

    // Sort the array of lifetime scores
    lifetimeList.sort((a, b) => {
      if (a.score === undefined) {
        return 1;
      }
      if (b.score === undefined) {
        return -1;
      }
      return b.score - a.score;
    });

    // Calculate the sum of weekly character scores
    let weeklyList = [];

    for (const user of users) {
      const scoreObject = user.characters.scores.find(
        (score) => score.date === dayjs().day(-7).format("YYYY-MM-DD")
      );

      if (scoreObject) {
        weeklyList.push({
          name: user.characters.name,
          score: scoreObject.score,
        });
      } else {
        weeklyList.push({
          name: user.characters.name,
          score: 0,
        });
      }
    }

    // Sort the array of weekly scores
    weeklyList.sort((a, b) => {
      if (a.score === undefined) {
        return 1;
      }
      if (b.score === undefined) {
        return -1;
      }
      return b.score - a.score;
    });

    // Initialize embed variables
    let firstRank = 0;
    let lastRank = 8;
    let page = 1;
    let placement = 1;
    const maxPage = Math.ceil(lifetimeList.length / 8);
    const nextUpdate = dayjs().day(7).diff(dayjs(), "day");

    // Create the lifetime rankings list embed field
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

    // Create the weekly rankings list embed field
    function getWeeklyRank() {
      let content = "\u0060\u0060\u0060";

      let padding = 20;

      for (let i = firstRank; i < lastRank; i++) {
        if (placement > 9) padding = 19; // Adjust padding based on placement length
        if (placement > 99) padding = 18;
        if (weeklyList[i]?.name) {
          content = content.concat(
            `${placement}. ${weeklyList[i].name.padEnd(padding, " ")}${
              weeklyList[i].score?.toLocaleString("en-US") || 0
            }\n`
          );
        }

        placement++;
      }
      return content.concat("\u0060\u0060\u0060");
    }

    // Original embed
    const rankings = new EmbedBuilder()
      .setColor(0xffc3c5)
      .setAuthor({ name: "Culvert Rankings" })
      .addFields({
        name: `${
          category === "weekly"
            ? `Weekly Score (${dayjs().day(-7).format("YYYY-MM-DD")})`
            : "Lifetime Score"
        }`,
        value: `${category === "weekly" ? getWeeklyRank() : getLifetimeRank()}`,
        inline: false,
      })
      .setFooter({
        text: `Page ${page}/${maxPage} ${
          category === "weekly" ? `• Updates in ${nextUpdate} days` : ""
        }`,
      });

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
        .setColor(0xffc3c5)
        .setAuthor({ name: "Culvert Rankings" })
        .addFields({
          name: `${
            category === "weekly"
              ? `Weekly Score (${dayjs().day(-7).format("YYYY-MM-DD")})`
              : "Lifetime Score"
          }`,
          value: `${
            category === "weekly" ? getWeeklyRank() : getLifetimeRank()
          }`,
          inline: false,
        })
        .setFooter({
          text: `Page ${page}/${maxPage} ${
            category === "weekly" ? `• Updates in ${nextUpdate} days` : ""
          }`,
        });

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
        .setColor(0xffc3c5)
        .setAuthor({ name: "Culvert Rankings" })
        .addFields({
          name: `${
            category === "weekly"
              ? `Weekly Score (${dayjs().day(-7).format("YYYY-MM-DD")})`
              : "Lifetime Score"
          }`,
          value: `${
            category === "weekly" ? getWeeklyRank() : getLifetimeRank()
          }`,
          inline: false,
        })
        .setFooter({
          text: `Page ${page}/${maxPage} ${
            category === "weekly" ? `• Updates in ${nextUpdate} days` : ""
          }`,
        });

      interaction.editReply({
        embeds: [rankingsUpdate],
        components: [pagination],
      });
    });
  },
};
