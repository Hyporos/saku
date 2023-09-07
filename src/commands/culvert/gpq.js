const { SlashCommandBuilder } = require("discord.js");
const culvertSchema = require("../../culvertSchema.js");
const dayjs = require("dayjs");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("gpq")
    .setDescription("Log your culvert score for this week")
    .addStringOption((option) =>
      option
        .setName("character")
        .setDescription("The character that the score will be logged to")
        .setRequired(true)
        .setAutocomplete(true)
    )
    .addIntegerOption((option) =>
      option
        .setName("culvert_score")
        .setDescription("The culvert score to be logged")
        .setRequired(true)
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
    const culvertScore = interaction.options.getInteger("culvert_score");

    // Day of the week the culvert score gets reset (sunday)
    const reset = String(dayjs().day(0).format("YYYY-MM-DD"));

    // Update character with this weeks score
    await culvertSchema.findOneAndUpdate(
      {
        _id: interaction.user.id,
        "characters.name": selectedCharacter,
      },
      {
        $addToSet: {
          "characters.$[index].scores": { score: culvertScore, date: reset },
        },
      },
      {
        arrayFilters: [{ "index.name": selectedCharacter }],
        new: true,
      }
    );

    // Check if character exists
    const characterExists = await culvertSchema.exists({
      "characters.name": selectedCharacter,
    });

    // Check if character is linked to user
    const characterLinked = await culvertSchema.exists({
      _id: interaction.user.id,
      "characters.name": selectedCharacter,
    });

    // Display responses
    if (!characterLinked && characterExists)
      return interaction.reply(
        `Error ⎯ The character **${selectedCharacter}** is not linked to you`
      );

    if (!characterExists)
      return interaction.reply(
        `Error ⎯ The character **${selectedCharacter}** has not yet been linked`
      );

    return interaction.reply(
      `${selectedCharacter} has scored **${culvertScore}** for this week! (${reset})`
    );
  },
};
