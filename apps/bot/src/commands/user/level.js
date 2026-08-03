const { generateUserLevelCanvas } = require("../../canvas/userLevelCanvas.js");
const { getDiscordUser, getDiscordUserRank } = require("../../utility/userUtils.js");
const { getRequiredExp } = require("../../config/levels.js");

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

module.exports = {
  async execute(interaction) {
    // Two queries, a member fetch, an avatar download and a PNG encode all happen below. Replying
    // straight out of that raced Discord's three second window, and when it lost, the catch tried to
    // reply to an interaction that no longer existed and threw again, so nothing was shown at all.
    await interaction.deferReply();

    try {
      // Get target user or default to command user
      const targetUser = interaction.options.getUser("user") || interaction.user;
      const targetMember = await interaction.guild.members.fetch(targetUser.id);

      // Get user info from the database. If not found, set default values
      const user = (await getDiscordUser(targetUser.id)) ?? { level: 1, exp: 0 };

      // Counted in the database rather than by downloading every user document and searching it,
      // which is what this used to do to find one position.
      const position = user._id ? await getDiscordUserRank(user) : null;
      const rank = position ? `#${position}` : "Unranked";

      // Get the required exp for the user's current level
      const requiredExp = getRequiredExp(user.level);

      // Run the function to generate the User Level canvas
      const attachment = await generateUserLevelCanvas(targetMember, user, requiredExp, rank);

      // Send the User Level canvas
      await interaction.editReply({ files: [attachment] });
    } catch (error) {
      console.error("Error - /user level failed:", error);
      await interaction.editReply("Error - Could not retrieve user level").catch(() => {});
    }
  },
};
