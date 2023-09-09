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
    ),

  // ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

  async execute(client, interaction) {
    // Get option values
    const selectedCharacter = interaction.options.getString("character_name");

    // Find the character with the given name
    const user = await culvertSchema.findOne(
      { "characters.name": { $regex: selectedCharacter, $options: "i" } },
      { "characters.$": 1 }
    );

    // Check if character is linked to a user
    const characterLinked = await culvertSchema.exists({
      "characters.name": { $regex: selectedCharacter, $options: "i" },
    });

    // Fetch the labels for the graph (the date of the last 8 weeks of scores submitted)
    function getLabels() {
      if (characterLinked) {
        const scores = user.characters[0].scores;

        let content = "";

        for (let i = scores.length - 1; i >= scores.length - 9; i--) {
          if (scores[i]) {
            const newDate = dayjs(scores[i].date).format('MM/DD') // Reformat the date
            content = content.concat(newDate, ",");
          } 
        }

        content = content.slice(0, -1); // Remove the unnecessary comma at the end

        return content;
      }
    }

    // Fetch the data for the graph (the scores of the last 8 weeks if submitted)
    function getData() {
      if (characterLinked) {
        const scores = user.characters[0].scores;

        let content = "";

        for (let i = scores.length - 1; i >= scores.length - 9; i--) {
          if (scores[i]) content = content.concat(scores[i].score, ",");
        }

        content = content.slice(0, -1); // Remove the unnecessary comma at the end
        return content;
      }
    }

    // QuickChart Template Link
    const url = `https://quickchart.io/chart/render/sf-6c3572d8-ae41-42e0-b5e1-54ccd39a0141?labels=${getLabels()}&data1=${getData()}`;

    // Display responses
    if (characterLinked && user.characters[0].scores.length >= 2) {
      const graph = new EmbedBuilder()
        .setColor(0x202222)
        .setImage(url)
        .setTitle(user.characters[0].name);
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
