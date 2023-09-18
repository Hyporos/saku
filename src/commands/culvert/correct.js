const { SlashCommandBuilder } = require("discord.js");
const culvertSchema = require("../../culvertSchema.js");

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

module.exports = {
  data: new SlashCommandBuilder()
    .setName("correct")
    .setDescription("Correct a character's score for any given date")
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
    const selectedCharacter = interaction.options.getString("character");
    const selectedDate = interaction.options.getString("date");
    const culvertScore = interaction.options.getInteger("score");

    // Check if character exists
    const characterExists = await culvertSchema.exists({
      "characters.name": { $regex: `^${selectedCharacter}$`, $options: "i" },
    });

    // Check if a score has already been set for the given week
    const weekLogged = await culvertSchema.aggregate([
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
          "characters.scores.date": selectedDate,
        },
      },
    ]);

    // Create or update an existing score on the selected character
    if (weekLogged.length < 1) {
      await culvertSchema.findOneAndUpdate(
        {
          "characters.name": {
            $regex: `^${selectedCharacter}$`,
            $options: "i",
          },
        },
        {
          $addToSet: {
            "characters.$[nameElem].scores": { 
              score: culvertScore,
              date: selectedDate,
            },
          },
        },
        {
          arrayFilters: [
            {
              "nameElem.name": {
                $regex: `^${selectedCharacter}$`,
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
          "characters.name": {
            $regex: `^${selectedCharacter}$`,
            $options: "i",
          },
          "characters.scores.date": selectedDate,
        },
        {
          $set: {
            "characters.$[nameElem].scores.$[dateElem].score": culvertScore,
          },
        },
        {
          arrayFilters: [
            {
              "nameElem.name": {
                $regex: `^${selectedCharacter}$`,
                $options: "i",
              },
            },
            { "dateElem.date": selectedDate },
          ],
          new: true,
        }
      );
    }

    // Display user responses
    let response = "";

    if (!characterExists) {
      response = `Error ⎯ The character **${selectedCharacter}** has not yet been linked`;
    } else {
      response = `${selectedCharacter}'s score has been set to **${culvertScore}** for the week of ${selectedDate}`;
    }

    interaction.reply(response);
  },
};
