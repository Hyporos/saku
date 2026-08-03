const userSchema = require("../schemas/userSchema.js");

/**
 * Get a user from the database by their Discord ID
 *
 * @param {string} userId - The discord user ID
 * @returns {Promise<Object|null>} - The discord user object
 */

async function getDiscordUser(userId) {
  try {
    const user = await userSchema.findOne({ _id: userId });
    return user;
  } catch (error) {
    console.error("Error - User is not registered in the database");
    return null;
  }
}

/**
 * Get a single user's position on the level leaderboard.
 *
 * Counted in the database rather than by pulling every user document down and searching the array,
 * which is what the level card used to do to work out one number.
 *
 * @param {{ level: number, exp: number }} user - The user to rank
 * @returns {Promise<number|null>} - Their 1-based position, ranked by level then EXP, or null
 */
async function getDiscordUserRank({ level, exp }) {
  try {
    const ahead = await userSchema.countDocuments({
      $or: [{ level: { $gt: level } }, { level, exp: { $gt: exp } }],
    });
    return ahead + 1;
  } catch (error) {
    console.error("Error - Could not rank the user:", error?.message ?? error);
    return null;
  }
}

module.exports = {
  getDiscordUser,
  getDiscordUserRank,
};
