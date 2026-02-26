const { SlashCommandBuilder } = require("discord.js");
const culvertSchema = require("../../schemas/culvertSchema.js");

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

module.exports = {
  data: new SlashCommandBuilder()
    .setName("graphcolor")
    .setDescription("Change the color of your progression graph area")
    .addStringOption((option) =>
      option
        .setName("color")
        .setDescription("The new color of the graph area (default: pink)")
        .setRequired(true)
        .addChoices(
          { name: "Pink", value: "pink" },
          { name: "Purple", value: "purple" },
          { name: "Blue", value: "blue" },
          { name: "Red", value: "red" },
          { name: "Orange", value: "orange" },
          { name: "Yellow", value: "yellow" },
          { name: "Green", value: "green" },
          { name: "Mint Green", value: "mint" },
          { name: "Lavender", value: "lavender" }
        )
    ),

  // ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

  async execute(interaction) {
    // Parse the command arguments
    const colorOption = interaction.options.getString("color");

    // Get the RGB values for the selected color
    function getGraphColor(color) {
      const colorMap = {
        pink: "255,189,213",
        purple: "145,68,207",
        blue: "31,119,180",
        red: "189,36,36",
        orange: "214,110,45",
        yellow: "180,170,31",
        green: "58,180,31",
        mint: "173,235,179",
        lavender: "216,185,255",
      };

      return colorMap[color];
    }

    // Fetch the user to check the current color before updating
    const user = await culvertSchema.findById(interaction.user.id, { characters: 1 });

    // Handle responses
    let content;

    if (user?.characters[0]?.graphColor === getGraphColor(colorOption)) {
      content = `Error - Your graph color is already set to ${colorOption}`;
    } else {
      // Update graphColor on every character belonging to this user
      await culvertSchema.findByIdAndUpdate(
        interaction.user.id,
        { $set: { "characters.$[].graphColor": getGraphColor(colorOption) } }
      );
      content = `Your graph color has been changed to ${colorOption}`;
    }

    interaction.reply({ content, ephemeral: true });
  },
};
