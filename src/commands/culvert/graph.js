const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const culvertSchema = require("../../schemas/culvertSchema.js");
const { findCharacter } = require("../../utility/culvertUtils.js");
const dayjs = require("dayjs");

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

module.exports = {
  data: new SlashCommandBuilder()
    .setName("graph")
    .setDescription("View the progression graph of a character")
    .addStringOption((option) =>
      option
        .setName("character")
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
    const characterOption = interaction.options.getString("character");
    const weeksOption = interaction.options.getInteger("number_of_weeks") ?? 8;
    const omitOption = interaction.options.getBoolean("omit_unsubmitted");

    // Check if the user entered an invalid amount of weeks
    if (weeksOption <= 1) {
      return interaction.reply(
        "Error - The number of weeks to display must be greater than 1"
      );
    }

    // Check if the user entered an invalid amount of weeks
    if (weeksOption > 1000) {
      return interaction.reply(
        "Error - The number of weeks to display must be less than 1,000"
      );
    }

    // Find the specified character
    const character = await findCharacter(interaction, characterOption);
    if (!character) return;

    // Check if the character has at least two scores submitted
    if (character.scores.length < 2) {
      return interaction.reply(
        `Error - The character **${characterOption}** must have at least two scores submitted`
      );
    }

    // Get the user's selected graph color
    const user = await culvertSchema.findOne(
      {
        "characters.name": { $regex: `^${characterOption}$`, $options: "i" },
      },
      { graphColor: 1 }
    );

    // Fetch the x and y axis labels for the graph
    function getLabels(axis) {
      const scores = character.scores || [];

      // Sort all scores by date, from oldest to newest
      scores.sort((a, b) => new Date(a.date) - new Date(b.date));

      let weekCount = weeksOption || 8;
      let content = "";

      for (let i = scores.length - 1; i >= scores.length - weekCount; i--) {
        if (!scores[i]) continue;

        if (omitOption && scores[i].score === 0) {
          weekCount++; // Get the exact amount of scores requested, when omitting unsubmitted scores
        } else {
          content = content.concat(
            axis === "x"
              ? dayjs(scores[i].date).format("MM/DD") // For the x axis, grab the date
              : scores[i].score, // For the y axis, grab the score
            ","
          );
        }
      }

      return content.slice(0, -1); // Remove the unnecessary comma at the end
    }

    // Get the total number of weeks rendered (to display as information)
    const renderedWeeks = Math.min(weeksOption, character.scores.length);

    // QuickChart Template Values & Link
    const xLabels = getLabels("x");
    const yLabels = getLabels("y");
    const graphColor = user.graphColor || "255,189,213";
    const borderColorAlpha = graphColor !== "255,189,213" ? 0.7 : 0.6;

    const graphTemplate =
      "https://quickchart.io/chart/render/zm-c2f6cd67-0740-44d6-a023-649110e22db9";

    const url = `${graphTemplate}?labels=${xLabels}&data1=${yLabels}&borderColor1=rgba(${graphColor},${borderColorAlpha})&backgroundColor1=rgba(${graphColor},0.4)`;

    // Create the graph embed
    const graph = new EmbedBuilder()
      .setColor(0x202222)
      .setAuthor({ name: "Culvert Graph" })
      .setImage(url)
      .setTitle(character.name)
      .setURL(
        `https://maplestory.nexon.net/rankings/overall-ranking/legendary?rebootIndex=1&character_name=${character.name}&search=true`
      )
      .setFooter({
        text: `Rendering the last ${renderedWeeks} weeks • ${
          omitOption ? "Omitting" : "Displaying"
        } unsubmitted scores`,
      });

    // Handle responses
    interaction.reply({ embeds: [graph] });
  },
};
