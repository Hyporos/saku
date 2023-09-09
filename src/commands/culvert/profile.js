//TODO - Handle error when character does not exist

const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const culvertSchema = require("../../culvertSchema.js");

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

module.exports = {
  data: new SlashCommandBuilder()
    .setName("profile")
    .setDescription("Preview a culvert profile")
    .addStringOption((option) =>
      option
        .setName("character")
        .setDescription("The characters profile to be viewed")
        .setRequired(true)
        .setAutocomplete(true)
    ),

  // ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

  async autocomplete(interaction) {
    const user = await culvertSchema
      .findById(interaction.user.id, "characters")
      .exec(); // ?is .exec needed?
    const value = interaction.options.getFocused().toLowerCase();

    let choices = [];

    user.characters.forEach((character) => {
      choices.push(character.name);
    });

    const filtered = choices
      .filter((choice) => choice.toLowerCase().includes(value))
      .slice(0, 25);

    if (!interaction) return; // ? is this needed?

    await interaction.respond(
      filtered.map((choice) => ({ name: choice, value: choice }))
    );
  },

  // ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

  async execute(client, interaction) {
    // Get option values
    const selectedCharacter = interaction.options.getString("character");

    // Find the character with the given name
    const user = await culvertSchema.findOne(
      { "characters.name": selectedCharacter },
      { "characters.$": 1 }
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
        $match: { "characters.name": selectedCharacter },
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
          "characters.name": selectedCharacter,
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
          "characters.name": selectedCharacter,
        },
      },
    ]);

    // Calculate the particiation ratio of the character by returning the score objecte greater than 0
    const participationRatio = await culvertSchema.aggregate([
      {
        $unwind: "$characters",
      },
      {
        $unwind: "$characters.scores",
      },
      {
        $match: {
          "characters.name": selectedCharacter,
          "characters.scores.score": { $gt: 0 },
        },
      },
    ]);

    // Create the 'recent scores' embed field by taking and concatenating the last 4 scores submitted
    function recentScores() {
      const scores = user.characters[0].scores;

      let content = "\u0060\u0060\u0060";

      for (let i = scores.length - 1; i >= scores.length - 4; i--) {
        // Only show the last 4 scores
        if (scores[i])
        content = content.concat(
            scores[i].date,
            ": ",
            scores[i].score,
            "\n"
          );
      }

      if (scores.length > 0) {
        content = content.concat("\u0060\u0060\u0060");
      } else {
        content = content.concat(" \u0060\u0060\u0060"); // If no scores found, display an empty box
      }

      return content;
    }

    // Create and display a profile embed for the selected character (if they exist)
    try {
      const profile = new EmbedBuilder()
        .setColor(0xffc3c5)
        .setTitle(user.characters[0].name)
        .setURL(
          `https://maplestory.nexon.net/rankings/overall-ranking/legendary?rebootIndex=1&character_name=${user.characters[0].name}&search=true`
        )
        .setDescription("Saku Culvert Stats")
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
          { name: "Member Since", value: "2022-04-11", inline: true }
        )
        .addFields({
          name: "Recent Scores",
          value: recentScores(),
          inline: false,
        })
        .addFields(
          {
            name: "Personal Best",
            value: `${bestScore[0].characters.scores[0]?.score || "0"}`,
            inline: true,
          },
          {
            name: "Total Score",
            value: `${totalScore[0]?.total_score || "0"}`,
            inline: true,
          },
          {
            name: "Participation",
            value: `${participationRatio.length}/${totalWeeks.length} (${
              (participationRatio.length / totalWeeks.length || 0) * 100
            }%)`,
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
        `Error ⎯ The character **${selectedCharacter}** has not been linked to any user`
      );
      console.log(error);
    }
  },
};
