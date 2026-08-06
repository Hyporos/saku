const { SlashCommandBuilder } = require("discord.js");
const culvertSchema = require("../../schemas/culvertSchema.js");
const { isScoreSubmitted, getResetDates, nameMatch } = require("../../domain/culvert/utils.js");
const { matchScannedName, loadScanRoster, parseScanEntries } = require("../../domain/culvert/scanMatch.js");
const { readImage, fetchAttachment, CULVERT_SCAN_PROMPT } = require("../../features/scan/ocr.js");
const dayjs = require("dayjs");
require("dotenv").config();

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

module.exports = {
  tier: "bee",
  culvert: true,
  data: new SlashCommandBuilder()
    .setName("scan")
    .setDescription("[BEE] Submit bulk culvert data from a screenshot")
    .addAttachmentOption((option) =>
      option.setName("attach").setDescription("Image").setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("week")
        .setDescription("The specific week to submit the scores to")
        .setRequired(true)
        .addChoices(
          { name: "This week", value: "this_week" },
          { name: "Last week", value: "last_week" }
        )
    ),

  // ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

  async execute(interaction) {
    // Parse the comand arguments
    const imageOption = interaction.options.getAttachment("attach");
    const weekOption = interaction.options.getString("week");

    // Command may take longer to execute. Defer the initial reply.
    await interaction.deferReply();

    // Immediately show progress
    await interaction.editReply("Preparing to analyze image...");

    // Get the current reset date (Thursday 12:00 AM UTC)
    const { lastReset, reset } = getResetDates();
    const selectedWeek = weekOption === "this_week" ? reset : lastReset;

    // Read once, not once per scanned name — this used to re-query the whole exception collection
    // inside the parse loop, so a full guild list cost one query per line for no reason.
    const { linkedNames, applyException } = await loadScanRoster();

    async function updateProgress(progress, message) {
      await interaction.editReply(`${message} ${progress}%`);
    }

    await updateProgress(10, "Analyzing image...");

    const image = await fetchAttachment(imageOption);

    await updateProgress(20, "Analyzing image...");

    let entryArray;

    try {
      await updateProgress(30, "Processing image...");

      const text = await readImage({ prompt: CULVERT_SCAN_PROMPT, ...image });

      await updateProgress(60, "Processing image...");

      // Parse the AI response into the same format as OCR
      entryArray = text.trim().split(/\r?\n/);

      await updateProgress(70, "Submitting scores...");
    } catch (error) {
      console.error("Gemini API Error:", error);
      return interaction.editReply(error.quotaExhausted ? error.message : "Error - Failed to analyze the image with Gemini API.");
    }

    await updateProgress(80, "Submitting scores...");

    // NaNScores and zeroScores hold the very same objects that are in validScores, so renaming an
    // entry to its matched character updates all three at once. They used to be separate copies kept
    // in step by name, which quietly failed whenever two scanned lines shared a name.
    const { scores: validScores, unreadable: NaNScores, zeroed: zeroScores } =
      parseScanEntries(entryArray, applyException);
    const notFoundChars = [];

    let successCount = 0;

    await updateProgress(90, "Submitting scores...");

    for (const validCharacter of validScores) {
      // Matching lives in domain/culvert/scanMatch.js, shared with /culvertping and the webapp's
      // scanner route, so a screenshot name resolves to the same character whichever one reads it.
      const { name: matchedName } = matchScannedName(validCharacter.name, linkedNames);

      const user = matchedName
        ? await culvertSchema.findOne(
            { "characters.name": nameMatch(matchedName) },
            { "characters.$": 1, _id: 1 }
          )
        : null;
      const character = user?.characters[0];
      const userDiscordId = user?._id;

      // Perform the logic to set the score for the character
      // Don't perform any operations on characters that joined after the reset date
      if (character && (!character.memberSince || dayjs(character.memberSince).isBefore(dayjs(selectedWeek).add(1, 'week')))) {
        successCount++;

        // Check if a score has already been set for the selected week
        const scoreExists = await isScoreSubmitted(
          character.name,
          selectedWeek
        );

        // Shared object, so the NaN and zero lists pick this up too.
        validCharacter.name = character.name;
        validCharacter.discordId = userDiscordId;

        if (!scoreExists) {
          // Create a new score on the selected character
          await culvertSchema.findOneAndUpdate(
            {
              "characters.name": validCharacter?.name || "",
            },
            {
              $addToSet: {
                "characters.$[nameElem].scores": {
                  score: !isNaN(validCharacter.score)
                    ? validCharacter.score
                    : 0,
                  date: selectedWeek,
                },
              },
            },
            {
              arrayFilters: [
                {
                  "nameElem.name": character?.name || "",
                },
              ],
              new: true,
            }
          );
        } else {
          // Update an existing score on the selected character
          await culvertSchema.findOneAndUpdate(
            {
              "characters.name": character?.name || "",
              "characters.scores.date": selectedWeek,
            },
            {
              $set: {
                "characters.$[nameElem].scores.$[dateElem].score": !isNaN(
                  validCharacter.score
                )
                  ? validCharacter.score
                  : 0,
              },
            },
            {
              arrayFilters: [
                {
                  "nameElem.name": character?.name || "",
                },
                {
                  "dateElem.date": selectedWeek,
                },
              ],
              new: true,
            }
          );
        }

        // Find the character's best (highest) score
        const sortedScores = [...character.scores].sort(
          (a, b) => b.score - a.score
        );
        const bestScore = sortedScores[0]?.score || 0;

        // If the character scores less than 85% of their best, set a sandbag flag
        if (
          validCharacter.score !== 0 &&
          !isNaN(validCharacter.score) &&
          validCharacter.score < bestScore * 0.85
        ) {
          validCharacter.sandbag = true;
        }
      } else {
        notFoundChars.push({
          name: validCharacter.name,
          discordId: userDiscordId,
        });
      }
    }

    // Create the printed list of characters and the scores which were set
    function getSuccessList() {
      let content = "";

      validScores.forEach((character) => {
        // If the character's name could not be read, change their score to 0 (NAN) Otherwise, add to list
        const notFoundChar = notFoundChars.find(c => c.name === character.name);
        if (!notFoundChar) {
          const unreadable = NaNScores.find(n => n.name === character.name);
          if (unreadable) {
            content = content.concat(`${character.name}: **0 (NaN)**`);
          } else {
            content = content.concat(
              `${character.name}: **${character.score.toLocaleString()}**`
            );
          }

          // Add a sakuPeek emote if the character has sandbagged
          if (character.sandbag) {
            content = content.concat(` <:sakuPeek:1134862404900106381>\n`);
          } else {
            content = content.concat("\n");
          }
        }
      });

      return content;
    }

    // Display the list of characters which were read
    let response = `Submitted **${successCount - NaNScores.length}/${
      validScores.length
    }** scores for ${
      weekOption === "this_week"
        ? `this week (${reset})`
        : `last week (${lastReset})`
    }\n\n${getSuccessList()}`;

    // Display the error message for unreadable names
    if (notFoundChars.length > 0) {
      const notFoundNames = notFoundChars.map(char => `**${char.name}**`).join(', ');
      response = response.concat(
        `\n\nThe following characters could not be found:\n${notFoundNames}\n`
      );
    }

    // Display the error message for characters with unreadable scores
    if (NaNScores.length > 0) {
      response = response.concat(
        "\n\nThe following characters' scores could not be read and have defaulted to 0:\n"
      );
      for (const nanScore of NaNScores) {
        const discordId = nanScore.discordId || "Unknown";
        response = response.concat(`- **${nanScore.name}** | ID: ${discordId}\n`);
      }
    }

    // Display the list of characters with a score of 0
    if (zeroScores.length > 0) {
      const zeroScoreNames = zeroScores.map(z => `**${z.name}**`).join(', ');
      response = response.concat(
        `\n\nThe following characters have not submitted any scores:\n${zeroScoreNames}\n`
      );
    }

    await updateProgress(100, "Submitting scores...");

    // Discord caps a message at 2000 characters and a full guild list comfortably exceeds that.
    // `chunk` was declared with no keyword here, which quietly made it a global.
    for (let i = 0; i < response.length; i += 2000) {
      await interaction.followUp(response.slice(i, i + 2000));
    }
  },
};
