const { Events } = require("discord.js");
const mongoose = require("mongoose");

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

module.exports = {
  name: Events.ClientReady,
  once: true,
  async execute(client) {
    // Set the activity of the bot
    client.user.setActivity("MapleStory | /help");

    // Connect to the database
    mongoose.connect(process.env.MONGO_URI);

    // Fetch all members for use on other events, instead of using the cache
    const guild = await client.guilds.fetch("719788426022617138");
    await guild.members.fetch();

    // Display event responses
    console.log(`Ready! Logged in as ${client.user.tag}`);
  },
};
