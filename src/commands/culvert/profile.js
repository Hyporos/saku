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

  async execute(client, interaction) {
    const selectedCharacter = interaction.options.getString("character");

    const user = await culvertSchema.findOne(
      { "characters.name": selectedCharacter },
      { "characters.$": 1 }
    );

    const totalScore = await culvertSchema.aggregate([
      { $unwind: "$characters" },
      { $unwind: "$characters.scores" },
      { $match: { "characters.name": selectedCharacter } },
      {
        $group: {
          _id: null,
          total_score: {
            $sum: "$characters.scores.score",
          },
        },
      },
    ]);

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

    const scores = user.characters[0].scores;
    const latestScore = user.characters[0].scores.length;

    try {
      console.log(bestScore);
      const success = new EmbedBuilder()
        .setColor(0xffc3c5)
        .setTitle(user.characters[0].name)
        .setDescription("Saku Culvert Stats")
        .setThumbnail(
          "https://i.mapleranks.com/u/IHPLFBDDCCGNPIFMLMIACBEPIPELOHEJFNKMOHAIODAJLGEBOHAKNKFLPLACFHCIHAJGHCOHAKABMCNECAIFAPCNKDDEBODIMONAKNMDDGNDHCLOFMIBHKBANOGALHGCPMLPNILOBPHIEACPMDLNLLMMFMNPHOKAJICIDAOFOAINKEJAFMMLGKLFLJOCLPCOJLOJPOIFLJIAAINMBJEIMGMECAFFHACPODAAEBAFKMBIKCHMKABJCAEDMADJCDHF.png"
        )
        .addFields(
          { name: "Class", value: "Hero", inline: true },
          { name: "Level", value: "276", inline: true },
          { name: "Rank", value: "Bloom", inline: true }
        )
        .addFields({
          name: "Recent Scores", // Bad practice. Duplicate code. Unsure how to implement a for loop here
          value: `\u0060\u0060\u0060${scores[latestScore - 1]?.date || null}: ${
            scores[latestScore - 1]?.score || 0
          }\n${scores[latestScore - 2]?.date || null}: ${
            scores[latestScore - 2]?.score || 0
          }\n${scores[latestScore - 3]?.date || null}: ${
            scores[latestScore - 3]?.score || 0
          }\n${scores[latestScore - 4]?.date || null}: ${
            scores[latestScore - 4]?.score || 0
          }\n\u0060\u0060\u0060`,
          inline: false,
        })
        .addFields(
          {
            name: "Personal Best",
            value: String(bestScore[0].characters.scores[0].score),
            inline: true,
          },
          {
            name: "Total Score",
            value: String(totalScore[0].total_score),
            inline: true,
          },
          { name: "Participation", value: "14/20 (70%)", inline: true }
        );
      interaction.reply({ embeds: [success] });
    } catch (error) {
      console.log(error);
      interaction.reply({
        content: `${error}`,
      });
    }
  },
};
