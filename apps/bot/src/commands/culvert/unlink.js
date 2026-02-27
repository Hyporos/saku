const { SlashCommandBuilder } = require("discord.js");
const culvertSchema = require("../../schemas/culvertSchema.js");
const exceptionSchema = require("../../schemas/exceptionSchema.js");
const actionLogSchema = require("../../schemas/actionLogSchema.js");
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
    const updatedUser = await culvertSchema.findByIdAndUpdate(
      userId,
      {
        $pull: {
          characters: {
            name: {
              $regex: `^${characterOption}$`,
              $options: "i",
            },
          },
        },
      },
      { new: true }
    );

    // Delete the user document entirely if they have no more characters
    if (updatedUser && updatedUser.characters.length === 0) {
      await culvertSchema.deleteOne({ _id: userId });
    }

    // Remove any exceptions tied to this character name
    await exceptionSchema.deleteMany({ name: { $regex: `^${characterNameCased}$`, $options: "i" } });

    // Log the unlink
    try {
      await actionLogSchema.create({
        action: "Unlink Character",
        target: String(characterNameCased),
        category: "delete",
        actorId: String(interaction.user.id),
        timestamp: new Date(),
      });
    } catch {
      // Non-critical
    }

    // Handle responses
    interaction.reply(
      `Unlinked and removed all of **${characterNameCased}** (<@${userId}>)'s scores from the database`
    );
  },
};
