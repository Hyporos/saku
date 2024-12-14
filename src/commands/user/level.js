const { EmbedBuilder } = require("discord.js");
const { getDiscordUser, getDiscordUserRankings } = require("../../utility/userUtils.js");
const { getRequiredExp } = require("../../config/levels.js");

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

module.exports = {
    async execute(interaction) {
        try {
            const user = await getDiscordUser(interaction.user.id);
            const rankings = await getDiscordUserRankings();
            const rank = rankings.findIndex((u) => u._id === interaction.user.id) + 1;
            const requiredExp = getRequiredExp(user.level);

            const embed = new EmbedBuilder()
                .setColor(0xffc3c5)
                .setTitle(`${interaction.user.username}`)
                .addFields(
                    { name: "Rank", value: `#${rank}`, inline: true },
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
