const eventSchema = require("../../schemas/eventSchema.js");

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

module.exports = {
    async execute(interaction) {
        try {
            const targetUser = interaction.options.getUser("user");
            const count = interaction.options.getInteger("count");

            // Check if target user value exists
            if (!targetUser) {
                return await interaction.reply("Error - Please specify a valid user.");
            }

            // Check if target user exists in the database
            let user = await eventSchema.findById(targetUser.id);
            if (!user) {
                return await interaction.reply(`Error - User not found in the event database.`);
            }

            // Subtract from the user's total mob count
            user.mobcount = Math.max(0, user.mobcount - count);
            await user.save();

            // Handle response
            await interaction.reply(`Subtracted ${count.toLocaleString()} mobs from <@${targetUser.id}>'s total count.\nThey now have ${user.mobcount.toLocaleString()} mobs.`);

        } catch (error) {
            console.error(error);
            await interaction.reply("Error - Could not subtract mob count");
        }
    },
};
