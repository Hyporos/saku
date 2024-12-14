const { SlashCommandBuilder } = require("discord.js");
const userSchema = require("../../schemas/userSchema.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("rank")
        .setDescription("Placeholder"),

    async execute(interaction) {
        try {
            const userId = interaction.user.id;
            const user = await userSchema.findOne({ _id: userId });

            if (!user) {
                return interaction.reply({
                    content: "Error - User not registered in the database",
                });
            }

            const rank = user.rank;
            const exp = user.exp;

            interaction.reply({
                content: `Your current rank is ${rank} and you have ${exp} exp`,
            });
        } catch (error) {
            console.error(error);
            interaction.reply({
                content: "Error - Could not retrieve rank or exp",
            });
        }
    },
};
