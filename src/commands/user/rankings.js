const { EmbedBuilder } = require("discord.js");
const userSchema = require("../../schemas/userSchema.js");

module.exports = {
    async execute(interaction) {
        try {
            const users = await userSchema
                .find({})
                .sort({ level: -1, exp: -1 })
                .limit(10);
    
            const embed = new EmbedBuilder()
                .setColor(0xffc3c5)
                .setTitle('Server Rankings')
                .setDescription('Top 10 users by level and experience');
            
            const rankings = await Promise.all(users.map(async (user, index) => {
                const member = await interaction.guild.members.fetch(user._id);
                let nickname = member.nickname || member.user.username;
                
                if (nickname.length > 20) {
                    nickname = nickname.substring(0, 17) + '...';
                }
                
                return `\`${(index + 1).toString().padEnd(3)} ${nickname.padEnd(23)} Level ${user.level.toString().padEnd(3)}  ${user.exp} XP\``;
            }));
            
            embed.addFields({ 
                name: '\u200B',
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
    }
};