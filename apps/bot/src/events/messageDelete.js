const { Events } = require("discord.js");
const { forgetStarred } = require("../domain/starboard.js");

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

// A starred message being deleted used to leave its starboard post behind for good: the embed still
// showed the text, and its "Jump to message" link led nowhere. That also made the starboard a way to
// read something the author had taken back, which is the opposite of what deleting a message means.
module.exports = {
  name: Events.MessageDelete,
  async execute(message) {
    // Deletes usually arrive partial, carrying little more than an id. That is all this needs.
    if (!message?.id) return;
    await forgetStarred(message.id, message.client);
  },
};
