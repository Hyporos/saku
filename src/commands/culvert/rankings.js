const {
  SlashCommandBuilder,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  ComponentType,
} = require("discord.js");
const {
  getAllCharacters,
  getResetDates,
} = require("../../utility/culvertUtils.js");
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
          { name: "Yearly", value: "yearly" }
        )
    ),

  // ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

  async execute(interaction) {
    // Parse the command arguments
    const category = interaction.options.getString("timeframe");

    // Command may take longer to execute. Defer the initial reply.
    await interaction.deferReply();

    // Create pagination buttons and action row
    const previous = new ButtonBuilder()
      .setCustomId("previous")
      .setEmoji("<:singleleftchevron:1286237594707038220>")
      .setStyle(ButtonStyle.Primary);

    const next = new ButtonBuilder()
      .setCustomId("next")
      .setEmoji("<:singlerightchevron:1286237595629649970>")
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

    // Get the last reset and next reset dates (Thursday 12:00 AM UTC)
    const { lastReset, nextReset } = getResetDates();

    // Get a list of all currently linked characters
    const characterList = await getAllCharacters();

    // Calculate the sum of weekly character scores
    const weeklyScoresList = characterList.reduce((list, character) => {
      const scoreInput = character.scores.find(
        (score) => score.date === lastReset
      );

      if (scoreInput) {
        list.push({
          name: character.name,
          score: scoreInput.score, // TODO: make this score ?? 0
        });
      } else {
        list.push({
          name: character.name,
          score: 0,
        });
      }

      return list;
    }, []);

    // Sort the list of characters in ascending order (weekly score)
    weeklyScoresList.sort((a, b) => {
      if (a.score === undefined) return 1;
      if (b.score === undefined) return -1;

      return b.score - a.score;
    });

    // Set placements for each character, based on weekly scores
    weeklyScoresList.forEach((character, index) => {
      character.placement = index + 1;
    });

    // Create the weekly rankings list embed field
    let firstPlacement = 0;
    let lastPlacement = 8;

    function getWeeklyRankings() {
      let content = "\u0060\u0060\u0060";

      for (let i = firstPlacement; i < lastPlacement; i++) {
        const character = weeklyScoresList[i];
        if (!character?.name) break;

        // Adjust text padding based on placement length
        let padding = 20;
        if (character.placement > 99) padding = 18;
        if (character.placement > 9) padding = 19;

        const characterInfo = `${character.placement}. ${weeklyScoresList[
          i
        ].name.padEnd(padding, " ")}${
          weeklyScoresList[i].score?.toLocaleString() || 0
        }\n`;
        content += characterInfo;
      }
      return content.concat("\u0060\u0060\u0060");
    }

    // Get the time remaining until the next weekly update
    function getWeeklyUpdateTime() {
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

    // Create a list of characters with their yearly scores
    const yearlyScoresList = characterList.reduce((list, character) => {
      // Sort the character scores, most recent first
      const sortedScores = character.scores.sort((a, b) => b.date - a.date);

      // Get the last 52 scores (one year)
      const recentScores = sortedScores.slice(0, 52);
      const totalScore = recentScores.reduce(
        (sum, scoreInput) => sum + scoreInput.score,
        0
      );

      list.push({
        name: character.name,
        score: totalScore,
      });

      return list;
    }, []);

    // Sort the list of characters in ascending order (yearly score)
    yearlyScoresList.sort((a, b) => {
      if (a.score === undefined) return 1;
      if (b.score === undefined) return -1;

      return b.score - a.score;
    });

    // Set placements for each character, based on yearly scores
    yearlyScoresList.forEach((character, index) => {
      character.placement = index + 1;
    });

    // Create the placement fields for the yearly ranking list
    function getYearlyRankings() {
      let content = "\u0060\u0060\u0060";

      for (let i = firstPlacement; i < lastPlacement; i++) {
        const character = yearlyScoresList[i];
        if (!character?.name) break;

        // Adjust text padding based on placement length
        let padding = 20;
        if (character.placement > 99) padding = 18;
        if (character.placement > 9) padding = 19;

        const characterInfo = `${character.placement}. ${yearlyScoresList[
          i
        ].name.padEnd(padding, " ")}${
          yearlyScoresList[i].score?.toLocaleString() || 0
        }\n`;
        content += characterInfo;
      }
      return content.concat("\u0060\u0060\u0060");
    }

    // Original embed
    let page = 1;
    const maxPage = Math.ceil(yearlyScoresList.length / 8);

    function createRankingsEmbed(page, maxPage) {
      return new EmbedBuilder()
        .setColor(0xffc3c5)
        .setAuthor({ name: "Culvert Rankings" })
        .addFields({
          name: `${
            category === "weekly"
              ? `Weekly Score (${lastReset})`
              : "Yearly Score (Last 52 weeks)"
          }`,
          value: `${
            category === "weekly" ? getWeeklyRankings() : getYearlyRankings()
          }`,
          inline: false,
        })
        .setFooter({
          text: `Page ${page}/${maxPage} ${
            category === "weekly" ? `• Updates in ${getWeeklyUpdateTime()}` : ""
          }`,
        });
    }

    // Disable the first/previous buttons on initial render
    if (page === 1) {
      first.setDisabled(true);
      previous.setDisabled(true);
    }

    // Display the initial ranking embed
    const response = await interaction.editReply({
      embeds: [createRankingsEmbed(page, maxPage)],
      components: [pagination],
    });

    // Create a collector to handle the pagination buttons
    const collector = response.createMessageComponentCollector({
      componentType: ComponentType.Button,
      filter: (i) => i.user.id === interaction.user.id, // Only allow the initiator of the command to use the buttons
      idle: 120000, // After 2 minutes, turn off the buttons
    });

    // Handle button presses via the collector
    collector.on("collect", async (interaction) => {
      // Handle pagination, placement accuracy
      if (interaction.customId === "previous") {
        if (page > 1) {
          page--;
          firstPlacement -= 8;
          lastPlacement -= 8;
        }
      } else if (interaction.customId === "next") {
        if (page < maxPage) {
          page++;
          firstPlacement += 8;
          lastPlacement += 8;
        }
      } else if (interaction.customId === "first") {
        page = 1;
        firstPlacement = 0;
        lastPlacement = 8;
      } else if (interaction.customId === "last") {
        page = maxPage;
        firstPlacement = maxPage * 8 - 8;
        lastPlacement = maxPage * 8;
      }

      // Disable buttons if they do not serve any purpose (already at first or last page)
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

      // Display the previous/next page
      await interaction.deferUpdate();

      await interaction.editReply({
        embeds: [createRankingsEmbed(page, maxPage)],
        components: [pagination],
      });
    });

    // Handle the end of the collector (after 2 minutes of idle)
    collector.on("end", () => {
      previous.setDisabled(true);
      next.setDisabled(true);
      first.setDisabled(true);
      last.setDisabled(true);

      interaction.editReply({
        embeds: [createRankingsEmbed(page, maxPage)],
        components: [pagination],
      });
    });
  },
};
