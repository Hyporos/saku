const { Events } = require('discord.js');
const userSchema = require("../schemas/userSchema.js");

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

const cooldowns = new Map();
const COOLDOWN_DURATION = 60000; // 1 minute cooldown
const XP_AMOUNT = 5;

module.exports = {
    name: Events.MessageCreate,
    async execute(message) {
        // Ignore messages from bots
        if (message.author.bot) return;

        try {
            const userId = message.author.id;
            const now = Date.now();

            // Check cooldown
            if (cooldowns.has(userId)) {
                const expirationTime = cooldowns.get(userId) + COOLDOWN_DURATION;
                if (now < expirationTime) {
                    return;
                }
            }

            // Set new cooldown
            cooldowns.set(userId, now);

            // Find or create user and update XP
            const user = await userSchema.findOneAndUpdate(
                { _id: userId },
                { $inc: { exp: XP_AMOUNT } },
                { upsert: true, new: true }
            );

            console.log(`User ${userId} has gained ${XP_AMOUNT} exp. They now have ${user.exp} exp`);
        
        } catch (error) {
            console.error('Error - ', error);
        }
    }
};