const culvertSchema = require("../culvertSchema.js");

// Find a user object based on the given character
async function findUserByCharacter(characterOption, interaction) {
  const user = await culvertSchema.findOne({
    "characters.name": { $regex: `^${characterOption}$`, $options: "i" },
  });

  if (!user) {
    await interaction.reply(
      `Error - The character **${characterOption}** has not yet been linked`
    );
    return null;
  } else {
    return user;
  }
}

module.exports = { findUserByCharacter };
