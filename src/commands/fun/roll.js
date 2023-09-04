const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("roll")
    .setDescription("Roll a number between 1 and 100"),
  async execute(client, interaction) {
    const number = Math.floor(Math.random() * 100) + 1;
    interaction.reply({
      content: `You've rolled ${number}! ${
        number === 69 ? " <:sakuSlyL:1091136098098487326>" : ""
      }`,
    });
  },
};
