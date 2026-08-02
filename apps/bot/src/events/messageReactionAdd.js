const { Events, EmbedBuilder } = require("discord.js");
const { starboardMessages } = require("../utility/starboardCache.js");
const { recallTurn, formatTurnUsage, explainTurn, onCooldown } = require("../utility/sakuChat.js");

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

const EXPLAIN_EMOJI = "❓";
const RECEIPT_EMOJI = "💳";
const FORGOTTEN = "I don't have the working for that one any more, sorry. Ask me again and react to the new reply.";

// ❓ shows what a reply was built on, 💳 shows what it cost. Both only apply to Saku's own replies,
// and only to ones still in the turn memory, which is the recent few hundred.
async function handleSakuReaction(reaction, user) {
  const emoji = reaction.emoji.name;
  if (emoji !== EXPLAIN_EMOJI && emoji !== RECEIPT_EMOJI) return false;

  const message = reaction.message;
  if (message.author?.id !== reaction.client.user.id) return false;

  const record = recallTurn(message.id);
  if (!record) {
    await message.reply({ content: FORGOTTEN, allowedMentions: { parse: [] } }).catch(() => {});
    return true;
  }

  if (emoji === RECEIPT_EMOJI) {
    // Free: everything on the card was measured while the reply was being produced.
    await message.reply({ content: formatTurnUsage(record), allowedMentions: { parse: [] } }).catch(() => {});
    return true;
  }

  // Explaining costs a real request, so it shares the chat rate limit rather than being free to spam.
  if (onCooldown(user.id)) return true;
  await message.channel.sendTyping().catch(() => {});
  const explanation = await explainTurn(record);
  await message
    .reply({ content: explanation ?? "I couldn't put the working together just now, try again in a moment.", allowedMentions: { parse: [] } })
    .catch(() => {});
  return true;
}

module.exports = {
  name: Events.MessageReactionAdd,
  async execute(reaction, user) {
    if (user.bot) return;
    // A reaction on a message that has aged out of the cache arrives partial, with no author to check.
    try {
      if (reaction.partial) await reaction.fetch();
      if (reaction.message.partial) await reaction.message.fetch();
    } catch {
      return;
    }

    try {
      if (await handleSakuReaction(reaction, user)) return;
    } catch (error) {
      console.error("Error - Saku reaction handler failed:", error);
      return;
    }
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
              // `user` here is the Discord user who reacted, not a database document, so the
              // timeZone this used to pass was always undefined and the date has always rendered in
              // the host's timezone. Stated outright now instead of looking like a per-user setting.
              text: `${message.id} • ${message.createdAt.toLocaleString("en-US", {
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
