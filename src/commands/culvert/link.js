const { SlashCommandBuilder } = require("discord.js");
const culvertSchema = require("../../schemas/culvertSchema.js");
const { isCharacterLinked } = require("../../utility/culvertUtils.js");
const axios = require("axios");
const dayjs = require("dayjs");

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

module.exports = {
  data: new SlashCommandBuilder()
    .setName("link")
    .setDescription("Link a character to a Discord ID")
    .addStringOption((option) =>
      option
        .setName("character")
        .setDescription("The character to be linked")
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
    )
    .addBooleanOption((option) =>
      option
        .setName("override")
        .setDescription(
          "Force link the character, even if not present on rankings"
        )
    ),

  // ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

  async execute(interaction) {
    // Parse the command arguments
    const characterOption = interaction.options.getString("character");
    const userOption = interaction.options.getUser("discord_user");
    const memberSinceOption = interaction.options.getString("member_since");
    const overrideOption = interaction.options.getBoolean("override");

    // Check if the Member Since date is a valid date
    if (!dayjs(memberSinceOption).isValid()) {
      return interaction.reply(
        `Error - The date **${memberSinceOption}** is not valid. Make sure that it is properly formatted (ex: April 28 2023 or 04-28-2023)`
      );
    }

    const joinDate = dayjs(memberSinceOption).format("MMM DD, YYYY");

    // Check if the character is already linked to a user
    const characterLinked = await culvertSchema.exists({
      "characters.name": { $regex: `^${characterOption}$`, $options: "i" },
    });

    if (characterLinked) {
      return interaction.reply(
        `Error - The character **${characterOption}** is already linked to a user`
      );
    }

    // Determine explorer class name based on JobDetail
    function getClassName(res) {
      const jobMap = {
        Warrior: {
          12: "Hero",
          22: "Paladin",
          32: "Dark Knight",
        },
        Magician: {
          12: "Arch Mage (F/P)",
          22: "Arch Mage (I/L)",
          32: "Bishop",
        },
        Bowman: {
          12: "Bowmaster",
          22: "Marksman",
        },
        Thief: {
          12: "Night Lord",
          22: "Shadower",
        },
        Pirate: {
          12: "Buccaneer",
          22: "Corsair",
          32: "Cannoneer",
        },
      };

      const jobID = res.data.ranks[0]?.jobID;
      const jobDetail = res.data.ranks[0]?.jobDetail;

      return (
        (jobMap[jobID] && jobMap[jobID][jobDetail]) ||
        res.data.ranks[0]?.jobName
      );
    }

    // Fetch Maplestory ranking data
    const url = `https://www.nexon.com/api/maplestory/no-auth/v1/ranking/na?type=overall&id=legendary&reboot_index=1&page_index=1&character_name=${characterOption}`;

    axios
      .get(url)
      .then(async function (res) {
        // Create or update a user with the new character
        await culvertSchema.findOneAndUpdate(
          {
            _id: userOption.id,
          },
          {
            _id: userOption.id,
            graphColor: "255,189,213",
            $addToSet: {
              characters: {
                name: overrideOption
                  ? characterOption
                  : res.data.ranks[0]?.characterName,
                class: overrideOption ? "?" : getClassName(res),
                memberSince: joinDate,
              },
            },
          },
          {
            upsert: true,
          }
        );

        interaction.reply(
          `Linked **${
            overrideOption ? characterOption : res.data.ranks[0]?.characterName
          }** to ${userOption} ${
            overrideOption ? "(override)" : ""
          }\nMember since: ${joinDate}`
        );

        // Send an introduction to the newly linked user
        const culvertChannel = interaction.client.channels.cache.get(
          "1090037019557769256"
        );

        // Let the lab rat be tested on secretly...
        if (characterOption.toLowerCase() !== "druu") {
          culvertChannel.send(
            `Welcome to Saku, ${userOption}! Your character **${characterOption}** has just been linked to Saku's official discord bot.\n\nIn the ${culvertChannel} channel, you can view your culvert progression with various commands, such as \`/profile\` and \`/graph\`.\nSubmit your weekly scores with the \`/gpq\` command if you wish to view your stats early, otherwise they will be automatically submitted by the end of the week.\n\nTo learn more, use the \`/help\` command.`
          );
        }
      })
      .catch(function (error) {
        console.error(error);

        interaction.reply(
          `Error - The character **${characterOption}** could not be found on the rankings`
        );
      });
  },
};
