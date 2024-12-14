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
 * Get sorted user rankings from the database
 * @param {Object} options - Query options
 * @param {number} [options.limit=10] - Number of users to return
 * @param {number} [options.skip=0] - Number of users to skip
 * @returns {Promise<Array>} Array of users sorted by level and exp
 */
async function getDiscordUserRankings({ limit = 10, skip = 0 } = {}) {
    try {
        const rankings = await userSchema
            .find({})
            .sort({ level: -1, exp: -1 })
            .limit(limit)
            .skip(skip);

        return rankings;
    } catch (error) {
        console.error("Error - ", error);
        return [];
    }
}

module.exports = {
  getDiscordUser,
  getDiscordUserRankings,
};
