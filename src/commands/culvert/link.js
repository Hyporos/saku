const { SlashCommandBuilder } = require("discord.js");
const culvertSchema = require("../../culvertSchema.js");

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
  async execute(client, interaction) {
    const characterName = interaction.options.getString("character_name");
    const discordUser = interaction.options.getUser("discord_user");

    await culvertSchema.findOneAndUpdate(
      {
        _id: discordUser.id,
      },
      {
        _id: discordUser.id,
        $addToSet: {characters: {name: characterName}} //set id to array position
      },
      {
        upsert: true,
      }
    );

    interaction.reply({
      content: `Linked **${characterName}** to ${discordUser}\nUser ID: ${discordUser.id}`,
    });
  },
};
