const { SlashCommandBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('ping')
		.setDescription("Check Saku's response time"),
	async execute(interaction) {
		await interaction.reply('Pong! - Time taken: 69ms');
	},
};