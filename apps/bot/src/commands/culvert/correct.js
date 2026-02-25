const { SlashCommandBuilder } = require("discord.js");
const culvertSchema = require("../../schemas/culvertSchema.js");
const dayjs = require("dayjs");
const {
  findCharacter,
  getCasedName,
} = require("../../utility/culvertUtils.js");

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

    // Check if the date is valid (formatted properly)
    const isFormatted = /^\d{4}-\d{2}-\d{2}$/.test(dateOption);

    if (!isFormatted) {
      return interaction.reply(
        `Error - The date **${dateOption}** is not valid. Make sure that it follows the 'YYYY-MM-DD' format`
      );
    }

    // Check if the date is valid (lands on a Wednesday)
    if (dayjs(dateOption).day() !== 3) {
      return interaction.reply(
        `Error - The date **${dateOption}** is not valid. Make sure that the day lands on a Wednesday`
      );
    }

    // Find the specified character
    const character = await findCharacter(interaction, characterOption);
    if (!character) return;

    // Get the properly cased name of the character
    const characterNameCased = await getCasedName(characterOption);

    // Check if the character has a score on the given date
    const scoreExists = character?.scores.find(
      (score) => score.date === dateOption
    );

    // Create or update an existing score on the selected character
    if (scoreExists) {
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

    // Handle responses
    let content;

    if (scoreExists) {
      content = `${characterNameCased}'s score has been updated to **${scoreOption}** for the week of ${dateOption}`;
    } else {
      content = `${characterNameCased}'s score of **${scoreOption}** has been created for the week of ${dateOption}`;
    }

    interaction.reply(content);
  },
};
