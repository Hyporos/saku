const { Events } = require("discord.js");
const mongoose = require("mongoose");
const os = require("os");
const { checkForCrashes } = require("../utility/botUtils");
const { setBirthdays, setAnniversaries } = require("../utility/cronUtils");
const { startLatencyMonitor } = require("../services/latencyMonitor");
const { refreshRosterMeta, refreshServerExtras, setChatCommandId } = require("../utility/sakuChat");
const { reconcileStarboard } = require("../utility/starboard");
const { CHANNELS, GUILD_ID } = require("../config/ids.js");

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

module.exports = {
  name: Events.ClientReady,
  once: true,
  async execute(client) {
    // Set the activity of the bot
    client.user.setActivity("MapleStory | /help");

    // Connect to the database
    mongoose.connect(process.env.MONGO_URI);

    // Warm the caches everything else reads from, so nothing depends on a lazy fetch later. Members
    // back the roster's person search and pronoun lookups; emotes back Saku's own emote list and the
    // repair pass that rebuilds a misspelled :name: into a real one, which silently deletes emotes if
    // the cache is empty. Channels and roles arrive with the gateway payload, so they only get counted.
    const guild = await client.guilds.fetch(GUILD_ID);
    const [members, emojis, commands] = await Promise.all([
      guild.members.fetch(),
      guild.emojis.fetch(),
      // Commands are registered globally, so their ids live on the application. Only needed so a
      // slash command can be written as a clickable </chat:id> link instead of plain text.
      client.application.commands.fetch().catch(() => null),
    ]);
    setChatCommandId(commands?.find((c) => c.name === "chat")?.id);

    // Display event responses
    console.log(`Ready! Logged in as ${client.user.tag}`);
    console.log(
      `Cache warmed: ${members.size} members, ${emojis.size} emotes ` +
        `(${emojis.filter((e) => /^saku/i.test(e.name)).size} saku*), ${guild.channels.cache.size} channels, ${guild.roles.cache.size} roles`
    );

    // Report a recent crash to the server, if any
    if (os.hostname() !== "DESKTOP-15LSGET") {
      const channel = client.channels.cache.get(CHANNELS.CRASH_LOG);
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

    // Catch up the starboard on everything that happened while the process was down. Reaction events
    // only arrive while connected, so a message that crossed the threshold during a restart was
    // never posted and one that gained stars kept a stale number. Not awaited: it walks channel
    // history at a deliberately slow pace and nothing else needs to wait for it.
    reconcileStarboard(client);
  },
};
