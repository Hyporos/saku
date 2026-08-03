//TODO - Add a streak system
//TODO - Validate for negative and massive numbers

const { SlashCommandBuilder } = require("discord.js");
const culvertSchema = require("../../schemas/culvertSchema.js");
const { EMOJI_IDS } = require("../../config/ids.js");
const {
  findCharacter,
  isScoreSubmitted,
  isCharacterLinked,
  getResetDates,
} = require("../../utility/culvertUtils.js");

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

module.exports = {
  data: new SlashCommandBuilder()
    .setName("gpq")
    .setDescription("Log your culvert score for this week")
    .addIntegerOption((option) =>
      option
        .setName("score")
        .setDescription("The score to be logged")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("character")
        .setDescription("The character that the score will be logged to")
        .setRequired(false)
        .setAutocomplete(true)
    ),

  // ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

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

    try {
      await interaction.respond(
        filtered.map((choice) => ({ name: choice, value: choice }))
      );
    } catch (error) {
      if (error.code !== 10062) throw error;
    }
  },

  // ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

  async execute(interaction) {
    // Parse the command arguments
    let characterOption = interaction.options.getString("character");
    const scoreOption = interaction.options.getInteger("score");

    // If no character was specified, auto-select if the user only has one linked
    if (!characterOption) {
      const user = await culvertSchema.findById(interaction.user.id, "characters");
      if (!user || user.characters.length === 0) {
        return interaction.reply("Error - You have no characters linked yet.");
      }
      if (user.characters.length > 1) {
        return interaction.reply("Error - You have multiple characters linked. Please specify which character to log the score for");
      }
      characterOption = user.characters[0].name;
    }

    // Get the current reset date (Thursday 12:00 AM UTC)
    const { reset } = getResetDates();

    // Check if the character is already linked to a user
    const characterLinked = await isCharacterLinked(
      interaction,
      characterOption
    );
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

    // Find the character's best (highest) score
    const sortedScores = [...character.scores].sort(
      (a, b) => b.score - a.score
    );
    const bestScore = sortedScores[0]?.score || 0;

    // Check if a score has already been set for this week
    const scoreExists = await isScoreSubmitted(characterOption, reset);

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

    // Handle Responses
    const isNewPB = scoreOption > bestScore;

    if (scoreExists) {
      // If updating an existing score, clarify which week
      await interaction.reply(
        `${character.name}'s score has been updated to **${scoreOption}**${isNewPB ? " :trophy:" : ""} for this week! (${reset})`
      );
    } else {
      // If scoring for the first time this week, clarify which week
      await interaction.reply(
        `${character.name} has scored **${scoreOption}**${isNewPB ? " :trophy:" : ""} for this week! (${reset})`
      );
    }

    // React to the message
    const reply = await interaction.fetchReply();
    await reply.react(EMOJI_IDS.THUMB_SHADOW); // sakuThumbShadow for all scores
    
    // Add sakuStonks reaction for personal bests
    if (isNewPB) {
      await reply.react(EMOJI_IDS.STONKS); // sakuStonks for PBs
    }
  },
};
