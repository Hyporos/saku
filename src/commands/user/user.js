const { SlashCommandBuilder } = require("discord.js");
const levelCommand = require("./level.js");
const rankingsCommand = require("./rankings.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("user")
        .setDescription("Discord User Commands")
        .addSubcommand(subcommand =>
            subcommand
                .setName("level")
                .setDescription("View level and exp")
                .addUserOption(option =>
                    option
                        .setName("user")
                        .setDescription("Check another user")
                        .setRequired(false)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName("rankings")
                .setDescription("View the server leaderboard")
        ),

    async execute(interaction) {
        try {
            const subcommand = interaction.options.getSubcommand();
            
            switch (subcommand) {
                case "level":
                    await levelCommand.execute(interaction);
                    break;
                case "rankings":
                    await rankingsCommand.execute(interaction);
                    break;
                default:
                    await interaction.reply({
                        content: "Invalid subcommand",
                        ephemeral: true
                    });
            }
        } catch (error) {
            console.error("Error executing user command:", error);
            await interaction.reply({
                content: "There was an error executing this command",
                ephemeral: true
            });
        }
    }
};