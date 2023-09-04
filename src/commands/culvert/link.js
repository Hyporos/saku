const { SlashCommandBuilder } = require("discord.js");
const schema = require("../../schema.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("link")
    .setDescription("Link a character to your Discord ID")
    .addStringOption((option) =>
      option
        .setName("character")
        .setDescription("The character name to be linked")
        .setRequired(true)
    ),
  async execute(client, interaction) {
    const characterName = interaction.options.getString("character");
    const discordId = interaction.user.id;
    await schema.findOneAndUpdate(
      {
        _id: discordId,
      },
      {
        _id: discordId,
        character: characterName,
      },
      {
        upsert: true,
      }
    );

    interaction.reply({
      content: `Successfully linked ${characterName} to ${interaction.user} (ID: ${discordId})`,
    });
  },
};
