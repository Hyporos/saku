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
        .setDescription("The new color of the graph area (default: blue)")
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

  async execute(client, interaction) {
    const newColor = interaction.options.getString("color");

    function getGraphColor() {
      if (newColor === "blue") return "31,119,180";
      if (newColor === "purple") return "124,48,184";
      if (newColor === "pink") return "255,189,213";
      if (newColor === "red") return "180,31,31";
      if (newColor === "orange") return "180,88,31";
      if (newColor === "yellow") return "180,170,31";
      if (newColor === "green") return "58,180,31";
    }

    const oldUser = await culvertSchema.findOneAndUpdate(
      {
        _id: interaction.user.id,
      },
      {
        $set: {
          graphColor: getGraphColor(),
        },
      }
    );

    // Display responses
    let response = "";

    if (oldUser.graphColor === getGraphColor()) {
      response = {content: `Error ⎯ Your graph color is already set to ${newColor}`, ephemeral: true};
    } else {
      response = {content: `Your graph color has been changed to ${newColor}`, ephemeral: true};
    }

    interaction.reply(response);
  },
};
