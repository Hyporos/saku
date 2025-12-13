const { SlashCommandBuilder } = require("discord.js");
const culvertSchema = require("../../schemas/culvertSchema.js");
const exceptionSchema = require("../../schemas/exceptionSchema.js");
const {
  getAllCharacters,
  isScoreSubmitted,
  getResetDates,
} = require("../../utility/culvertUtils.js");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const dayjs = require("dayjs");
require("dotenv").config();

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

module.exports = {
  data: new SlashCommandBuilder()
    .setName("scan")
    .setDescription("Submit bulk culvert data from a screenshot")
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

    // Get a list of all currently linked characters
    const characterList = await getAllCharacters();

    // Find an exception for the character name. if no exception exists, keep the entry name
    async function checkExceptions(entryName) {
      const exceptions = await exceptionSchema.find({});

      const exception = exceptions.find(
        (entry) => entryName.toLowerCase() === entry.exception.toLowerCase()
      );
      const returnedName = exception ? exception.name : entryName;

      return returnedName;
    }

    async function fetchBuffer(url) {
      const res = await fetch(url);
      if (!res.ok) throw new Error("Image fetch failed");
      return Buffer.from(await res.arrayBuffer());
    }

    // Initialize Gemini AI
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    // Progress tracking
    let currentProgress = 0;
    async function updateProgress(progress, message) {
      currentProgress = progress;
      await interaction.editReply(`${message} ${progress}%`);
    }

    await updateProgress(10, "Analyzing image...");

    // Fetch the image and convert to base64
    const imageBuffer = await fetchBuffer(imageOption.proxyURL || imageOption.url);
    const base64Image = imageBuffer.toString('base64');

    await updateProgress(20, "Analyzing image...");

    const prompt = `You are analyzing a MapleStory guild culvert participation screenshot.
Extract ONLY the character names and their culvert scores from this image.

The format should be one entry per line: CharacterName Score

Rules:
- Only include the character name (first column) and the culvert score (last number in the row)
- Ignore all other columns (class, level, world, guild, etc.)
- If a score cannot be read or is blank/hidden, use 0
- Return ONLY the name and score separated by a space, nothing else
- Each entry on a new line
- Preserve exact character names including special characters (ö, á, etc.)
- Do not include headers or any other text

Example output:
PlayerName1 63100
PlayerName2 62918
PlayerName3 0`;

    let entryArray;
    
    try {
      await updateProgress(30, "Processing image...");
      
      const result = await model.generateContent([
        {
          inlineData: {
            data: base64Image,
            mimeType: imageOption.contentType || "image/png"
          }
        },
        prompt
      ]);

      await updateProgress(60, "Processing image...");

      const response = await result.response;
      const text = response.text();

      // Parse the AI response into the same format as OCR
      entryArray = text.trim().split(/\r?\n/);

      await updateProgress(70, "Submitting scores...");
    } catch (error) {
      console.error("Gemini API Error:", error);
      return interaction.editReply(
        "Error - Failed to analyze the image with Gemini API."
      );
    }

    // Declare necessary variables
    const validScores = [];
    const NaNScores = [];
    const zeroScores = [];
    const notFoundChars = [];

    let successCount = 0;
    let failureCount = 0;

    await updateProgress(80, "Submitting scores...");

    // Select name and score from each entry and push into a separate array
    for (const entry of entryArray) {
      const entryParts = entry.split(" ");
      const name = entryParts[0];
      const score = Number(entryParts.pop());

      if (name) {
        const checkedName = await checkExceptions(name);
        if (isNaN(score)) {
          // Log character names which have invalid scores
          NaNScores.push({ name: checkedName });
        } else if (score === 0) {
          // Log character names which have a score of 0
          zeroScores.push({ name: checkedName });
        }
        // Log character names which are valid
        validScores.push({
          name: checkedName,
          score,
          sandbag: false,
        });
      }
    }

    await updateProgress(90, "Submitting scores...");

    let processedCount = 0;
    const totalCharacters = validScores.length;

    for (const validCharacter of validScores) {
      const matchingNames = [];

      // Check if the name is truncated with ellipsis (., .., or ...)
      const isTruncated = validCharacter.name.endsWith("...") || 
                          validCharacter.name.endsWith("..") || 
                          validCharacter.name.endsWith(".");
      
      let nameBeginning, nameEnd, truncatedPrefix;
      
      if (isTruncated) {
        // For truncated names, remove the ellipsis and use the entire prefix for matching
        if (validCharacter.name.endsWith("...")) {
          truncatedPrefix = validCharacter.name.slice(0, -3);
        } else if (validCharacter.name.endsWith("..")) {
          truncatedPrefix = validCharacter.name.slice(0, -2);
        } else {
          truncatedPrefix = validCharacter.name.slice(0, -1);
        }
        nameBeginning = truncatedPrefix.substring(0, 4);
      } else {
        // Get the first and last 4 letters of the character name to use for better database matching
        nameBeginning = validCharacter.name.substring(0, 4);
        nameEnd = validCharacter.name.substring(
          validCharacter.name.length - 4
        );
      }

      for (const character of characterList) {
        if (!character.name) continue;

        if (isTruncated) {
          // For truncated names, match any name that starts with the truncated prefix
          if (character.name.toLowerCase().startsWith(truncatedPrefix.toLowerCase())) {
            matchingNames.push(character.name.toLowerCase());
          }
        } else {
          // Find all names which match with the iterated nameBeginning or nameEnd
          const isNameMatching = character.name
            .toLowerCase()
            .match(new RegExp(`^${nameBeginning}|${nameEnd}$`, "gi"));

          // Store matched character names in a separate array
          if (isNameMatching && isNameMatching.length > 0) {
            matchingNames.push(character.name.toLowerCase());
          }
        }
      }

      // Set the character to the the proper character in the scanned entry
      let character;
      let userDiscordId;

      // If more than one name was matched, perform a more accurate search
      if (matchingNames.length > 1) {
        for (const duplicateName of matchingNames) {
          const searchName = isTruncated 
            ? truncatedPrefix.toLowerCase() 
            : validCharacter.name.toLowerCase();
          
          if (isTruncated) {
            // For truncated names, find the name that starts with the prefix
            if (duplicateName.startsWith(searchName)) {
              // Find the specified duplicate character
              const user = await culvertSchema.findOne(
                {
                  "characters.name": {
                    $regex: `^${duplicateName}$`,
                    $options: "i",
                  },
                },
                { "characters.$": 1, _id: 1 }
              );
              character = user?.characters[0];
              userDiscordId = user?._id;
              break; // Take the first match
            }
          } else if (duplicateName.includes(searchName)) {
            // Find the specified duplicate character
            const user = await culvertSchema.findOne(
              {
                "characters.name": {
                  $regex: `^${duplicateName}$`,
                  $options: "i",
                },
              },
              { "characters.$": 1, _id: 1 }
            );
            character = user?.characters[0];
            userDiscordId = user?._id;
          }
        }
      } else {
        // Find the specified character, when no duplicates found
        if (isTruncated) {
          // For truncated names with a single match, use the matched name
          const matchedName = matchingNames[0];
          const user = await culvertSchema.findOne(
            {
              "characters.name": { $regex: `^${matchedName}$`, $options: "i" },
            },
            { "characters.$": 1, _id: 1 }
          );
          character = user?.characters[0];
          userDiscordId = user?._id;
        } else {
          const namePattern = `${nameBeginning}|${nameEnd}`;
          const user = await culvertSchema.findOne(
            {
              "characters.name": { $regex: `^${namePattern}$`, $options: "i" },
            },
            { "characters.$": 1, _id: 1 }
          );
          character = user?.characters[0];
          userDiscordId = user?._id;
        }
      }

      // Perform the logic to set the score for the character
      // Don't perform any operations on characters that joined after the reset date
      if (character && dayjs(character.memberSince).isBefore(dayjs(selectedWeek).add(1, 'week'))) {
        successCount++;

        // Check if a score has already been set for the selected week
        const scoreExists = await isScoreSubmitted(
          character.name,
          selectedWeek
        );

        // Update the name of the validCharacter to the one found in the database
        const oldName = validCharacter.name;
        validCharacter.name = character.name;
        validCharacter.discordId = userDiscordId;

        // Also update the NaNScores entry if this character has a NaN score
        const nanScoreEntry = NaNScores.find(n => n.name === oldName || n.name === character.name);
        if (nanScoreEntry) {
          nanScoreEntry.name = character.name;
          nanScoreEntry.discordId = userDiscordId;
        }

        // Also update the zeroScores entry if this character has a score of 0
        const zeroScoreEntry = zeroScores.find(z => z.name === oldName || z.name === character.name);
        if (zeroScoreEntry) {
          zeroScoreEntry.name = character.name;
          zeroScoreEntry.discordId = userDiscordId;
        }

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
        failureCount++;
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
          const isNaN = NaNScores.find(n => n.name === character.name);
          if (isNaN) {
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
      response = response.concat(
        "\n\nThe following characters could not be found:\n"
      );

      for (const char of notFoundChars) {
        response = response.concat(`- **${char.name}**\n`);
      }
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
      response = response.concat(
        "\n\nThe following characters have not submitted any scores:\n"
      );
      for (const zeroScore of zeroScores) {
        const discordId = zeroScore.discordId || "Unknown";
        response = response.concat(`- **${zeroScore.name}** | ID: ${discordId}\n`);
      }
    }

    // If message is longer than 2000 characters, split into multiple messages
    function splitMessage(str, size) {
      const numChunks = Math.ceil(str.length / size);
      const chunks = new Array(numChunks);

      for (let i = 0, c = 0; i < numChunks; ++i, c += size) {
        chunks[i] = str.substr(c, size);
      }

      return chunks;
    }

    await updateProgress(100, "Submitting scores...");

    const messageChunks = splitMessage(response, 2000);

    for (chunk of messageChunks) {
      await interaction.followUp(chunk);
    }
  },
};
