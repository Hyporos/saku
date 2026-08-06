const { SlashCommandBuilder } = require("discord.js");
const culvertSchema = require("../../schemas/culvertSchema.js");
const { nameMatch } = require("../../domain/culvert/utils.js");
const { matchScannedName, loadScanRoster } = require("../../domain/culvert/scanMatch.js");
const { readImage, fetchAttachment, CULVERTPING_PROMPT } = require("../../features/scan/ocr.js");
require("dotenv").config();

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

module.exports = {
  tier: "bee",
  culvert: true,
  data: new SlashCommandBuilder()
    .setName("culvertping")
    .setDescription("[BEE] Create a pingable list of people who need to run culvert")
    .addAttachmentOption((option) =>
      option.setName("attach").setDescription("Image").setRequired(true)
    ),

  // ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

  async execute(interaction) {
    // Parse the command arguments
    const imageOption = interaction.options.getAttachment("attach");

    // Command may take longer to execute. Defer the initial reply.
    await interaction.deferReply();

    // Immediately show progress
    await interaction.editReply("Preparing to analyze image...");

    // Read once, not once per scanned name.
    const { linkedNames, applyException } = await loadScanRoster();

    await interaction.editReply("Analyzing image...");

    const image = await fetchAttachment(imageOption);

    let nameArray;

    try {
      const text = await readImage({ prompt: CULVERTPING_PROMPT, ...image });

      // Parse the AI response into an array of names
      nameArray = text.trim().split(/\r?\n/).filter(name => name.length > 0);

      await interaction.editReply("Processing names...");
    } catch (error) {
      console.error("Gemini API Error:", error);
      return interaction.editReply(error.quotaExhausted ? error.message : "Error - Failed to analyze the image with Gemini API.");
    }

    // Array to store users who need to run culvert
    const usersNeedingCulvert = [];
    const notFoundNames = [];

    // Process each scanned name
    for (const scannedName of nameArray) {
      const checkedName = applyException(scannedName);

      // Matching lives in domain/culvert/scanMatch.js, shared with /scan and the webapp's scanner
      // route. This command used to have its own copy that skipped the confusable-letter folding, so
      // a name /scan matched happily came back "could not be found" here.
      const { name: matchedName } = matchScannedName(checkedName, linkedNames);

      const user = matchedName
        ? await culvertSchema.findOne(
            { "characters.name": nameMatch(matchedName) },
            { "characters.$": 1, _id: 1 }
          )
        : null;
      const character = user?.characters[0];
      const userDiscordId = user?._id;

      // Add matched user to the list
      if (character && userDiscordId) {
        // Check if we already have this user in the list (in case they have multiple characters)
        if (!usersNeedingCulvert.find(u => u.discordId === userDiscordId)) {
          usersNeedingCulvert.push({
            discordId: userDiscordId,
            characterName: character.name
          });
        }
      } else {
        // Character not found in database
        notFoundNames.push(checkedName);
      }
    }

    // Build the response message
    let pings = "";
    
    // Ping each user
    for (const user of usersNeedingCulvert) {
      pings += `<@${user.discordId}> `;
    }

    let response = "People who still need to run culvert\n```\n" + pings + "\n```";

    // Add list of names that couldn't be found
    if (notFoundNames.length > 0) {
      response += "\n\nThe following characters could not be found:\n";
      for (const name of notFoundNames) {
        response += `- **${name}**\n`;
      }
    }

    await interaction.editReply(response);
  },
};
