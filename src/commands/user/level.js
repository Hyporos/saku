const { generateUserLevelCanvas } = require("../../canvas/userLevelCanvas.js");
const { getDiscordUser, getDiscordUserRankings } = require("../../utility/userUtils.js");
const { getRequiredExp } = require("../../config/levels.js");

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

module.exports = {
  async execute(interaction) {
    try {
      // Get target user or default to command user
      const targetUser = interaction.options.getUser("user") || interaction.user;
      const targetMember = await interaction.guild.members.fetch(targetUser.id);

      // Get user info from the database. If not found, set default values
      let user = await getDiscordUser(targetUser.id);
      if (!user) {
        user = { level: 1, exp: 0 };
      }

      // Set the rank for the user
      const rankings = await getDiscordUserRankings();
      const userRank = rankings.findIndex((u) => u._id === targetUser.id);
      const rank = userRank === -1 ? "Unranked" : `#${userRank + 1}`;

      // Get the required exp for the user's current level
      const requiredExp = getRequiredExp(user.level);

      // Run the function to generate the User Level canvas
      const attachment = await generateUserLevelCanvas(targetMember, user, requiredExp, rank);

      // Send the User Level canvas
      await interaction.reply({ files: [attachment] });

    } catch (error) {
      console.error(error);
      await interaction.reply("Error - Could not retrieve user information");
    }
  },
};
