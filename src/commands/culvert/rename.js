const { SlashCommandBuilder } = require("discord.js");
const { findCharacter } = require("../../utility/culvertUtils.js");
const culvertSchema = require("../../schemas/culvertSchema.js");
const axios = require("axios");

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

module.exports = {
  data: new SlashCommandBuilder()
    .setName("rename")
    .setDescription("Rename a character")
    .addStringOption((option) =>
      option
        .setName("old_name")
        .setDescription("The character to be renamed")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("new_name")
        .setDescription("The new name to set for this character")
        .setRequired(true)
    )
    .addBooleanOption((option) =>
      option
        .setName("override")
        .setDescription(
          "Force rename the character, even if not present on rankings"
        )
    ),

  // ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

  async execute(interaction) {
    // Parse the command arguments
    const oldNameOption = interaction.options.getString("old_name");
    const newNameOption = interaction.options.getString("new_name");
    const overrideOption = interaction.options.getBoolean("override");

    // Find the specified character
    const character = await findCharacter(interaction, oldNameOption);
    if (!character) return;

    // Check if the new character name is already linked to a user
    const characterLinked = await culvertSchema.exists({
      "characters.name": { $regex: `^${newNameOption}$`, $options: "i" },
    });

    if (characterLinked) {
      return interaction.reply(
        `Error - The character **${newNameOption}** is already linked to a user`
      );
    }

    if (!overrideOption) {
      // Fetch Maplestory ranking data
      const url = `https://www.nexon.com/api/maplestory/no-auth/ranking/v2/na?type=overall&id=legendary&reboot_index=1&page_index=1&character_name=${newNameOption}`;

      axios
        .get(url)
        .then(async function (res) {
          // Check if the new character is on rankings and rename accordingly
          await culvertSchema.findOneAndUpdate(
            {
              "characters.name": {
                $regex: `^${oldNameOption}$`,
                $options: "i",
              },
            },
            {
              $set: { "characters.$.name": res.data.ranks[0]?.characterName },
            }
          );

          interaction.reply(
            `${oldNameOption}'s name has been changed to **${res.data.ranks[0]?.characterName}**`
          );
        })
        .catch(function (error) {
          console.error(error);

          interaction.reply(
            `Error - The character **${newNameOption}** could not be found on the rankings.`
          );
        });
    } else {
      await culvertSchema.findOneAndUpdate(
        {
          "characters.name": {
            $regex: `^${oldNameOption}$`,
            $options: "i",
          },
        },
        {
          $set: { "characters.$.name": newNameOption },
        }
      );

      interaction.reply(
        `${oldNameOption}'s name has been changed to **${newNameOption}** (override)`
      );
    }
  },
};
