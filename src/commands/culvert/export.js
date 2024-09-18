const { SlashCommandBuilder, AttachmentBuilder } = require("discord.js");
const fs = require("fs");
const culvertSchema = require("../../culvertSchema.js");

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

module.exports = {
  data: new SlashCommandBuilder()
    .setName("export")
    .setDescription(
      "Export a .csv of characters' scores for their respective dates"
    ),

  // ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

  async execute(interaction) {
    try {
      const data = await culvertSchema.find({});

      const ws = fs.createWriteStream(`culvert.csv`);

      // Flatten the characters array from all users
      let allCharacters = [];
      data.forEach(({ characters }) => {
        allCharacters = allCharacters.concat(characters);
      });

      // Sort characters by Member Since date
      allCharacters.sort(
        (a, b) => new Date(a.memberSince) - new Date(b.memberSince)
      );

      // Flatten the data and organize scores by date
      const flattenedData = allCharacters.reduce(
        (acc, { name, memberSince, scores }) => {
          scores.forEach(({ date, score }) => {
            acc.push({ name, memberSince, date, score });
          });
          return acc;
        },
        []
      );

      // Group scores by date
      const scoresByDate = flattenedData.reduce(
        (acc, { date, name, score }) => {
          acc[date] = acc[date] || {};
          acc[date][name] = score;
          return acc;
        },
        {}
      );

      // Extract unique dates and sort them
      let dates = Object.keys(scoresByDate);
      dates.sort((a, b) => new Date(a) - new Date(b));

      // Write the headers row to CSV file
      const headersRow = ["Name", "Member Since", ...dates];
      ws.write(headersRow.join(",") + "\r\n");

      // Write character scores to CSV file
      allCharacters.forEach(({ name, memberSince }) => {
        const scores = dates.map((date) => scoresByDate[date][name] || "");
        const characterRow = [name, `"${memberSince}"`, ...scores];
        ws.write(characterRow.join(",") + "\r\n");
      });

      ws.end();

      const attachment = new AttachmentBuilder("./culvert.csv");

      // Handle responses
      return interaction.reply({
        content: "Data has been successfully exported",
        files: [attachment],
      });
    } catch (error) {
      console.error("Error - Data could not be successfully exported", error);
      return interaction.reply(
        "Error - Data could not be successfully exported"
      );
    }
  },
};
