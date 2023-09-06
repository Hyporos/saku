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

    const personalBest = await culvertSchema
      .findOne({ "characters.name": selectedCharacter })
      .sort({ "characters.scores.score": -1 })
      .limit(1);

    const personal = await culvertSchema.aggregate([
      { $match: { "characters.name": selectedCharacter } },
      { $unwind: "$characters" },
      { $sort: { "characters.scores.score": -1 } },
      { $limit: 1 },
    ]);

    const scores = user.characters[0].scores;
    const latestScore = user.characters[0].scores.length;

    try {
      console.log(personal.characters[0].scores[0].score);
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
            value: String(personal.characters[0].scores[0].score),
            inline: true,
          },
          { name: "Total Score", value: "57388", inline: true },
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
