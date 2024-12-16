const { Events, EmbedBuilder } = require("discord.js");
const { starboardMessages } = require("../utility/starboardCache.js");

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

module.exports = {
  name: Events.MessageReactionAdd,
  async execute(reaction, user) {
    // Check if the reaction to the message is a star
    if (reaction.emoji.name === "🍉") {
      const message = reaction.message;

      const channel = message.guild.channels.cache.get("1090002887410729090"); // #starboard
      if (!channel) return;

      // If the message gets 10 or more stars, post it to the starboard
      if (reaction.count >= 1) {
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
            text: `${message.id} • ${message.createdAt.toLocaleString("en-US", {
              timeZone: user.timezone,
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
            })}`,
          });

        // Set image from content URL or attachment
        if (imageUrl) {
          logEmbed.setImage(imageUrl);
        } else if (embedImage) {
          logEmbed.setImage(embedImage);
        }

        // Check if the message already exists in the starboard cache
        const starboardMessageId = starboardMessages.get(message.id);

        if (starboardMessageId) {
          // Edit the existing starboard message
          const starboardMessage = await channel.messages.fetch(
            starboardMessageId
          );
          await starboardMessage.edit({
            content: `🍉 **${reaction.count}** <#${message.channel.id}>`,
            embeds: [logEmbed],
          });
        } else {
          // Create a new starboard message
          const starboardMessage = await channel.send({
            content: `🍉 **${reaction.count}** <#${message.channel.id}>`,
            embeds: [logEmbed],
          });
          starboardMessages.set(message.id, starboardMessage.id);
        }
      }
    }
  },
};
