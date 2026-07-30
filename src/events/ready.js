const { Events } = require("discord.js");
const mongoose = require("mongoose");
const os = require("os");
const { checkForCrashes } = require("../utility/botUtils");
const { setBirthdays, setAnniversaries } = require("../utility/cronUtils");
const { startLatencyMonitor } = require("../services/latencyMonitor");
const { refreshRosterMeta, refreshServerExtras } = require("../utility/sakuChat");

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
    setAnniversaries(client);

    // Start the server latency monitor
    await startLatencyMonitor(client);

    // Top up Saku's cached class/level data for the roster (slow, in the background)
    refreshRosterMeta();
    setInterval(refreshRosterMeta, 24 * 60 * 60 * 1000);

    // Prime the guild's pinned notes and scheduled events for Saku's chat context. No interval: the
    // chat path already refreshes this on its own TTL when someone talks, so a timer here was a
    // second schedule for one cache that would drift the moment that TTL changed.
    refreshServerExtras(guild);
  },
};
