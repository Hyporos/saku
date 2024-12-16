const { Events } = require("discord.js");
const { starboardMessages } = require("../utility/starboardCache.js");

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

module.exports = {
  name: Events.MessageReactionRemove,
  async execute(reaction, user) {
    // Check if the reaction being removed is a star
    if (reaction.emoji.name === "🍉") {
      const message = reaction.message;

      const channel = message.guild.channels.cache.get("1090002887410729090");
      if (!channel) return;

      // Check if the message already exists in the starboard cache
      const starboardMessageId = starboardMessages.get(message.id);

      // Update the reaction count on the message content
      if (starboardMessageId) {
        const starboardMessage = await channel.messages.fetch(
          starboardMessageId
        );

        await starboardMessage.edit({
          content: `🍉 **${reaction.count}** <#${message.channel.id}>`,
          embeds: starboardMessage.embeds,
        });
      }
    }
  },
};
