const { SlashCommandBuilder } = require("discord.js");
const culvertSchema = require("../../schemas/culvertSchema.js");
const exceptionSchema = require("../../schemas/exceptionSchema.js");
const {
  isCharacterLinked,
  getCasedName,
} = require("../../utility/culvertUtils.js");

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

module.exports = {
  data: new SlashCommandBuilder()
    .setName("unlink")
    .setDescription("Unlink and remove a character from the database")
    .addStringOption((option) =>
      option
        .setName("character")
        .setDescription("The character to be unlinked")
        .setRequired(true)
    ),

  // ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

  async execute(interaction) {
    // Parse the command arguments
    const characterOption = interaction.options.getString("character");

    // Check if the character is already linked to a user
    const characterLinked = await isCharacterLinked(
      interaction,
      characterOption
    );
    if (!characterLinked) return;

    // Get the properly cased name of the character and the user's Discord ID
    const characterNameCased = await getCasedName(characterOption);

    // Get the user ID who owns this character
    const userDoc = await culvertSchema.findOne(
      { "characters.name": { $regex: `^${characterOption}$`, $options: "i" } },
      { _id: 1 }
    );
    const userId = userDoc?._id;

    // Remove the character from the database
    await culvertSchema.findOneAndUpdate(
      { "characters.name": { $regex: `^${characterOption}$`, $options: "i" } },
      {
        $pull: {
          characters: {
            name: {
              $regex: `^${characterOption}$`,
              $options: "i",
            },
          },
        },
      }
    );

    // Delete the user document entirely if they have no more characters
    await culvertSchema.deleteOne({ _id: userId, characters: { $size: 0 } });

    // Remove any exceptions tied to this character name
    await exceptionSchema.deleteMany({ name: { $regex: `^${characterNameCased}$`, $options: "i" } });

    // Handle responses
    interaction.reply(
      `Unlinked and removed all of **${characterNameCased}** (<@${userId}>)'s scores from the database`
    );
  },
};
