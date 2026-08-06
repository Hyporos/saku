const { Events } = require("discord.js");
const { syncStarboard, isStarEmoji, fetchFullReaction } = require("../domain/starboard.js");

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

module.exports = {
  name: Events.MessageReactionRemove,
  async execute(reaction, user) {
    if (user?.bot) return;
    if (!(await fetchFullReaction(reaction))) return; // the message is gone, nothing left to re-count
    if (!isStarEmoji(reaction.emoji)) return;
    await syncStarboard(reaction.message, { reason: "star removed" });
  },
};
