const { SlashCommandBuilder } = require("discord.js");
const culvertSchema = require("../../culvertSchema.js");
const dayjs = require ("dayjs");

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

module.exports = {
  data: new SlashCommandBuilder()
    .setName("correct")
    .setDescription("Edit or create a new score for a character")
    .addStringOption((option) =>
      option
        .setName("character")
        .setDescription("The character to be corrected")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("date")
        .setDescription("The date of the score")
        .setRequired(true)
    )
    .addIntegerOption((option) =>
      option
        .setName("score")
        .setDescription("The new score to submit")
        .setRequired(true)
    ),

  // ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

  async execute(interaction) {
    // Parse the command arguments
    const characterOption = interaction.options.getString("character");
    const dateOption = interaction.options.getString("date");
    const scoreOption = interaction.options.getInteger("score");

    // Check if the date is valid (formatted properly, falls on a sunday)
    const dateFormat = /^\d{4}-\d{2}-\d{2}$/;
    const isFormatted = dateFormat.test(dateOption);

    const isSunday = dayjs(dateOption).day() === 0;

    if (!isFormatted) {
      return interaction.reply(
        `Error - The date **${dateOption}** is not valid. Make sure that it follows the 'YYYY-MM-DD' format`
      );
    }

    if (!isSunday) {
      return interaction.reply(
        `Error - The date **${dateOption}** is not valid. Make sure that the day lands on a sunday`
      );
    }

    // Find the user with the specified character
    const user = await culvertSchema.findOne({
      "characters.name": { $regex: `^${characterOption}$`, $options: "i" },
    });

    if (!user) {
      return interaction.reply(
        `Error - The character **${characterOption}** has not yet been linked`
      );
    }

    // Check if the character has a score on the given date
    const character = user.characters.find(
      (char) => char.name.toLowerCase() === characterOption.toLowerCase()
    );

    const scoreExists = character.scores.find(
      (score) => score.date === dateOption
    );

    // Create or update an existing score on the selected character
    if (scoreExists) {
      console.log("Score exists, updating previous score");
      await culvertSchema.findOneAndUpdate(
        {
          "characters.name": {
            $regex: `^${characterOption}$`,
            $options: "i",
          },
          "characters.scores.date": dateOption,
        },
        {
          $set: {
            "characters.$[nameElem].scores.$[dateElem].score": scoreOption,
          },
        },
        {
          arrayFilters: [
            {
              "nameElem.name": {
                $regex: `^${characterOption}$`,
                $options: "i",
              },
            },
            { "dateElem.date": dateOption },
          ],
        }
      );
    } else {
      console.log("No score found, creating a new one");
      await culvertSchema.findOneAndUpdate(
        {
          "characters.name": {
            $regex: `^${characterOption}$`,
            $options: "i",
          },
        },
        {
          $addToSet: {
            "characters.$[nameElem].scores": {
              score: scoreOption,
              date: dateOption,
            },
          },
        },
        {
          arrayFilters: [
            {
              "nameElem.name": {
                $regex: `^${characterOption}$`,
                $options: "i",
              },
            },
          ],
        }
      );
    }

    // Display user responses
    interaction.reply(
      `${characterOption}'s score has been set to **${scoreOption}** for the week of ${dateOption}`
    );
  },
};
