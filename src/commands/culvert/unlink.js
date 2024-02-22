const { SlashCommandBuilder } = require("discord.js");
const culvertSchema = require("../../culvertSchema.js");

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
    const characterLinked = await culvertSchema.exists({
      "characters.name": { $regex: `^${characterOption}$`, $options: "i" },
    });

    if (!characterLinked) {
      return interaction.reply(
        `Error - The character **${characterOption}** is not linked to any user`
      );
    }

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

    interaction.reply(
      `Unlinked and removed all of **${characterOption}**'s scores from the database` //TODO: Make this display the real name
    );
  },
};
