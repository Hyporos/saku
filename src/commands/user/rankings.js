const { generateUserRankingsCanvas } = require("../../canvas/userRankingsCanvas.js");
const userSchema = require("../../schemas/userSchema.js");

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

module.exports = {
  async execute(interaction) {
    try {
      // Retrieve the top 10 users by level and experience
      const users = await userSchema
        .find({})
        .sort({ level: -1, exp: -1 })
        .limit(10);

      // Run the function to generate the User Rankings canvas
      const attachment = await generateUserRankingsCanvas(interaction, users);

      // Send the Rankings embed
      await interaction.reply({ files: [attachment] });

    } catch (error) {
      console.error(error);
      await interaction.reply("Error - Could not retrieve rankings");
    }
  },
};
