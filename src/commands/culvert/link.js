//TODO - Set Class to JobDetail

const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const culvertSchema = require("../../culvertSchema.js");
const axios = require("axios");

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

module.exports = {
  data: new SlashCommandBuilder()
    .setName("link")
    .setDescription("Link a character to your Discord ID")
    .addStringOption((option) =>
      option
        .setName("character_name")
        .setDescription("The character name to be linked")
        .setRequired(true)
    )
    .addUserOption((option) =>
      option
        .setName("discord_user")
        .setDescription("The Discord user to be paired with the character")
        .setRequired(true)
    ),

  // ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

  async execute(client, interaction) {
    // Get option values
    const characterName = interaction.options.getString("character_name");
    const discordUser = interaction.options.getUser("discord_user");

    // Ranking API
    const url = `https://maplestory.nexon.net/api/ranking?id=overall&id2=legendary&rebootIndex=1&character_name=${characterName}&page_index=1`;

    // Check if character is linked to user
    const characterLinked = await culvertSchema.exists({
      "characters.name": characterName,
    });

    // Fetch Maplestory ranking data
    axios
      .get(url)
      .then(async function (res) {
        // Create or update a user entry and link a character (if not already linked)
        if (!characterLinked) {
          await culvertSchema.findOneAndUpdate(
            {
              _id: discordUser.id,
            },
            {
              _id: discordUser.id,
              $addToSet: {
                characters: {
                  name: characterName,
                  avatar:
                    "https://i.mapleranks.com/u/" +
                    res.data[0].CharacterImgUrl.slice(38), // Maplestory URL won't display an image, use the mapleranks URL instead
                  class: res.data[0].JobName,
                  level: res.data[0].Level,
                },
              },
            },
            {
              upsert: true,
            }
          );
        }
        // Display responses
        if (characterLinked) {
          interaction.reply(
            `Error ⎯ The character **${characterName}** is already linked`
          );
        } else {
          interaction.reply(
            `Linked **${characterName}** to ${discordUser}\nUser ID: ${discordUser.id}`
          );
        }
      })
      .catch(function (error) {
        const rankings =
          "https://maplestory.nexon.net/rankings/overall-ranking/legendary?rebootIndex=1";
        interaction.reply(
          `Error ⎯ The character **${characterName}** could not be found on the [rankings](<${rankings}>)`
        );
      });
  },
};
