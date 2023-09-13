//TODO: Add a number of weeks argument
//TODO: Add custom colors for graph

const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const culvertSchema = require("../../culvertSchema.js");
const dayjs = require("dayjs");

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

module.exports = {
  data: new SlashCommandBuilder()
    .setName("graph")
    .setDescription("Preview the progression graph of a user")
    .addStringOption((option) =>
      option
        .setName("character_name")
        .setDescription("The characters graph to be visualized")
        .setRequired(true)
        .setAutocomplete(true)
    )
    .addIntegerOption((option) =>
      option
        .setName("number_of_weeks")
        .setDescription(
          "The number of weeks to display on the graph (default: 8)"
        )
    )
    .addBooleanOption((option) =>
      option
        .setName("omit_missed_weeks")
        .setDescription(
          "Prevent the missed weeks (unsubmitted scores) from displaying on the graph"
        )
    ),

  // ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

  async autocomplete(interaction) {
    const user = await culvertSchema
      .findById(interaction.user.id, "characters")
      .exec(); // ?is .exec needed?
    const value = interaction.options.getFocused().toLowerCase();

    let choices = [];

    user.characters.forEach((character) => {
      choices.push(character.name);
    });

    const filtered = choices
      .filter((choice) => choice.toLowerCase().includes(value))
      .slice(0, 25);

    if (!interaction) return; // ? is this needed?

    await interaction.respond(
      filtered.map((choice) => ({ name: choice, value: choice }))
    );
  },

  // ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

  async execute(client, interaction) {
    const selectedCharacter = interaction.options.getString("character_name");
    const numOfWeeks = interaction.options.getInteger("number_of_weeks");
    const omitMissed = interaction.options.getBoolean("omit_missed_weeks");

    // Find the character with the given name
    const user = await culvertSchema.findOne(
      {
        "characters.name": { $regex: `^${selectedCharacter}$`, $options: "i" },
      },
      { "characters.$": 1 }
    );

    // Check if character is linked to a user
    const characterLinked = await culvertSchema.exists({
      "characters.name": { $regex: `^${selectedCharacter}$`, $options: "i" },
    });

    // Fetch the labels for the graph (the date of the last 8 weeks of scores submitted)
    // TODO: MERGE THESE TWO FUNCTIONS VV
    function getLabels() {
      if (characterLinked) {
        const scores = user.characters[0].scores;

        let threshold = (!numOfWeeks ? 8 : numOfWeeks);
        let content = "";

        for (
          let i = scores.length - 1;
          i >= scores.length - threshold;
          i--
        ) {
          if (scores[i]) {
            if (omitMissed && scores[i].score === 0) {
              threshold++;
            } else {
              const newDate = dayjs(scores[i].date).format("MM/DD"); // Reformat the date
              content = content.concat(newDate, ",");
            }
          }
        }

        return content.slice(0, -1); // Remove the unnecessary comma at the end
      }
    }

    // Fetch the data for the graph (the scores of the last 8 weeks if submitted)
    function getData() {
      if (characterLinked) {
        const scores = user.characters[0].scores;

        let threshold = (!numOfWeeks ? 8 : numOfWeeks);
        let content = "";

        for (
          let i = scores.length - 1;
          i >= scores.length - threshold;
          i--
        ) {
          if (scores[i]) {
            if (omitMissed && scores[i].score === 0) {
              threshold++
            } else {
              content = content.concat(scores[i].score, ",");
            }
          }
        }

        return content.slice(0, -1); // Remove the unnecessary comma at the end
      }
    }

    // QuickChart Template Link
    const url = `https://quickchart.io/chart/render/sf-2ee241ce-43cc-4fea-96bf-0e41120ddeed?labels=${getLabels()}&data1=${getData()}`;

    // Display responses
    if (characterLinked && user.characters[0].scores.length >= 2) {
      const graph = new EmbedBuilder()
        .setColor(0x202222)
        .setAuthor({ name: "Culvert Graph" })
        .setImage(url)
        .setTitle(user.characters[0].name)
        .setURL(
          `https://maplestory.nexon.net/rankings/overall-ranking/legendary?rebootIndex=1&character_name=${user.characters[0].name}&search=true`
        )
        .setFooter({
          text: "Submit scores with /gpq • Display stats with /profile",
        });
      interaction.reply({ embeds: [graph] });
    } else if (!characterLinked) {
      interaction.reply(
        `Error ⎯ The character **${selectedCharacter}** is not linked to any user`
      );
    } else {
      interaction.reply(
        `Error ⎯ The character **${selectedCharacter}** must have at least two scores submitted`
      );
    }
  },
};
