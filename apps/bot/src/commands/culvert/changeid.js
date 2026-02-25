const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const culvertSchema = require("../../schemas/culvertSchema.js");

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

module.exports = {
  data: new SlashCommandBuilder()
    .setName("changeid")
    .setDescription("Change the Discord ID for a culvert user")
    .addUserOption((option) =>
      option
        .setName("old_user")
        .setDescription("The current Discord user to change ID from")
        .setRequired(true)
    )
    .addUserOption((option) =>
      option
        .setName("new_user")
        .setDescription("The new Discord user to transfer data to")
        .setRequired(true)
    ),

  // ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

  async execute(interaction) {
    // Parse the command arguments
    const oldUser = interaction.options.getUser("old_user");
    const newUser = interaction.options.getUser("new_user");

    // Check if old user exists in the database
    const oldUserData = await culvertSchema.findById(oldUser.id);

    if (!oldUserData) {
      return interaction.reply(
        `Error - The user **${oldUser.tag}** does not have any culvert data`
      );
    }

    // Check if new user already has data
    const newUserData = await culvertSchema.findById(newUser.id);

    if (newUserData) {
      return interaction.reply(
        `Error - The user **${newUser.tag}** already has culvert data. Please unlink their characters first or choose a different user.`
      );
    }

    try {
      const oldUserObject = oldUserData.toObject();

      // Create a new document with the new ID
      const newDocument = {
        _id: newUser.id,
        graphColor: oldUserObject.graphColor,
        characters: oldUserObject.characters.map((char) => {
          const newChar = {
            name: char.name,
            class: char.class,
            memberSince: char.memberSince,
            scores: char.scores,
          };
          
          // Only include avatar and level if they exist
          if (char.avatar !== undefined) newChar.avatar = char.avatar;
          if (char.level !== undefined) newChar.level = char.level;
          
          return newChar;
        }),
      };

      // Insert the new document without validation (to allow missing optional fields)
      await culvertSchema.collection.insertOne(newDocument);
      await culvertSchema.findByIdAndDelete(oldUser.id);

      // Get character names for confirmation message
      const characterNames = oldUserObject.characters
        .map((char) => char.name)
        .join(", ");

      return interaction.reply(
        `Successfully transferred culvert data from **${oldUser.tag}** to **${newUser.tag}**\n` +
          `Characters: ${characterNames}`
      );
    } catch (error) {
      console.error("Error - Could not change user ID:", error);
      return interaction.reply(
        `Error - Failed to change user ID`
      );
    }
  },
};
