const { SlashCommandBuilder, AttachmentBuilder } = require("discord.js");
const fs = require("fs");
const culvertSchema = require("../../culvertSchema.js");

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

module.exports = {
  data: new SlashCommandBuilder()
    .setName("export")
    .setDescription("Export a .csv of characters' scores for their respective dates"),

  // ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

  async execute(interaction) {
    try {
      const data = await culvertSchema.find({}); // Fetch all data from the schema

      const ws = fs.createWriteStream(`culvert.csv`); // Create a write stream for CSV file

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
        const characterRow = [name, `"${memberSince}"`, ...scores]; // Wrap memberSince in double quotes
        ws.write(characterRow.join(",") + "\r\n");
      });

      ws.end(); // Close the write stream

      const attachment = new AttachmentBuilder("./culvert.csv"); // Create attachment builder with file path
      interaction.reply({
        content: "Data has been successfully exported",
        files: [attachment],
      });
    } catch (error) {
      interaction.reply("Error - Data could not be successfully exported");
    }
  },
};
