const eventSchema = require("../../schemas/eventSchema.js");

module.exports = {
	async execute(interaction) {
		try {
			// Parse the command arguments
			const targetUser = interaction.options.getUser("user") || interaction.user;

			// Check and find the user in the event schema
			const user = await eventSchema.findById(targetUser.id);
			if (!user) {
				return await interaction.reply(`Hmmm... <@${targetUser.id}> hasn't logged any mob kills yet.`);
			}

            // Handle responses
            if (targetUser === interaction.user) {
                await interaction.reply(`You've hunted a total of ${user.mobcount.toLocaleString()} mobs since the start of this event.`);
            }
            else {
                await interaction.reply({ content: `<@${targetUser.id}> has hunted a total of ${user.mobcount.toLocaleString()} mobs since the start of this event.`, allowedMentions: { users: [] } });
            }

		} catch (error) {
			console.error(error);
			await interaction.reply("Error - Could not fetch mob count");
		}
	},
};
