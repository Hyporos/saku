const { SlashCommandBuilder } = require("discord.js");
const culvertSchema = require("../../culvertSchema.js");
const { isCharacterLinked, getCasedName } = require("../../utility/culvertUtils.js")

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
    const characterLinked = await isCharacterLinked(interaction, characterOption);
    if (!characterLinked) return;

    const characterNameCased = await getCasedName(characterOption);

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

    // Handle responses
    interaction.reply(
      `Unlinked and removed all of **${characterNameCased}**'s scores from the database` //TODO: Make this display the real name
    );
  },
};
