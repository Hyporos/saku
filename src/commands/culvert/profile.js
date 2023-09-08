const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const culvertSchema = require("../../culvertSchema.js");

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
    const selectedCharacter = interaction.options.getString("character");

    // Ranking API
    const url = `https://maplestory.nexon.net/api/ranking?id=overall&id2=legendary&rebootIndex=1&character_name=${selectedCharacter}&page_index=1`;

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

    const scores = user.characters[0].scores;
    const latestScore = user.characters[0].scores.length;

    try {
          const success = new EmbedBuilder()
            .setColor(0xffc3c5)
            .setTitle(user.characters[0].name)
            .setDescription("Saku Culvert Stats")
            .setThumbnail(user.characters[0].avatar || "")
            .addFields(
              {
                name: "Class",
                value: user.characters[0].class || "?",
                inline: true,
              },
              { name: "Level", value: String(user.characters[0].level || "?"), inline: true },
              { name: "Rank", value: "Bloom", inline: true }
            )
            .addFields({
              name: "Recent Scores", // Bad practice. Duplicate code. Unsure how to implement a for loop here
              value: `\u0060\u0060\u0060${
                scores[latestScore - 1]?.date + ": " || "\u2800"
              }${scores[latestScore - 1]?.score || 0}\n${
                scores[latestScore - 2]?.date + ": " || "\u2800"
              }${scores[latestScore - 2]?.score || 0}\n${
                scores[latestScore - 3]?.date + ": " || "\u2800"
              }${scores[latestScore - 3]?.score || 0}\n${
                scores[latestScore - 4]?.date + ": " || "\u2800"
              }${scores[latestScore - 4]?.score || 0}\n\u0060\u0060\u0060`,
              inline: false,
            })
            .addFields(
              {
                name: "Personal Best",
                value: String(bestScore[0].characters.scores[0]?.score || "0"),
                inline: true,
              },
              {
                name: "Total Score",
                value: String(totalScore[0]?.total_score || "0"),
                inline: true,
              },
              {
                name: "Participation",
                value:
                  String(participationRatio.length) +
                  "/" +
                  String(totalWeeks.length) +
                  " (" +
                  String(
                    (participationRatio.length / totalWeeks.length) * 100
                  ) +
                  "%)",
                inline: true,
              }
            )
            .setFooter({
              text: "Submit scores with /gpq  •  Visualize progress with /graph",
              iconURL: "https://cdn.discordapp.com/attachments/1147319860481765500/1149549510066978826/Saku.png",
            });
          interaction.reply({ embeds: [success] });
    } catch (error) {
      console.log(error);
      interaction.reply({
        content: `${error}`,
      });
    }
  },
};
