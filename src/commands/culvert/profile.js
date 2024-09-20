const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const culvertSchema = require("../../culvertSchema.js");
const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const updateLocale = require("dayjs/plugin/updateLocale");
dayjs.extend(utc); // ? needed in all files?
dayjs.extend(updateLocale);
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
    const selectedCharacter = interaction.options.getString("character");

    // Set the day of the week that the culvert score gets reset (Wednesday)
    dayjs.updateLocale("en", {
      weekStart: 4,
    });

    const reset = dayjs()
      .utc()
      .startOf("week")
      .subtract(1, "day")
      .format("YYYY-MM-DD");

    const lastReset = dayjs()
      .utc()
      .startOf("week")
      .subtract(8, "day")
      .format("YYYY-MM-DD");

    // Find the character with the given name
    const user = await culvertSchema.findOne(
      {
        "characters.name": { $regex: `^${selectedCharacter}$`, $options: "i" },
      },
      { "characters.$": 1 }
    );

    if (!user?.characters[0]) {
      return interaction.reply(
        `Error - The character **${selectedCharacter}** is not linked to any user`
      );
    }

    // Find the name of all characters
    const users = await culvertSchema.aggregate([
      {
        $unwind: "$characters",
      },
    ]);

    // Calculate the sum of character scores
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
            $regex: `^${selectedCharacter}$`,
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

    // Find the biggest (best) score of the character
    const bestScore = await culvertSchema.aggregate([
      {
        $unwind: "$characters",
      },
      {
        $match: {
          "characters.name": {
            $regex: `^${selectedCharacter}$`,
            $options: "i",
          },
        },
      },
      {
        $set: {
          "characters.scores": {
            $sortArray: {
              input: "$characters.scores",
              sortBy: {
                score: -1,
              },
            },
          },
        },
      },
    ]);

    // Calculate the total number of weeks since a character has been linked
    const totalWeeks = await culvertSchema.aggregate([
      {
        $unwind: "$characters",
      },
      {
        $unwind: "$characters.scores",
      },
      {
        $match: {
          "characters.name": {
            $regex: `^${selectedCharacter}$`,
            $options: "i",
          },
        },
      },
    ]);

    // Calculate the particiation ratio of the character by returning the score objects greater than 0
    const participationRatio = await culvertSchema.aggregate([
      {
        $unwind: "$characters",
      },
      {
        $unwind: "$characters.scores",
      },
      {
        $match: {
          "characters.name": {
            $regex: `^${selectedCharacter}$`,
            $options: "i",
          },
          "characters.scores.score": { $gt: 0 },
        },
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

    // Get the weekly and lifetime rank of the character
    const weeklyRank =
      weeklyList.findIndex(
        (character) =>
          character.name.toLowerCase() === selectedCharacter.toLowerCase()
      ) + 1;
    const lifetimeRank =
      lifetimeList.findIndex(
        (character) =>
          character.name.toLowerCase() === selectedCharacter.toLowerCase()
      ) + 1;

    // Create the 'previous scores' embed field
    function getPreviousScores() {
      const scores = user.characters[0].scores;

      scores.sort(function(a,b){
        return new Date(a.date) - new Date(b.date);
      });

      let notSubmitted = false;

      let content = "\u0060\u0060\u0060";

      // If the user has not submitted a score for this week, pretend it's 0.
      if (
        scores[0] &&
        user.characters[0].scores[scores.length - 1]?.date !== reset
      ) {
        content = content.concat(
          scores[scores.length - 1]?.date,
          ": ",
          scores[scores.length - 1].score?.toLocaleString("en-US"),
          scores.length !== 1 ? "\n" : ""
        );
        notSubmitted = true;
      }
      for (
        let i = scores.length - 2;
        i >= scores.length - (!notSubmitted ? 5 : 4);
        i--
      ) {
        // Only grab the last 3/4 scores before this week
        if (scores[i])
          content = content.concat(
            scores[i].date,
            ": ",
            scores[i].score.toLocaleString("en-US"),
            scores.length !== 1 ? "\n" : ""
          );
      }

      // If no scores found, display an empty box
      content = content.concat(
        scores.length > 1 ? "\u0060\u0060\u0060" : " \u0060\u0060\u0060"
      );

      return content;
    }

      // Ranking API
      const url = `https://www.nexon.com/api/maplestory/no-auth/v1/ranking/na?type=overall&id=legendary&reboot_index=1&page_index=1&character_name=${selectedCharacter}`;

    // Create and display a profile embed for the selected character (if they exist)
    try {
      axios.get(url).then(async function (res) {
        const profile = new EmbedBuilder()
          .setColor(0xffc3c5)
          .setTitle(user.characters[0]?.name || "")
          .setAuthor({ name: "Culvert Profile" })
          .setURL(
            `https://www.nexon.com/maplestory/rankings/north-america/overall-ranking/legendary?world_type=heroic&search_type=character-name&search=${user.characters[0]?.name}`
          )
          .setThumbnail(
            "https://i.mapleranks.com/u/" +
              (res.data.ranks && res.data.ranks[0]?.characterImgURL.slice(38)) || "a.png"
          )
          .addFields(
            {
              name: "Class",
              value: user.characters[0].class,
              inline: true,
            },
            {
              name: "Level",
              value: `${(res.data.ranks && res.data.ranks[0]?.level) || "?"}`,
              inline: true,
            },
            {
              name: "Member Since",
              value: `${dayjs(user.characters[0].memberSince).format(
                "MMM DD, YYYY"
              )}`,
              inline: true,
            }
          )
          .addFields(
            {
              name: "Current Score",
              value: `${
                user.characters[0].scores[user.characters[0].scores.length - 1]
                  ?.date !== reset
                  ? 0
                  : user.characters[0].scores[
                      user.characters[0].scores.length - 1
                    ].score?.toLocaleString("en-US") || "0"
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
              value: `${
                bestScore[0].characters.scores[0]?.score.toLocaleString(
                  "en-US"
                ) || "0"
              }`,
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
              name: "Lifetime Score",
              value: `${
                totalScore[0]?.total_score.toLocaleString("en-US") || "0"
              }`,
              inline: true,
            },
            {
              name: "Lifetime Rank",
              value: `${lifetimeRank}`,
              inline: true,
            },
            {
              name: "Participation",
              value: `${participationRatio.length}/${
                totalWeeks.length
              } (${Math.round(
                (participationRatio.length / totalWeeks.length || 0) * 100
              )}%)`,
              inline: true,
            }
          )
          .setFooter({
            text: "Submit scores with /gpq • Visualize progress with /graph",
            iconURL:
              "https://cdn.discordapp.com/attachments/1147319860481765500/1149549510066978826/Saku.png",
          });
        // Display responses
        interaction.reply({ embeds: [profile] });
      });
    } catch (error) {
      interaction.reply(
        `Error - The character **${selectedCharacter}** could not be fetched from the API`
      );
      console.error(error);
    }
  },
};
