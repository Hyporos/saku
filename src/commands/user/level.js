const { SlashCommandBuilder } = require("discord.js");
const { getDiscordUser, getDiscordUserRankings } = require("../../utility/userUtils.js");
const { getRequiredExp } = require("../../config/levels.js");

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

module.exports = {
  data: new SlashCommandBuilder()
    .setName("user")
    .setDescription("Discord User Commands")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("level")
        .setDescription("View your current level and exp")
    ),

  // ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

  async execute(interaction) {
    try {
        // Get user data and rankings
        const user = await getDiscordUser(interaction.user.id);
        const rankings = await getDiscordUserRankings();
        
        // Find user's rank
        const rank = rankings.findIndex(u => u._id === interaction.user.id) + 1;

        const requiredExp = getRequiredExp(user.level);

        await interaction.reply({
            content: `Rank: #${rank} | Level: ${user.level} | Experience: ${user.exp}/${requiredExp}`,
        });
    } catch (error) {
        console.error('Error fetching user info:', error);
        await interaction.reply({
            content: 'Error retrieving user information',
            ephemeral: true
        });
    }
},
};
