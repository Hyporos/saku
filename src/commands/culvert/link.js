const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const culvertSchema = require("../../culvertSchema.js");

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

module.exports = {
  data: new SlashCommandBuilder()
    .setName("link")
    .setDescription("Link a character to your Discord ID")
    .addStringOption((option) =>
      option
        .setName("character_name")
        .setDescription("The character name to be linked")
        .setRequired(true)
    )
    .addUserOption((option) =>
      option
        .setName("discord_user")
        .setDescription("The Discord user to be paired with the character")
        .setRequired(true)
    ),

  // ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

  async execute(client, interaction) {
    //Get option values
    const characterName = interaction.options.getString("character_name");
    const discordUser = interaction.options.getUser("discord_user");

    // Check if character is linked to user
    const characterLinked = await culvertSchema.exists({
      "characters.name": characterName,
    });

    // Create or update a user entry and link a character (if not already linked)
    if (!characterLinked) {
      await culvertSchema.findOneAndUpdate(
        {
          _id: discordUser.id,
        },
        {
          _id: discordUser.id,
          $addToSet: { characters: { name: characterName } },
        },
        {
          upsert: true,
        }
      );
    }

    // Display responses
    let response = "";

    if (characterLinked) {
      response = `Error ⎯ The character **${characterName}** is already linked`;
    } else {
      response = `Linked **${characterName}** to ${discordUser}\nUser ID: ${discordUser.id}`;
    }

    interaction.reply(response);
  },
};
