//TODO - Add a streak system
//TODO - Validate for negative and massive numbers
//TODO - 

const { SlashCommandBuilder } = require("discord.js");
const culvertSchema = require("../../culvertSchema.js");
const dayjs = require("dayjs");

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

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
    //Get option values
    const selectedCharacter = interaction.options.getString("character");
    const culvertScore = interaction.options.getInteger("culvert_score");

    // Day of the week the culvert score gets reset (sunday)
    const reset = String(dayjs().day(0).format("YYYY-MM-DD"));

    // Check if a score has already been set for this week
    const weekLogged = await culvertSchema.aggregate([
      {
        $unwind: "$characters",
      },
      {
        $unwind: "$characters.scores",
      },
      {
        $match: {
          "characters.name": selectedCharacter,
          "characters.scores.date": reset,
        },
      },
    ]);

    // Create or update an existing score on the selected character
    if (weekLogged.length < 1) {
      await culvertSchema.findOneAndUpdate(
        {
          _id: interaction.user.id,
          "characters.name": selectedCharacter,
        },
        {
          $addToSet: {
            "characters.$[nameElem].scores": { score: culvertScore, date: reset },
          },
        },
        {
          arrayFilters: [{ "nameElem.name": selectedCharacter }],
          new: true,
        }
      );
    } else {
      await culvertSchema.findOneAndUpdate(
        {
          _id: interaction.user.id,
          "characters.name": selectedCharacter,
          "characters.scores.date": reset,
        },
        {
          $set: {
            "characters.$[nameElem].scores.$[dateElem].score": culvertScore,
          },
        },
        {
          arrayFilters: [
            { "nameElem.name": selectedCharacter },
            { "dateElem.date": reset },
          ],
          new: true,
        }
      );
    }

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
    let response = "";

    if (!characterLinked && characterExists) {
      response = `Error ⎯ The character **${selectedCharacter}** is not linked to you`;
    } else if (!characterExists) {
      response = `Error ⎯ The character **${selectedCharacter}** has not yet been linked`;
    } else if (weekLogged.length > 0) {
      response = `${selectedCharacter}'s score has been updated to **${culvertScore}** for this week! (${reset})`;
    } else {
      response = `${selectedCharacter} has scored **${culvertScore}** for this week! (${reset})`;
    }

    interaction.reply(response);
  },
};
