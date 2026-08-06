const { Events } = require("discord.js");
const userSchema = require("../schemas/userSchema.js");
const { getRequiredExp } = require("../config/levels.js");
const { NO_XP_CHANNELS } = require("../config/ids.js");

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

const cooldowns = new Map();
const COOLDOWN_DURATION = 60000; // 1 minute cooldown, in milliseconds
const MIN_XP = 15;
const MAX_XP = 40;

function isOnlyEmojis(message) {
  // Discord custom emoji pattern <:name:id> or <a:name:id>
  const customEmojiPattern = /<a?:\w+:\d+>/g;
  
  // Remove custom emojis from content
  const contentWithoutCustomEmojis = message.content.replace(customEmojiPattern, '');
  
  // Check if remaining content is empty or only unicode emojis
  return contentWithoutCustomEmojis.trim() === '' || 
         [...contentWithoutCustomEmojis].every(char => /\p{Emoji}/u.test(char));
}

function hasGif(message) {
  // Check attachments
  const hasGifAttachment = message.attachments.some(attachment => 
      attachment.contentType?.includes('image/gif') || 
      attachment.url?.toLowerCase().endsWith('.gif')
  );
  
  // Check embeds and URLs in content
  const hasGifUrl = message.embeds?.some(embed => 
      embed.url?.toLowerCase().endsWith('.gif')
  ) || /https?:\/\/\S+\.gif/i.test(message.content);
  
  return hasGifAttachment || hasGifUrl;
}

module.exports = {
  name: Events.MessageCreate,
  async execute(message) {
    if (message.author.bot) return;
    if (message.content.length < 5) return;
    if (NO_XP_CHANNELS.has(message.channelId)) return;
    if (isOnlyEmojis(message) || hasGif(message)) return;

    try {
      const userId = message.author.id;
      const now = Date.now();

      // Check if the user is on cooldown
      if (cooldowns.has(userId)) {
        const expirationTime = cooldowns.get(userId) + COOLDOWN_DURATION;
        if (now < expirationTime) return;
      }

      cooldowns.set(userId, now);

      // Generate random XP between 15 and 40
      const randomXP =
        Math.floor(Math.random() * (MAX_XP - MIN_XP + 1)) + MIN_XP;

      // Get user's current data
      const user = await userSchema.findOne({ _id: userId });
      const currentLevel = user?.level || 1;
      let updatedExp = (user?.exp || 0) + randomXP;
      let newLevel = user?.level || 1;

      // Get new level and required XP
      const requiredExp = getRequiredExp(currentLevel);

      // Calculate remaining XP after level up
      if (updatedExp >= requiredExp) {
        updatedExp -= requiredExp;
        newLevel++;

        try {
          await message.channel.send(
            `${message.member?.nickname || message.author.username} has reached level **${newLevel}**!`
          );
        } catch (sendError) {
          console.error("Failed to send level up message - ", sendError);
        }
      }

      // Update user with new exp and level
      await userSchema.findOneAndUpdate(
        { _id: userId },
        {
          $set: {
            level: newLevel,
            exp: updatedExp,
          },
        },
        { upsert: true, new: true }
      );
    } catch (error) {
      console.error("Error - ", error);
    }
  },
};
