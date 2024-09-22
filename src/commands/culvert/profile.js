const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const culvertSchema = require("../../schemas/culvertSchema.js");
const {
  findCharacter,
  getResetDates,
} = require("../../utility/culvertUtils.js");
const dayjs = require("dayjs");
const axios = require("axios");

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

module.exports = {
  data: new SlashCommandBuilder()
    .setName("profile")
    .setDescription("View the culvert profile of a user")
    .addStringOption((option) =>
      option
        .setName("character")
        .setDescription("The character's profile to be viewed")
        .setRequired(true)
        .setAutocomplete(true)
    ),

  // ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

  async autocomplete(interaction) {
    const user = await culvertSchema.findById(
      interaction.user.id,
      "characters"
    );

    const value = interaction.options.getFocused().toLowerCase();

    let choices = [];

    user.characters.forEach((character) => {
      choices.push(character.name);
    });

    const filtered = choices
      .filter((choice) => choice.toLowerCase().includes(value))
      .slice(0, 25);

    await interaction.respond(
      filtered.map((choice) => ({ name: choice, value: choice }))
    );
  },

  // ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

  async execute(interaction) {
    // Parse the command arguments
    const characterOption = interaction.options.getString("character");

    // Get the last reset current reset dates (Thursday 12:00 AM UTC)
    const { lastReset, reset } = getResetDates();

    // Find the specified character
    const character = await findCharacter(interaction, characterOption);
    if (!character) return;

    // Get and sort all scores by date, from oldest to newest
    const scores = character.scores;

    scores.sort((a, b) => new Date(a.date) - new Date(b.date));

    // Calculate the characters total score for the past year (52 weeks)
    const last52Scores = scores.slice(-52);

    const totalScore = last52Scores.reduce(
      (sum, score) => sum + score.score,
      0
    );

    // Find the character's best (highest) score
    const sortedScores = [...scores].sort((a, b) => b.score - a.score);
    const bestScore = sortedScores[0]?.score || 0;

    // Get the participation ratio of the character
    const submittedWeeks = scores.filter((score) => score.score > 0);
    const participationRatio = Math.round(
      (submittedWeeks.length / scores.length) * 100
    );

    // Get all character objects
    const users = await culvertSchema.aggregate([
      {
        $unwind: "$characters",
      },
    ]);

    // Create a list of characters with their weekly scores
    const weeklyScoresList = users.map((user) => {
      // Get the score submitted for last reset
      const scoreInput = user.characters.scores.find(
        (score) => score.date === lastReset
      );

      return {
        name: user.characters.name,
        score: scoreInput ? scoreInput.score : 0,
      };
    });

    // Sort the list of characters in ascending order (weekly score)
    weeklyScoresList.sort((a, b) => (b.score || 0) - (a.score || 0));

    // Create a list of characters with their yearly scores
    const yearlyScoresList = users.map((user) => {
      // Get the last 52 scores (one year)
      const recentScores = user.characters.scores.slice(-52);
      const totalScore = recentScores.reduce(
        (sum, scoreInput) => sum + scoreInput.score,
        0
      );

      return {
        name: user.characters.name,
        score: totalScore,
      };
    });

    // Sort the list of characters in ascending order (yearly score)
    yearlyScoresList.sort((a, b) => (b.score || 0) - (a.score || 0));

    // Get the weekly and yearly rank of the character
    const weeklyRank =
      weeklyScoresList.findIndex(
        (character) =>
          character.name.toLowerCase() === characterOption.toLowerCase()
      ) + 1;

    const yearlyRank =
      yearlyScoresList.findIndex(
        (character) =>
          character.name.toLowerCase() === characterOption.toLowerCase()
      ) + 1;

    // Create the 'previous scores' embed field
    function getPreviousScores() {
      let notSubmitted = false;

      let content = "\u0060\u0060\u0060";

      // If the user has not submitted a score for this week, count it as a 0 (fill in "Current Score" with 0)
      if (scores[0] && scores[scores.length - 1]?.date !== reset) {
        content = content.concat(
          scores[scores.length - 1]?.date,
          ": ",
          scores[scores.length - 1].score?.toLocaleString(),
          scores.length !== 1 ? "\n" : ""
        );
        notSubmitted = true;
      }

      // Determine how many previous scores to show (3 or 4 more depending on whether or not user has submitted this week)
      for (
        let i = scores.length - 2;
        i >= scores.length - (!notSubmitted ? 5 : 4);
        i--
      ) {
        if (scores[i])
          content = content.concat(
            scores[i].date,
            ": ",
            scores[i].score.toLocaleString(),
            scores.length !== 1 ? "\n" : ""
          );
      }

      // If no scores found, display an empty box
      content = content.concat(
        scores.length > 1 ? "\u0060\u0060\u0060" : " \u0060\u0060\u0060"
      );

      return content;
    }

    // Fetch Maplestory ranking data
    const url = `https://www.nexon.com/api/maplestory/no-auth/v1/ranking/na?type=overall&id=legendary&reboot_index=1&page_index=1&character_name=${characterOption}`;

    try {
      axios.get(url).then(async function (res) {
        // Create and display a profile embed for the selected character
        const profile = new EmbedBuilder()
          .setColor(0xffc3c5)
          .setTitle(character.name || "")
          .setAuthor({ name: "Culvert Profile" })
          .setURL(
            `https://www.nexon.com/maplestory/rankings/north-america/overall-ranking/legendary?world_type=heroic&search_type=character-name&search=${character.name}`
          )
          .setThumbnail(
            "https://i.mapleranks.com/u/" +
              (res.data.ranks &&
                res.data.ranks[0]?.characterImgURL.slice(38)) || "a.png"
          )
          .addFields(
            {
              name: "Class",
              value: character.class,
              inline: true,
            },
            {
              name: "Level",
              value: `${(res.data.ranks && res.data.ranks[0]?.level) || "?"}`,
              inline: true,
            },
            {
              name: "Member Since",
              value: `${dayjs(character.memberSince).format("MMM DD, YYYY")}`,
              inline: true,
            }
          )
          .addFields(
            {
              name: "Current Score",
              value: `${
                scores[scores.length - 1]?.date === reset
                  ? scores[scores.length - 1]?.score.toLocaleString() || "0"
                  : 0
              }`,
              inline: true,
            },
            {
              name: "Weekly Rank",
              value: `${weeklyRank}`,
              inline: true,
            },
            {
              name: "Personal Best",
              value: `${bestScore.toLocaleString() || "0"}`,
              inline: true,
            }
          )
          .addFields({
            name: "Previous Scores",
            value: getPreviousScores(),
            inline: false,
          })
          .addFields(
            {
              name: "Yearly Score",
              value: `${totalScore.toLocaleString() || "0"}`,
              inline: true,
            },
            {
              name: "Yearly Rank",
              value: `${yearlyRank}`,
              inline: true,
            },
            {
              name: "Participation",
              value: `${submittedWeeks.length}/${scores.length || 0} (${
                participationRatio || 0
              }%)`,
              inline: true,
            }
          )
          .setFooter({
            text: "Submit scores with /gpq • Visualize progress with /graph",
            iconURL:
              "https://cdn.discordapp.com/attachments/1147319860481765500/1149549510066978826/Saku.png",
          });

        interaction.reply({ embeds: [profile] });
      });
    } catch (error) {
      console.error(error);

      interaction.reply(
        `Error - The character **${characterOption}** could not be found on the rankings`
      );
    }
  },
};
