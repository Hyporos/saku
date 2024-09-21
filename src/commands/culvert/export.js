const { SlashCommandBuilder, AttachmentBuilder } = require("discord.js");
const { Readable } = require("stream");
const culvertSchema = require("../../culvertSchema.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("export")
    .setDescription("Export a .csv of characters' scores for their respective dates"),

  async execute(interaction) {
    try {
      const data = await culvertSchema.find({});

      // Flatten the characters array from all users
      let allCharacters = [];
      data.forEach(({ characters }) => {
        allCharacters = allCharacters.concat(characters);
      });

      // Sort characters by Member Since date
      allCharacters.sort((a, b) => new Date(a.memberSince) - new Date(b.memberSince));

      // Flatten the data and organize scores by date
      const flattenedData = allCharacters.reduce((acc, { name, memberSince, scores }) => {
        scores.forEach(({ date, score }) => {
          acc.push({ name, memberSince, date, score });
        });
        return acc;
      }, []);

      // Group scores by date
      const scoresByDate = flattenedData.reduce((acc, { date, name, score }) => {
        acc[date] = acc[date] || {};
        acc[date][name] = score;
        return acc;
      }, {});

      // Extract unique dates and sort them
      let dates = Object.keys(scoresByDate);
      dates.sort((a, b) => new Date(a) - new Date(b));

      // Prepare CSV content
      const headersRow = ["Name", "Member Since", ...dates].join(",") + "\r\n";
      const rows = allCharacters.map(({ name, memberSince }) => {
        const scores = dates.map((date) => scoresByDate[date][name] || "");
        return [name, `"${memberSince}"`, ...scores].join(",") + "\r\n";
      });

      const csvContent = headersRow + rows.join("");

      // Create a readable stream from the CSV content
      const buffer = Buffer.from(csvContent, "utf-8");
      const readableStream = new Readable();
      readableStream.push(buffer);
      readableStream.push(null);

      const attachment = new AttachmentBuilder(readableStream, { name: "culvert.csv" });

      // Handle responses
      await interaction.reply({
        content: "Data has been successfully exported",
        files: [attachment],
      });
    } catch (error) {
      console.error("Error - Data could not be successfully exported", error);
      interaction.reply("Error - Data could not be successfully exported");
    }
  },
};
