const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const culvertSchema = require("../../culvertSchema.js");
const dayjs = require("dayjs");

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

module.exports = {
  data: new SlashCommandBuilder()
    .setName("graph")
    .setDescription("View the progression graph of a character")
    .addStringOption((option) =>
      option
        .setName("character_name")
        .setDescription("The character's graph to be rendered")
        .setRequired(true)
        .setAutocomplete(true)
    )
    .addIntegerOption((option) =>
      option
        .setName("number_of_weeks")
        .setDescription("The number of weeks to display (default: 8)")
    )
    .addBooleanOption((option) =>
      option
        .setName("omit_unsubmitted")
        .setDescription(
          "Prevent unsubmitted scores (missed weeks) from displaying"
        )
    ),

  // ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

  async autocomplete(interaction) {
    const user = await culvertSchema.findById(
      interaction.user.id,
      "characters"
    );

    const value = interaction.options.getFocused().toLowerCase();

    let choices = [];

    user.characters.forEach((character) => {
      choices.push(character.name);
    });

    const filtered = choices
      .filter((choice) => choice.toLowerCase().includes(value))
      .slice(0, 25);

    await interaction.respond(
      filtered.map((choice) => ({ name: choice, value: choice }))
    );
  },

  // ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

  async execute(interaction) {
    // Parse the command arguments
    const selectedCharacter = interaction.options.getString("character_name");
    const numOfWeeks = interaction.options.getInteger("number_of_weeks") ?? 8;
    const omitMissed = interaction.options.getBoolean("omit_unsubmitted");

    // Find the character with the given name
    const user = await culvertSchema.findOne(
      {
        "characters.name": { $regex: `^${selectedCharacter}$`, $options: "i" },
      },
      { "characters.$": 1, graphColor: 1 }
    );

    // Fetch the x and y axis labels for the graph
    function getLabels(axis) {
      if (!user) return;

      const scores = user.characters[0].scores || [];

      let weekCount = numOfWeeks || 8;
      let content = "";

      for (let i = scores.length - 1; i >= scores.length - weekCount; i--) {
        if (!scores[i]) continue;

        if (omitMissed && scores[i].score === 0) {
          weekCount++; // Run one more iteration if no score is found
        } else {
          content = content.concat(
            axis === "x"
              ? dayjs(scores[i].date).format("MM/DD")
              : scores[i].score,
            ","
          );
        }
      }

      return content.slice(0, -1); // Remove the unnecessary comma at the end
    }

    // Total number of weeks rendered
    const renderedWeeks = Math.min(
      numOfWeeks,
      user.characters[0].scores.length
    );

    // QuickChart Template Link
    const xLabels = getLabels("x");
    const yLabels = getLabels("y");
    const graphColor = user.graphColor || "255,189,213";
    const borderColorAlpha = graphColor !== "255,189,213" ? 0.7 : 0.6;

    const url = `https://quickchart.io/chart/render/sf-b3492adc-c626-40cb-87d6-5914f018c018?labels=${xLabels}&data1=${yLabels}&borderColor1=rgba(${graphColor},${borderColorAlpha})&backgroundColor1=rgba(${graphColor},0.4)`;

    // Display user responses
    let response = "";

    if (!user) {
      response = `Error ⎯ The character **${selectedCharacter}** is not linked to any user`;
    } else if (user.characters[0].scores.length <= 2) {
      response = `Error ⎯ The character **${selectedCharacter}** must have at least two scores submitted`;
    } else if (numOfWeeks <= 1) {
      response = "Error ⎯ The number of weeks to display must be greater than 1";
    } else {
      const graph = new EmbedBuilder()
        .setColor(0x202222)
        .setAuthor({ name: "Culvert Graph" })
        .setImage(url)
        .setTitle(user.characters[0].name)
        .setURL(
          `https://maplestory.nexon.net/rankings/overall-ranking/legendary?rebootIndex=1&character_name=${user.characters[0].name}&search=true`
        )
        .setFooter({
          text: `Rendering the last ${renderedWeeks} weeks • ${
            omitMissed ? "Omitting" : "Displaying"
          } unsubmitted scores`,
        });

      response = { embeds: [graph] };
    }

    interaction.reply(response);
  },
};
