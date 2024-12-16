const { EmbedBuilder } = require("discord.js");
const { getDiscordUser, getDiscordUserRankings } = require("../../utility/userUtils.js");
const { getRequiredExp } = require("../../config/levels.js");

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

module.exports = {
    async execute(interaction) {
        try {
            // Get target user or default to command user
            const targetUser = interaction.options.getUser("user") || interaction.user;
            const targetMember = await interaction.guild.members.fetch(targetUser.id);
            
            const user = await getDiscordUser(targetUser.id);

            const rankings = await getDiscordUserRankings();
            const userRank = rankings.findIndex(u => u._id === targetUser.id);
            const rank = userRank === -1 ? "Unranked" : `#${userRank + 1}`;
            const requiredExp = getRequiredExp(user.level);

            const embed = new EmbedBuilder()
                .setColor(0xffc3c5)
                .setTitle(`${targetMember.nickname || targetUser.username}`)
                .addFields(
                    { name: "Rank", value: rank, inline: true },
                    { name: "Level", value: `${user.level}`, inline: true },
                    { name: "Experience", value: `${user.exp}/${requiredExp}`, inline: true }
                );

            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            console.error('Error fetching user info:', error);
            await interaction.reply({
                content: 'Error retrieving user information',
                ephemeral: true
            });
        }
    }
};
