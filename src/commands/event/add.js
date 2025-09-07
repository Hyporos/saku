const eventSchema = require("../../schemas/eventSchema.js");

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

module.exports = {
  async execute(interaction) {
    try {
      const count = interaction.options.getInteger("count");
      const targetUser = interaction.options.getUser("user") || interaction.user;
      const isSelf = targetUser.id === interaction.user.id;

      // Only allow users with the Bee role or admins to add for other users
      if (!isSelf) {
        if (!interaction.member.roles.cache.has("720001044746076181")) {
          return await interaction.reply({ content: "Error - You do not have permission to add mob count for other users.", ephemeral: true });
        }
      }

      // Find or create the user in the event schema
      let user = await eventSchema.findById(targetUser.id);
      if (!user) {
        user = await eventSchema.create({ _id: targetUser.id, mobcount: count });
      } else {
        user.mobcount += count;
        await user.save();
      }

      // Handle response
      if (isSelf) {
        await interaction.reply(`You've added ${count.toLocaleString()} mobs to your total count! You now have ${user.mobcount.toLocaleString()} mobs.`);
      } else {
        await interaction.reply(`Added ${count.toLocaleString()} mobs to <@${targetUser.id}>'s total count.\nThey now have ${user.mobcount.toLocaleString()} mobs.`);
      }
    } catch (error) {
      console.error(error);
      await interaction.reply("Error - Could not add mob count");
    }
  },
};
