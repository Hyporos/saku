const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const culvertSchema = require("../../culvertSchema.js");
const dayjs = require("dayjs");

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

module.exports = {
  data: new SlashCommandBuilder()
    .setName("graph")
    .setDescription("Preview the progression graph of a character")
    .addStringOption((option) =>
      option
        .setName("character_name")
        .setDescription("The character's graph to be visualized")
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

  async execute(client, interaction) {
    const selectedCharacter = interaction.options.getString("character_name");
    const numOfWeeks = interaction.options.getInteger("number_of_weeks") || 8; //TODO: When inputting 0 (instead of nothing), it will be changed to 8
    const omitMissed = interaction.options.getBoolean("omit_unsubmitted");

    // Day of the week the culvert score gets reset (sunday)
    const reset = dayjs().day(0).format("YYYY-MM-DD");

    // Find the character with the given name
    const user = await culvertSchema.findOne(
      {
        "characters.name": { $regex: `^${selectedCharacter}$`, $options: "i" },
      }
    );

    // Fetch the x and y axis labels for the graph
    function getLabels(axis) {
      if (user) {
        const scores = user.characters[0]?.scores;

        let threshold = !numOfWeeks ? 8 : numOfWeeks;
        let content = "";

        for (let i = scores.length - 1; i >= scores.length - threshold; i--) {
          if (scores[i]) {
            if (omitMissed && scores[i].score === 0) {
              threshold++; // Run one more iteration if no score is found
            } else {
              content = content.concat(
                axis === "x"
                  ? dayjs(scores[i].date).format("MM/DD")
                  : scores[i].score,
                ","
              );
            }
          }
        }

        return content.slice(0, -1); // Remove the unnecessary comma at the end
      }
    }

    // QuickChart Template Link
    const url = `https://quickchart.io/chart/render/sf-2ee241ce-43cc-4fea-96bf-0e41120ddeed?labels=${getLabels(
      "x"
    )}&data1=${getLabels("y")}&borderColor1=rgba(${user?.graphColor},0.7)&backgroundColor1=rgba(${user?.graphColor},0.4)`;


    // Display responses
    let response = "";

    if (!user) {
      response = `Error ⎯ The character **${selectedCharacter}** is not linked to any user`;
    } else if (user.characters[0].scores.length <= 2) {
      response = `Error ⎯ The character **${selectedCharacter}** must have at least two scores submitted`;
    } else if (numOfWeeks <= 1) {
      response = "Error ⎯ The number of weeks must be greater than 1";
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
          text: `Rendering the last ${
            numOfWeeks > user.characters[0].scores.length
              ? user.characters[0].scores.length
              : numOfWeeks
          } weeks • ${omitMissed ? "Omitting" : "Displaying"} unsubmitted scores`,
        });
      response = { embeds: [graph] };
    }

    interaction.reply(response);
  },
};
