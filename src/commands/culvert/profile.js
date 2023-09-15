const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const culvertSchema = require("../../culvertSchema.js");
const dayjs = require("dayjs");

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

module.exports = {
  data: new SlashCommandBuilder()
    .setName("profile")
    .setDescription("Preview the culvert profile of a user")
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

  async execute(client, interaction) {
    const selectedCharacter = interaction.options.getString("character");

    // Day of the week the culvert score gets reset (sunday)
    const reset = dayjs().day(0).format("YYYY-MM-DD");

    // Find the character with the given name
    const user = await culvertSchema.findOne(
      {
        "characters.name": { $regex: `^${selectedCharacter}$`, $options: "i" },
      }
    );

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

    // Create the 'previous scores' embed field
    function getPreviousScores() {
      const scores = user.characters[0].scores;

      let notSubmitted = false;

      let content = "\u0060\u0060\u0060";

      // If the user has not submitted a score for this week, pretend it's 0.
      if (user.characters[0].scores[scores.length - 1].date !== reset) {
        content = content.concat(
          scores[scores.length - 1].date,
          ": ",
          scores[scores.length - 1].score,
          "\n"
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
          content = content.concat(scores[i].date, ": ", scores[i].score, "\n");
      }

      // If no scores found, display an empty box
      content = content.concat(
        scores.length > 1 ? "\u0060\u0060\u0060" : " \u0060\u0060\u0060"
      );

      return content;
    }

    // Create and display a profile embed for the selected character (if they exist)
    try {
      const profile = new EmbedBuilder()
        .setColor(0xffc3c5)
        .setTitle(user.characters[0].name)
        .setAuthor({ name: "Culvert Profile" })
        .setURL(
          `https://maplestory.nexon.net/rankings/overall-ranking/legendary?rebootIndex=1&character_name=${user.characters[0].name}&search=true`
        )
        .setThumbnail(user.characters[0].avatar)
        .addFields(
          {
            name: "Class",
            value: user.characters[0].class,
            inline: true,
          },
          {
            name: "Level",
            value: `${user.characters[0].level}`,
            inline: true,
          },
          {
            name: "Member Since",
            value: `${user.characters[0].joinDate}`,
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
                  ]?.score || "0"
            }`,
            inline: true,
          },
          {
            name: "Weekly Rank",
            value: `17`,
            inline: true,
          },
          {
            name: "Personal Best",
            value: `${bestScore[0].characters.scores[0]?.score || "0"}`,
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
            value: `${totalScore[0]?.total_score || "0"}`,
            inline: true,
          },
          {
            name: "Lifetime Rank",
            value: `20`,
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
          text: "Submit scores with /gpq  •  Visualize progress with /graph",
          iconURL:
            "https://cdn.discordapp.com/attachments/1147319860481765500/1149549510066978826/Saku.png",
        });
      // Display responses
      interaction.reply({ embeds: [profile] });
    } catch (error) {
      interaction.reply(
        `Error ⎯ The character **${selectedCharacter}** is not linked to any user`
      );
      console.log(error);
    }
  },
};
