//TODO - Add a streak system
//TODO - Validate for negative and massive numbers

const { SlashCommandBuilder } = require("discord.js");
const culvertSchema = require("../../culvertSchema.js");
const { findCharacter, isCharacterLinked, getResetDates } = require("../../utility/culvertUtils.js")

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

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
        .setName("score")
        .setDescription("The score to be logged")
        .setRequired(true)
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
    // Parse the command arguments
    const characterOption = interaction.options.getString("character");
    const scoreOption = interaction.options.getInteger("score");

    // Get the current reset date (Thursday 12:00 AM UTC)
    const { reset } = getResetDates();

    // Check if the character is already linked to a user
    const characterLinked = await isCharacterLinked(interaction, characterOption);
    if (!characterLinked) return;

    // Check if the character belongs to the user
    const characterBelongsToUser = await culvertSchema.exists({
      _id: interaction.user.id,
      "characters.name": { $regex: `^${characterOption}$`, $options: "i" },
    });

    if (!characterBelongsToUser) {
      return interaction.reply(
        `Error - The character **${characterOption}** is not linked to you`
      );
    }

    // Find the specified character
    const character = await findCharacter(interaction, characterOption);
    if (!character) return;

    // Get the character's highest score
    const bestScoreResult = await culvertSchema.aggregate([
      {
        $unwind: "$characters",
      },
      {
        $match: {
          "characters.name": {
            $regex: `^${characterOption}$`,
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

    const bestScore = bestScoreResult[0]?.characters?.scores?.[0]?.score

    // Check if a score has already been set for this week
    const scoreExistsResult = await culvertSchema.aggregate([
      {
        $unwind: "$characters",
      },
      {
        $unwind: "$characters.scores",
      },
      {
        $match: {
          "characters.name": {
            $regex: `^${characterOption}$`,
            $options: "i",
          },
          "characters.scores.date": reset,
        },
      },
    ]);

    const scoreExists = scoreExistsResult.length >= 1;

    // Create or update an existing score on the selected character
    if (!scoreExists) {
      await culvertSchema.findOneAndUpdate(
        {
          _id: interaction.user.id,
          "characters.name": {
            $regex: `^${characterOption}$`,
            $options: "i",
          },
        },
        {
          $addToSet: {
            "characters.$[nameElem].scores": {
              score: scoreOption,
              date: reset,
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
          new: true,
        }
      );
    } else {
      await culvertSchema.findOneAndUpdate(
        {
          _id: interaction.user.id,
          "characters.name": {
            $regex: `^${characterOption}$`,
            $options: "i",
          },
          "characters.scores.date": reset,
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
            { "dateElem.date": reset },
          ],
          new: true,
        }
      );
    }

    // Check if the character has set a new personal best
    function hasNewBest() {
      if (scoreOption > bestScore) {
        return " :trophy:";
      } else {
        return "";
      }
    }

    // Display responses
    let response = "";

    if (scoreExists) {
      response = `${
        character.name
      }'s score has been updated to **${scoreOption}**${hasNewBest()} for this week! (${reset})`;
    } else {
      response = `${
        character.name
      } has scored **${scoreOption}**${hasNewBest()} for this week! (${reset})`;
    }

    interaction.reply(response);
  },
};
