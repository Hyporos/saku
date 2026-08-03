const { SlashCommandBuilder } = require("discord.js");

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

const DEFAULT_MAX = 100;

// The two rolls that earn a reaction, built once rather than rebuilt inside every roll.
const SPECIAL = {
  69: "<:sakuSlyL:1091136098098487326>",
  100: "<:sakuHUH:1134861539728433222>",
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName("roll")
    .setDescription("Roll a number between 1 and 100, or between 1 and a number you pick")
    .addIntegerOption((option) =>
      option.setName("max").setDescription("Roll 1 to this number instead of 100").setMinValue(2).setMaxValue(1000000)
    ),

  // ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

  async execute(interaction) {
    // Roll a random number between 1 and the chosen ceiling
    const max = interaction.options.getInteger("max") ?? DEFAULT_MAX;
    const number = Math.floor(Math.random() * max) + 1;

    // 69 and 100 are jokes about the 1-100 roll specifically, so a custom range doesn't inherit them:
    // rolling 100 out of 5000 isn't the same event.
    const emoji = max === DEFAULT_MAX ? (SPECIAL[number] ?? "") : "";

    // Handle responses
    await interaction.reply({ content: `You've rolled ${number}!${emoji ? ` ${emoji}` : ""}` });
  },
};
