const { SlashCommandBuilder } = require("discord.js");
const culvertSchema = require("../../culvertSchema.js");
const botSchema = require("../../exceptionSchema.js");
const { createWorker } = require("tesseract.js");
const Jimp = require("jimp");
const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const updateLocale = require("dayjs/plugin/updateLocale");
dayjs.extend(utc);
dayjs.extend(updateLocale);

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
    const image = interaction.options.getAttachment("attach");
    const selectedWeek = interaction.options.getString("week");

    await interaction.deferReply();

    // Set the day of the week that the culvert score gets reset (Sunday)
    dayjs.updateLocale("en", {
      weekStart: 1,
    });

    const reset = dayjs()
      .utc()
      .startOf("week")
      .subtract(1, "day")
      .format("YYYY-MM-DD");

    const lastReset = dayjs()
      .utc()
      .startOf("week")
      .subtract(8, "day")
      .format("YYYY-MM-DD");

    // Get the list of character name exceptions
    const checkExceptions = async (entryName) => {
      const exceptions = await botSchema.find({});
      // Find the exception. if no exception exists, keep the entry name

      const returnedName = await exceptions.find((name) => entryName === name.exception).name || entryName

      console.log(`Exception found for ${returnedName}`)

      return returnedName;
    }

    // Create individual exceptions for recurring un-scannable names
    // function exceptions(name) {
    //   if (
    //     name === "dissatisfiedThunder" ||
    //     name === "dissatisfiedhunder" ||
    //     name === "dissatisfiedrhunder"
    //   )
    //     return "dìssatisfied";
    //   if (name === "lgniteChee") return "IgniteCheese";
    //   if (name === "Idiot") return "ldìot";
    //   if (name === "Takina") return "Takìna";
    //   if (name === "YapeOnurG") return "VapeOnurGirl";
    //   if (name === "WhylCry") return "WhyICry";
    //   if (name === "miche") return "míche";
    //   if (name === "Náro" || name === "Naro") return "Nàro";
    //   if (name === "Migs") return "Mïgs";
    //   if (name === "Cehba") return "Cebba";
    //   if (name === "Kyéra") return "Kyêra";
    //   if (name === "Jdéy" || name === "Jèéy") return "Jòéy";
    //   if (name === "yuhing") return "yubin8";
    //   if (name === "Méllgw" || name === "Méllaw") return "Mëlløw";
    //   if (name === "¡AmPunny") return "iAmPunny";
    //   if (name === "eGirl") return "egirI";
    //   if (name === "Kürea") return "Kùrea";
    //   if (name === "Aski") return "Aøki";
    //   if (name === "Laved") return "Løved";
    //   if (name === "Aina" || name === "Ainå") return "Ainà";
    //   if (name === "Hikåri" || name === "Hikéri" || name === "Hikari")
    //     return "Hikárì";
    //   if (name === "Cukeu") return "Cukcu";
    //   if (name === "téee" || name === "tåee") return "táee";
    //   if (name === "Kaküja" || name === "Kakdja") return "kakúja";
    //   if (name === "Kogå") return "Kogâ";
    //   if (name === "ponzi" || name === "pånzi" || name === "pènzi")
    //     return "pònzi";
    //   if (name === "CaptainWaThunder" || name === "CaptainvaThunder")
    //     return "CaptainWater";
    //   if (name === "Hakgs") return "Hakøs";
    //   if (name === "JaylTB") return "JayITB";
    //   if (name === "Mipd" || name === "Mipû") return "Mipú";
    //   if (name === "Nåro") return "Nàro";
    //   if (name === "Sasåri" || name === "Sasóri") return "Sasôri";
    //   if (name === "Druú") return "Drùú";
    //   if (name === "Minári" || name === "minári") return "Minãri";
    //   return name;
    // }

    // Process the image
    Jimp.read(image.proxyURL).then(function (image) {
      image
        .contrast(1)
        .grayscale()
        .invert()
        .scale(1.4)
        .write("./processedImage.jpg");
    });

    // Use OCR to read all text in the image
    const worker = await createWorker({
      logger: (m) => console.log(m),
    });

    const processTextEntries = async () => {
      interaction.editReply("Processing image...");

      await worker.loadLanguage("eng+fra+spa+dan+swe+ita");
      await worker.initialize("eng+fra+spa+dan+swe+ita");
      await worker.setParameters({
        tessedit_char_blacklist: ",.…",
      });

      const {
        data: { text },
      } = await worker.recognize("./processedImage.jpg");

      await worker.terminate();

      // Return an array of each entry/line in the culvert score page
      return text.split(/\r?\n/);
    };

    const entryArray = await processTextEntries();

    interaction.editReply("Submitting scores...");

    const validScores = [];
    const NaNScores = [];
    let bestScore = 0;

    let successCount = 0;
    let failureCount = 0;
    const notFoundChars = [];

    // Select name and score from each entry and push into a separate array
    entryArray.forEach((entry) => {
      // Log character names which have invalid scores
      if (isNaN(Number(entry.split(" ").pop()))) {
        NaNScores.push(entry.split(" ")[0]);
      }
      // Log character names which are valid
      if (entry.split(" ")[0] !== "") {
        validScores.push({
          name: checkExceptions(entry.split(" ")[0]),
          score: Number(entry.split(" ").pop()),
          sandbag: false,
        });
      }
    });

    for (const character of validScores) {
      // Get the first and last 4 letters of the character name to use for better database matching
      console.log(character);
      const nameBeginning = character.name.substring(0, 4);
      const nameEnd = character.name.substring(character.name.length - 4);

      // Get and unwind the list of character names
      const characterList = await culvertSchema.aggregate([
        {
          $unwind: "$characters",
        },
      ]);

      // Store "half matched" character names in a separate array
      const halfMatched = [];

      for (const character of characterList) {
        if (!character.characters.name) continue;
        const name = character.characters.name.toLowerCase(); // Convert name to lowercase for case-insensitive search

        // Find all names which match with the iterated nameBeginning or nameEnd
        const matches = name.match(
          new RegExp(`^${nameBeginning}|${nameEnd}$`, "gi")
        );

        if (matches && matches.length > 0) {
          halfMatched.push(character.characters.name.toLowerCase());
        }
      }

      // Set the user object to the user in the entry
      let user;

      // If more than one name was matched, perform a more accurate search
      if (halfMatched.length > 1) {
        for (const duplicateName of halfMatched) {
          if (duplicateName.includes(character.name.toLowerCase())) {
            user = await culvertSchema.findOne(
              {
                "characters.name": {
                  $regex: `^${duplicateName}$`,
                  $options: "i",
                },
              },
              { "characters.$": 1 }
            );
          }
        }
      } else {
        user = await culvertSchema.findOne(
          {
            "characters.name": {
              $regex: `^${nameBeginning}|${nameEnd}$`,
              $options: "i",
            },
          },
          { "characters.$": 1 }
        );
      }

      // Perform the logic to set the score for the character
      if (user) {
        successCount++;
        // Check if a score has already been set for the week
        const weekLogged = await culvertSchema.aggregate([
          {
            $unwind: "$characters",
          },
          {
            $unwind: "$characters.scores",
          },
          {
            $match: {
              "characters.name": user?.characters[0]?.name,
              "characters.scores.date":
                selectedWeek === "this_week" ? reset : lastReset,
            },
          },
        ]);

        if (weekLogged.length < 1) {
          // Create a new score on the selected character
          await culvertSchema.findOneAndUpdate(
            {
              "characters.name": user?.characters[0]?.name || "",
            },
            {
              $addToSet: {
                "characters.$[nameElem].scores": {
                  score: !isNaN(character.score) ? character.score : 0,
                  date: selectedWeek === "this_week" ? reset : lastReset,
                },
              },
            },
            {
              arrayFilters: [
                {
                  "nameElem.name": user?.characters[0]?.name || "",
                },
              ],
              new: true,
            }
          );
        } else {
          // Update an existing score on the selected character
          await culvertSchema.findOneAndUpdate(
            {
              "characters.name": user?.characters[0]?.name || "",
              "characters.scores.date":
                selectedWeek === "this_week" ? reset : lastReset,
            },
            {
              $set: {
                "characters.$[nameElem].scores.$[dateElem].score": !isNaN(
                  character.score
                )
                  ? character.score
                  : 0,
              },
            },
            {
              arrayFilters: [
                {
                  "nameElem.name": user?.characters[0]?.name || "",
                },
                {
                  "dateElem.date":
                    selectedWeek === "this_week" ? reset : lastReset,
                },
              ],
              new: true,
            }
          );
        }

        // Find the biggest (best) score of the character
        bestScore = await culvertSchema.aggregate([
          {
            $unwind: "$characters",
          },
          {
            $match: {
              "characters.name": {
                $regex: `^${user?.characters[0]?.name}$`,
                $options: "i",
              },
            },
          },
          {
            $set: {
              "characters.scores": {
                $sortArray: {
                  input: "$characters.scores",
                  sortBy: {
                    score: -1,
                  },
                },
              },
            },
          },
        ]);

        // If the character scores less than 60% of their best, set a sandbag flag
        if (
          character.score !== 0 &&
          !isNaN(character.score) &&
          character.score < bestScore[0].characters.scores[0]?.score * 0.85
        ) {
          character.sandbag = true;
        }
      } else {
        failureCount++;
        notFoundChars.push(character.name);
      }
    }

    // Create the printed list of characters and the scores which were set
    function getSuccessList() {
      let content = "";

      validScores.forEach((character) => {
        // If the character name is valid, include it in the list
        if (!notFoundChars.includes(character.name)) {
          content = content.concat(
            `${character.name}: **${
              !isNaN(character.score)
                ? character.score.toLocaleString("en-US")
                : "0 (NaN)"
            }**`
          );

          if (character.sandbag) {
            content = content.concat(` <:sakuPeek:1134862404900106381>\n`);
          } else {
            content = content.concat("\n");
          }
        }
      });

      return content;
    }

    // Display responses
    let response = `Submitted **${successCount - NaNScores.length}/${
      validScores.length
    }** scores for ${
      selectedWeek === "this_week"
        ? `this week (${reset})`
        : `last week (${lastReset})`
    }\n\n${getSuccessList()}`;

    if (notFoundChars.length > 0) {
      response = response.concat(
        "\n\nThe following characters could not be found:\n- "
      );
      for (const name of notFoundChars) {
        response = response.concat(`**${name}** ⎯ `);
      }
      response = response.slice(0, -3); // Remove the unnecessary hyphen at the end
    }

    if (NaNScores.length > 0) {
      response = response.concat(
        "\n\nThe following characters' scores could not be read and have defaulted to 0:\n- "
      );
      for (const name of NaNScores) {
        response = response.concat(`**${name}** ⎯ `);
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

    ////console.log("Scan complete");
  },
};
