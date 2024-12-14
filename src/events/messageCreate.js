const { Events } = require("discord.js");
const userSchema = require("../schemas/userSchema.js");
const { getRequiredExp } = require("../config/levels.js");

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

const EXCLUDED_CHANNELS = [
    '761406523950891059', // bot-spam
    '1090037019557769256', // culvert
    '807320077951172659', // bees-pls
    '1178171097858973746', // dannis-fan-club
    '913840369001709608', // karuta
    '1090002887410729090', // reminders-scan
    '1147319860481765500', // dev
    '720004340558856222', // admin-channel
    '821763840559153174', // admin-channel
    '1302748524110418011', // admin-channel
    '720118849155891302', // admin-channel
    '776872035754180610', // admin-channel 
    '788477119000084501', // admin-channel
];

const cooldowns = new Map();
const COOLDOWN_DURATION = 60000; // 1 minute cooldown, in milliseconds
const MIN_XP = 15;
const MAX_XP = 40;

module.exports = {
  name: Events.MessageCreate,
  async execute(message) {
    if (message.author.bot) return;
    if (message.content.length < 3) return;
    if (EXCLUDED_CHANNELS.includes(message.channelId)) return;

    try {
      const userId = message.author.id;
      const now = Date.now();

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

        await message.channel.send(
            `${message.author.toString()} has reached level **${newLevel}**.`
        );
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
