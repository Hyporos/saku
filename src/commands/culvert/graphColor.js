const { SlashCommandBuilder } = require("discord.js");
const culvertSchema = require("../../culvertSchema.js");

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
          { name: "Blue", value: "blue" },
          { name: "Purple", value: "purple" },
          { name: "Pink", value: "pink" },
          { name: "Red", value: "red" },
          { name: "Orange", value: "orange" },
          { name: "Yellow", value: "yellow" },
          { name: "Green", value: "green" }
        )
    ),

  // ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

  async execute(interaction) {
    // Parse the command arguments
    const newColor = interaction.options.getString("color");

    // Get the RGB values for the selected color
    function getGraphColor(color) {
      const colorMap = {
        blue: "31,119,180",
        purple: "145,68,207",
        pink: "255,189,213",
        red: "189,36,36",
        orange: "214,110,45",
        yellow: "180,170,31",
        green: "58,180,31",
      };

      return colorMap[color];
    }

    // Update the user's graph color
    const user = await culvertSchema.findOneAndUpdate(
      { _id: interaction.user.id },
      { $set: { graphColor: getGraphColor(newColor) } }
    );

    // Display user responses
    let content;

    if (user.graphColor === getGraphColor(newColor)) {
      content = `Error ⎯ Your graph color is already set to ${newColor}`;
    } else {
      content = `Your graph color has been changed to ${newColor}`;
    }

    interaction.reply({ content, ephemeral: true });
  },
};
