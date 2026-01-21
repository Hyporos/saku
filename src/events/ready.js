const { Events } = require("discord.js");
const mongoose = require("mongoose");
const os = require("os");
const { checkForCrashes } = require("../utility/botUtils");
const { setBirthdays } = require("../utility/cronUtils");
const { startFatalMonitor } = require("../services/fatalMonitor");

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

    // Report a recent crash to the server, if any
    if (os.hostname() !== "DESKTOP-15LSGET") {
      const channel = client.channels.cache.get("1288222696731054120");
      checkForCrashes(channel);
    }

    await setBirthdays(client);

    // Start the Fatal channel monitor
    await startFatalMonitor(client);
  },
};
