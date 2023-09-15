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
    )
    .addStringOption((option) =>
      option
        .setName("member_since")
        .setDescription("The date that the character joined the guild")
        .setRequired(true)
    ),

  // ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

  async execute(client, interaction) {
    const characterName = interaction.options.getString("character_name");
    const discordUser = interaction.options.getUser("discord_user");
    const memberSince = interaction.options.getString("member_since");

    // Ranking API
    const url = `https://maplestory.nexon.net/api/ranking?id=overall&id2=legendary&rebootIndex=1&character_name=${characterName}&page_index=1`;

    // Check if character is linked to a user
    const characterLinked = await culvertSchema.exists({
      "characters.name": { $regex: `^${characterName}$`, $options: "i" },
    });

    // Determine class name based on JobDetail
    function getClassName(res) {
      if (res.data[0].JobName === "Warrior") {
        if (res.data[0].JobDetail === 12) return "Hero";
        if (res.data[0].JobDetail === 22) return "Paladin";
        if (res.data[0].JobDetail === 32) return "Dark Knight";
      }

      if (res.data[0].JobName === "Magician") {
        if (res.data[0].JobDetail === 12) return "Arch Mage (F/P)";
        if (res.data[0].JobDetail === 22) return "Arch Mage (I/L)";
        if (res.data[0].JobDetail === 32) return "Bishop";
      }

      if (res.data[0].JobName === "Bowman") {
        if (res.data[0].JobDetail === 12) return "Bowmaster";
        if (res.data[0].JobDetail === 22) return "Marksman";
      }

      if (res.data[0].JobName === "Thief") {
        if (res.data[0].JobDetail === 12) return "Night Lord";
        if (res.data[0].JobDetail === 22) return "Shadower";
      }

      if (res.data[0].JobName === "Pirate") {
        if (res.data[0].JobDetail === 12) return "Buccaneer";
        if (res.data[0].JobDetail === 22) return "Corsair";
        if (res.data[0].JobDetail === 32) return "Cannoneer";
      }

      return res.data[0].JobName;
    }

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
              graphColor: "31,119,180",
              $addToSet: {
                characters: {
                  name: res.data[0].CharacterName,
                  avatar:
                    "https://i.mapleranks.com/u/" +
                    res.data[0].CharacterImgUrl.slice(38), // Maplestory URL won't display an image, use the mapleranks URL instead
                  class: getClassName(res),
                  level: res.data[0].Level,
                  memberSince: memberSince,
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
