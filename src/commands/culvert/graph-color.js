//TODO - Add a streak system
//TODO - Validate for negative and massive numbers

const { SlashCommandBuilder } = require("discord.js");
const culvertSchema = require("../../culvertSchema.js");
const dayjs = require("dayjs");

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

module.exports = {
  data: new SlashCommandBuilder()
    .setName("graphcolor")
    .setDescription("Change the color of your progression graph")
    .addStringOption((option) =>
      option
        .setName("color")
        .setDescription("The new color that the graph will use (default: blue)")
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
        if (newColor === "blue") return "blue";
        if (newColor === "purple") return "purple";
        if (newColor === "pink") return "pink";
        if (newColor === "red") return "red";
        if (newColor === "orange") return "orange";
        if (newColor === "yellow") return "yellow";
        if (newColor === "green") return "green";
    }

    await culvertSchema.findOneAndUpdate(
      {
        _id: interaction.user.id,
      },
      {
        $set: {
          graphColor: getGraphColor(),
        },
      },
      {
        upsert: true,
      }
    );

    // Display responses
    let response = "";

    interaction.reply("done");
  }
};
