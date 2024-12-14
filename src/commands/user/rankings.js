const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const userSchema = require("../../schemas/userSchema.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("rankingstest")
        .setDescription("View server rankings"),

    async execute(interaction) {
        try {
            const users = await userSchema
                .find({})
                .sort({ level: -1, exp: -1 })
                .limit(10);

            if (!users || users.length === 0) {
                return interaction.reply({
                    content: "No users found in the rankings yet!",
                    ephemeral: true
                });
            }

            const embed = new EmbedBuilder()
                .setColor(0x0099FF)
                .setTitle('🏆 Server Rankings')
                .setDescription('Top 10 users by level and experience')
                .setTimestamp();

            const rankings = users.map((user, index) => {
                const medal = index === 0 ? '🥇' : 
                            index === 1 ? '🥈' : 
                            index === 2 ? '🥉' : 
                            `${index + 1}.`;
                return `${medal} <@${user._id}> • Level ${user.level} • ${user.exp} XP`;
            });

            embed.addFields({ 
                name: 'Rankings', 
                value: rankings.join('\n') || 'No rankings available'
            });

            await interaction.reply({ embeds: [embed] });
            
        } catch (error) {
            console.error('Error fetching rankings:', error);
            await interaction.reply({
                content: 'Error retrieving rankings',
                ephemeral: true
            });
        }
    },
};