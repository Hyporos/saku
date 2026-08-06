const { Events } = require("discord.js");
const { trackEdit } = require("../domain/starboard.js");

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

// Editing a message that is already on the starboard used to leave the board showing the old text
// forever, which made it possible to have something starred and then quietly change what it said.
module.exports = {
  name: Events.MessageUpdate,
  async execute(_old, updated) {
    if (!updated?.id || updated.author?.bot) return;
    try {
      // Edits arrive partial when the message left the cache, and the new content is the whole point.
      if (updated.partial) await updated.fetch();
    } catch {
      return;
    }
    await trackEdit(updated);
  },
};
