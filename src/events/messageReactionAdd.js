const { Events, EmbedBuilder } = require("discord.js");
const { starboardMessages } = require("../utility/starboardCache.js");

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

module.exports = {
  name: Events.MessageReactionAdd,
  async execute(reaction, user) {
    // Check if the reaction to the message is a watermelon emoji
    if (reaction.emoji.id === "1318229624890593355") {
      const message = reaction.message;

      const channel = message.guild.channels.cache.get("1069832131938897950"); // #starboard
      if (!channel) return;

      // Fetch all users who reacted with :star_saku:
      try {
        const users = await reaction.users.fetch();
        // Exclude the message author from the reaction count
        const filteredUsers = users.filter((u) => u.id !== message.author.id);
        const reactionCount = filteredUsers.size;

        // If the message gets 10 or more stars, post it to the starboard
        if (reactionCount >= 10) {
          // Extract image URLs from message content
          const imageUrlMatch = message.content.match(
            /https?:\/\/\S+\.(jpg|jpeg|png|gif|webp)/i
          );
          const imageUrl = imageUrlMatch ? imageUrlMatch[0] : null;

          // If no image URL in content, check attachments
          let embedImage = null;
          let attachmentsDescription = "";

          if (!imageUrl && message.attachments.size > 0) {
            const attachment = message.attachments.first();
            const isImage = /\.(jpg|jpeg|png|gif|webp)/i.test(attachment.url);

            // If the attachment is an image, set it as the embed image. If not, add it to the description
            if (isImage) {
              embedImage = attachment.url;
            } else {
              attachmentsDescription = `**Attachment:** [${attachment.name}](${attachment.url})\n\n`;
            }
          }

          const logEmbed = new EmbedBuilder()
            .setAuthor({
              name: message.member?.nickname || message.author.username,
              iconURL: message.author.displayAvatarURL(),
            })
            .setColor(0xffc3c5)
            .setDescription(
              `${message.content}\n\n${attachmentsDescription}[Jump to message](https://discord.com/channels/${message.guildId}/${message.channelId}/${message.id})`
            )
            .setFooter({
              text: `${message.id} • ${message.createdAt.toLocaleString(
                "en-US",
                {
                  timeZone: user.timezone,
                  year: "numeric",
                  month: "2-digit",
                  day: "2-digit",
                }
              )}`,
            });

          // Set image from content URL or attachment
          if (imageUrl) {
            logEmbed.setImage(imageUrl);
          } else if (embedImage) {
            logEmbed.setImage(embedImage);
          }

          // TODO: instead of checking if it is in the cache, just check to see if it already has 1 star reaction 
          // Check if the message already exists in the starboard cache
          const starboardMessageId = starboardMessages.get(message.id);

          if (starboardMessageId) {
            // Edit the existing starboard message
            const starboardMessage = await channel.messages.fetch(
              starboardMessageId
            );
            await starboardMessage.edit({
              content: `<:star_saku:1318229624890593355> **${reactionCount}** <#${message.channel.id}>`,
              embeds: [logEmbed],
            });
          } else {
            // Send a new starboard message
            const starboardMessage = await channel.send({
              content: `<:star_saku:1318229624890593355> **${reactionCount}** <#${message.channel.id}>`,
              embeds: [logEmbed],
            });
            starboardMessages.set(message.id, starboardMessage.id);
          }
        }
      } catch (error) {
        console.error(`Error - Failed to process reactions or send starboard message: ${error}`);
      }
    }
  },
};
