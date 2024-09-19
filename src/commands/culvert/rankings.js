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
const utc = require("dayjs/plugin/utc");
const updateLocale = require("dayjs/plugin/updateLocale");
dayjs.extend(utc);
dayjs.extend(updateLocale);

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

module.exports = {
  data: new SlashCommandBuilder()
    .setName("rankings")
    .setDescription("View the culvert leaderboard")
    .addStringOption((option) =>
      option
        .setName("timeframe")
        .setDescription("The timeframe that the leaderboard will display")
        .setRequired(true)
        .addChoices(
          { name: "Weekly", value: "weekly" },
          { name: "Lifetime", value: "lifetime" }
        )
    ),

  // ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

  async execute(interaction) {
    const category = interaction.options.getString("timeframe");

    // Command may take longer to execute. Defer the initial reply.
    await interaction.deferReply();

    // Create buttons & row
    const previous = new ButtonBuilder()
      .setCustomId("previous")
      .setEmoji("<:singleleftchevron:1193783932366372907>")
      .setStyle(ButtonStyle.Primary);

    const next = new ButtonBuilder()
      .setCustomId("next")
      .setEmoji("<:singlerightchevron:1193783934052470835>")
      .setStyle(ButtonStyle.Primary);

    const first = new ButtonBuilder()
      .setCustomId("first")
      .setEmoji("<:doubleleftchevron:1193783344996024350>")
      .setStyle(ButtonStyle.Secondary);

    const last = new ButtonBuilder()
      .setCustomId("last")
      .setEmoji("<:doublerightchevron:1193783935071682591>")
      .setStyle(ButtonStyle.Secondary);

    const pagination = new ActionRowBuilder().addComponents(
      first,
      previous,
      next,
      last
    );

    // Last reset
    dayjs.updateLocale("en", {
      weekStart: 4,
    });

    const lastReset = dayjs()
      .utc()
      .startOf("week")
      .subtract(8, "day")
      .format("YYYY-MM-DD");

    const nextReset = dayjs().utc().startOf("week").add(7, "day");

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
        // make this return (b.score ?? 0) - (a.score ?? 0)
        return -1;
      }
      return b.score - a.score;
    });

    // Calculate the sum of weekly character scores
    let weeklyList = [];

    for (const user of users) {
      const scoreObject = user.characters.scores.find(
        (score) => score.date === lastReset
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

    // Handle update time
    function getUpdateTime() {
      const nextUpdateDays = dayjs(nextReset).diff(dayjs().utc(), "day");
      const nextUpdateHours = dayjs(nextReset).diff(dayjs().utc(), "hour");
      const nextUpdateMinutes = dayjs(nextReset).diff(dayjs().utc(), "minute");

      if (nextUpdateDays >= 1) {
        return `${nextUpdateDays} day${nextUpdateDays > 1 ? "s" : ""}`;
      } else if (nextUpdateHours >= 1) {
        return `${nextUpdateHours} hour${nextUpdateHours > 1 ? "s" : ""}`;
      } else {
        return `${nextUpdateMinutes} minute${nextUpdateMinutes > 1 ? "s" : ""}`;
      }
    }

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

    if (page === 1) {
      first.setDisabled(true);
      previous.setDisabled(true);
    }

    // Original embed
    const rankings = new EmbedBuilder()
      .setColor(0xffc3c5)
      .setAuthor({ name: "Culvert Rankings" })
      .addFields({
        name: `${
          category === "weekly"
            ? `Weekly Score (${lastReset})`
            : "Lifetime Score"
        }`,
        value: `${category === "weekly" ? getWeeklyRank() : getLifetimeRank()}`,
        inline: false,
      })
      .setFooter({
        text: `Page ${page}/${maxPage} ${
          category === "weekly" ? `• Updates in ${getUpdateTime()}` : ""
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
          page++;
          firstRank += 8;
          lastRank += 8;
        }
      } else if (interaction.customId === "first") {
        placement = 1;
        firstRank = 0;
        lastRank = 8;
        page = 1;
      } else if (interaction.customId === "last") {
        placement += 8 * (maxPage - page - 1);
        firstRank += 8 * (maxPage - page);
        lastRank += 8 * (maxPage - page);
        page = maxPage;
      }

      if (page === 1) {
        first.setDisabled(true);
        previous.setDisabled(true);
      } else {
        first.setDisabled(false);
        previous.setDisabled(false);
      }

      if (page === maxPage) {
        last.setDisabled(true);
        next.setDisabled(true);
      } else {
        last.setDisabled(false);
        next.setDisabled(false);
      }

      // New updated embed object // ! This should not be duplicated
      const rankingsUpdate = new EmbedBuilder()
        .setColor(0xffc3c5)
        .setAuthor({ name: "Culvert Rankings" })
        .addFields({
          name: `${
            category === "weekly"
              ? `Weekly Score (${lastReset})`
              : "Lifetime Score"
          }`,
          value: `${
            category === "weekly" ? getWeeklyRank() : getLifetimeRank()
          }`,
          inline: false,
        })
        .setFooter({
          text: `Page ${page}/${maxPage} ${
            category === "weekly" ? `• Updates in ${getUpdateTime()}` : ""
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
      first.setDisabled(true);
      last.setDisabled(true);

      placement -= 8; // TODO: Figure out why this even goes up +8 when it disables

      // New updated embed object // ! This should not be duplicated
      const rankingsUpdate = new EmbedBuilder()
        .setColor(0xffc3c5)
        .setAuthor({ name: "Culvert Rankings" })
        .addFields({
          name: `${
            category === "weekly"
              ? `Weekly Score (${lastReset})`
              : "Lifetime Score"
          }`,
          value: `${
            category === "weekly" ? getWeeklyRank() : getLifetimeRank()
          }`,
          inline: false,
        })
        .setFooter({
          text: `Page ${page}/${maxPage} ${
            category === "weekly" ? `• Updates in ${getUpdateTime()}` : ""
          }`,
        });

      interaction.editReply({
        embeds: [rankingsUpdate],
        components: [pagination],
      });
    });
  },
};
