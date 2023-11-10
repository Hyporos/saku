const { SlashCommandBuilder } = require("discord.js");
const culvertSchema = require("../../culvertSchema.js");
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
    ),

  // ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

  async execute(interaction) {
    // Parse the command arguments
    const oldNameOption = interaction.options.getString("old_name");
    const newNameOption = interaction.options.getString("new_name");

    // Find the user with the specified character
    const user = await culvertSchema.findOne({
      "characters.name": { $regex: `^${oldNameOption}$`, $options: "i" },
    });

    if (!user) {
      return interaction.reply(
        `Error ⎯ The character **${oldNameOption}** has not yet been linked`
      );
    }

    // Check if the new character name is already linked to a user
    const characterLinked = await culvertSchema.exists({
      "characters.name": { $regex: `^${newNameOption}$`, $options: "i" },
    });

    if (characterLinked) {
      return interaction.reply(
        `Error ⎯ The character **${newNameOption}** is already linked to a user`
      );
    }

    // Fetch Maplestory ranking data
    const url = `https://maplestory.nexon.net/api/ranking?id=overall&id2=legendary&rebootIndex=1&character_name=${newNameOption}&page_index=1`;

    axios
      .get(url)
      .then(async function (res) {
        // Rename the character. Check if the new name is valid
        await culvertSchema.findOneAndUpdate(
          {
            "characters.name": { $regex: `^${oldNameOption}$`, $options: "i" },
          },
          {
            $set: { "characters.$.name": res.data[0].CharacterName },
          }
        );

        interaction.reply(
          `${oldNameOption}'s name has been changed to **${res.data[0].CharacterName}**`
        );
      })
      .catch(function (error) {
        interaction.reply(
          `Error ⎯ The character **${newNameOption}** could not be found on the rankings`
        );

        console.error(error);
      });
  },
};
