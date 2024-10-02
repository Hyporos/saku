const { SlashCommandBuilder } = require("discord.js");
const culvertSchema = require("../../schemas/culvertSchema.js");
const exceptionSchema = require("../../schemas/exceptionSchema.js");
const {
  getAllCharacters,
  isScoreSubmitted,
  getResetDates,
} = require("../../utility/culvertUtils.js");
const { createWorker } = require("tesseract.js");
const Jimp = require("jimp");

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

    // Process the image
    const image = await Jimp.read(imageOption.proxyURL);
    const buffer = await image
      .contrast(1)
      .grayscale()
      .invert()
      .scale(1.4)
      .getBufferAsync(Jimp.MIME_JPEG);

    // Create a state object to track OCR progress
    let logState = {
      status: "",
      progress: 0,
      lastReportedProgress: 0,
    };

    // List of statuses to exclude
    const excludedStatuses = [
      "loaded tesseract core",
      "initialized tesseract",
      "loading language traineddata (from cache)",
      "loaded language traineddata",
      "initialized api",
      "recognizing text",
    ];

    // Capitalize the first letter of the string (used for OCR status)
    function capitalizeFirstLetter(string) {
      return string.charAt(0).toUpperCase() + string.slice(1);
    }

    function setLog(newState) {
      logState = { ...logState, ...newState };

      const isRecognizingText = logState.status === "recognizing text";
      const roundedProgress = Math.floor(logState.progress * 10) * 10; // Round progress to nearest 10%

      // Update "processing image..." percentage
      if (
        isRecognizingText &&
        roundedProgress !== logState.lastReportedProgress
      ) {
        logState.lastReportedProgress = roundedProgress;
        interaction.editReply(`Processing image... ${roundedProgress}%`);
      }

      // Update status message if it has changed and is not excluded
      else if (!excludedStatuses.includes(logState.status)) {
        interaction.editReply(`${capitalizeFirstLetter(logState.status)}...`);
      }
    }

    // Use OCR to read all text in the image
    const worker = await createWorker({
      logger: (message) => {
        setLog({
          status: message.status,
          progress: message.progress,
        });
      },
      cachePath: "./tessdata",
    });

    const processTextEntries = async () => {
      interaction.editReply("Loading tesseract core...");

      await worker.loadLanguage("eng+fra+spa+dan+swe+ita");
      await worker.initialize("eng+fra+spa+dan+swe+ita");
      await worker.setParameters({
        tessedit_char_blacklist: ",.…",
      });

      const {
        data: { text },
      } = await worker.recognize(buffer);

      await worker.terminate();

      // Return an array of each entry/line in the culvert score page
      return text.split(/\r?\n/);
    };

    const entryArray = await processTextEntries();

    interaction.editReply("Submitting scores...");

    // Declare necessary variables
    const validScores = [];
    const NaNScores = [];

    const notFoundChars = [];

    let successCount = 0;
    let failureCount = 0;

    // Select name and score from each entry and push into a separate array
    for (const entry of entryArray) {
      const entryParts = entry.split(" ");
      const name = entryParts[0];
      const score = Number(entryParts.pop());

      if (name) {
        if (isNaN(score)) {
          // Log character names which have invalid scores
          NaNScores.push(name);
        }
        // Log character names which are valid
        validScores.push({
          name: await checkExceptions(name),
          score,
          sandbag: false,
        });
      }
    }

    for (const validCharacter of validScores) {
      const matchingNames = [];

      // Get the first and last 4 letters of the character name to use for better database matching
      const nameBeginning = validCharacter.name.substring(0, 4);
      const nameEnd = validCharacter.name.substring(
        validCharacter.name.length - 4
      );

      for (const character of characterList) {
        if (!character.name) continue;

        // Find all names which match with the iterated nameBeginning or nameEnd
        const isNameMatching = character.name
          .toLowerCase()
          .match(new RegExp(`^${nameBeginning}|${nameEnd}$`, "gi"));

        // Store matched character names in a separate array
        if (isNameMatching && isNameMatching.length > 0) {
          matchingNames.push(character.name.toLowerCase());
        }
      }

      // Set the character to the the proper character in the scanned entry
      let character;

      // If more than one name was matched, perform a more accurate search
      if (matchingNames.length > 1) {
        for (const duplicateName of matchingNames) {
          if (duplicateName.includes(validCharacter.name.toLowerCase())) {
            // Find the specified duplicate character
            const user = await culvertSchema.findOne(
              {
                "characters.name": {
                  $regex: `^${duplicateName}$`,
                  $options: "i",
                },
              },
              { "characters.$": 1 }
            );
            character = user?.characters[0];
          }
        }
      } else {
        // Find the specified character, when no duplicates found
        const namePattern = `${nameBeginning}|${nameEnd}`;
        const user = await culvertSchema.findOne(
          {
            "characters.name": { $regex: `^${namePattern}$`, $options: "i" },
          },
          { "characters.$": 1 }
        );
        character = user?.characters[0];
      }

      // Perform the logic to set the score for the character
      if (character) {
        successCount++;
        // Check if a score has already been set for the selected week
        const scoreExists = await isScoreSubmitted(
          character.name,
          selectedWeek
        );

        // Update the name of the validCharacter to the one found in the database
        validCharacter.name = character.name;

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
        notFoundChars.push(validCharacter.name);
      }
    }

    // Create the printed list of characters and the scores which were set
    function getSuccessList() {
      let content = "";

      validScores.forEach((character) => {
        // If the character's name could not be read, change their score to 0 (NAN) Otherwise, add to list
        if (!notFoundChars.includes(character.name)) {
          if (NaNScores.includes(character.name)) {
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
        "\n\nThe following characters could not be found:\n- "
      );

      for (const name of notFoundChars) {
        response = response.concat(`**${name}** - `);
      }
      response = response.slice(0, -3); // Remove the unnecessary hyphen at the end
    }

    // Display the error message for characters with unreadable scores
    if (NaNScores.length > 0) {
      response = response.concat(
        "\n\nThe following characters' scores could not be read and have defaulted to 0:\n- "
      );
      for (const name of NaNScores) {
        response = response.concat(`**${name}** - `);
      }
      response = response.slice(0, -3);
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

    const messageChunks = splitMessage(response, 2000);

    for (chunk of messageChunks) {
      await interaction.followUp(chunk);
    }
  },
};
