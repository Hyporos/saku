const { SlashCommandBuilder } = require("discord.js");
const culvertSchema = require("../../culvertSchema.js");
const { createWorker } = require("tesseract.js");
const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const updateLocale = require("dayjs/plugin/updateLocale");
dayjs.extend(utc);
dayjs.extend(updateLocale);
const Jimp = require("jimp");

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

module.exports = {
  data: new SlashCommandBuilder()
    .setName("scan")
    .setDescription("Submit bulk culvert data from a screenshot")
    .addAttachmentOption((option) =>
      option.setName("attach").setDescription("Image").setRequired(true)
    )
    .addBooleanOption((option) =>
      option
        .setName("last_week")
        .setDescription(
          "Submit the scores for last week instead (default: false)"
        )
    ),

  // ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

  async execute(interaction) {
    const image = interaction.options.getAttachment("attach");
    const lastWeek = interaction.options.getBoolean("last_week");

    await interaction.deferReply();

    // Day of the week the culvert score gets reset (sunday)
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

    // Create individual exceptions for recurring un-scannable names
    function exceptions(name) {
      if (name === "dissatisfiedrhunder" || name === "dissatisfiedhunder")
        return "dìssatisfied";
      if (name === "lgniteChee") return "IgniteCheese";
      if (name === "Idiot") return "ldìot";
      if (name === "Takina") return "Takìna";
      if (name === "YapeOnurG") return "VapeOnurGirl";
      if (name === "WhylCry") return "WhyICry";
      if (name === "miche") return "míche";
      if (name === "Náro") return "Nàro";
      if (name === "Migs") return "Mïgs";
      if (name === "Cehba") return "Cebba";
      if (name === "Kyéra") return "Kyêra";
      if (name === "Jdéy") return "Jòéy";
      if (name === "yuhing") return "yubin8";
      if (name === "Méllgw") return "Mëlløw";
      return name;
    }

    // Process the image
    Jimp.read(image.proxyURL).then(function (image) {
      image
        .contrast(1)
        .grayscale()
        .invert()
        .scale(1.4)
        .write("./processedImage.jpg");
    });

    const worker = await createWorker({
      logger: (m) => console.log(m),
    });

    (async () => {
      await worker.loadLanguage("eng+fra+spa+dan+swe+ita");
      await worker.initialize("eng+fra+spa+dan+swe+ita");
      await worker.setParameters({
        tessedit_char_blacklist: ",.…",
      });

      const {
        data: { text },
      } = await worker.recognize("./processedImage.jpg");

      await worker.terminate();

      const entryArray = text.split(/\r?\n/); // make this return text then work on it

      const characters = [];
      const notFound = [];
      const numberNaN = [];

      let successCount = 0;

      // Split each entry into its own array
      entryArray.forEach((entry) => {
        // Log characters which have invalid scores
        if (isNaN(Number(entry.split(" ").pop()))) {
          numberNaN.push(entry.split(" ")[0]);
        }
        if (entry.split(" ")[0] != "") {
          // Ignore empty entries
          characters.push({
            name: exceptions(entry.split(" ")[0]),
            score: Number(entry.split(" ").pop()),
          });
        }
      });

      for (const character of characters) {
        const splicedFirst = character.name.substring(0, 4);
        const splicedLast = character.name.substring(character.name.length - 4);

        // Find the character that contains the spliced strings
        const user = await culvertSchema.findOne(
          {
            "characters.name": {
              $regex: `^${splicedFirst}|${splicedLast}$`,
              $options: "i",
            },
          },
          { "characters.$": 1 }
        );

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
                "characters.name": {
                  $regex: `^${splicedFirst}|${splicedLast}$`,
                  $options: "i",
                },
                "characters.scores.date": lastWeek ? lastReset : reset,
              },
            },
          ]);

          if (weekLogged.length < 1) {
            // Create a new score on the selected character
            await culvertSchema.findOneAndUpdate(
              {
                "characters.name": {
                  $regex: `^${splicedFirst}|${splicedLast}$`,
                  $options: "i",
                },
              },
              {
                $addToSet: {
                  "characters.$[nameElem].scores": {
                    score: !isNaN(character.score) ? character.score : 0,
                    date: lastWeek ? lastReset : reset,
                  },
                },
              },
              {
                arrayFilters: [
                  {
                    "nameElem.name": {
                      $regex: `^${splicedFirst}|${splicedLast}$`,
                      $options: "i",
                    },
                  },
                ],
                new: true,
              }
            );
          } else {
            // Update an existing score on the selected character
            await culvertSchema.findOneAndUpdate(
              {
                "characters.name": {
                  $regex: `^${splicedFirst}|${splicedLast}$`,
                  $options: "i",
                },
                "characters.scores.date": lastWeek ? lastReset : reset,
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
                    "nameElem.name": {
                      $regex: `^${splicedFirst}|${splicedLast}$`,
                      $options: "i",
                    },
                  },
                  { "dateElem.date": lastWeek ? lastReset : reset },
                ],
                new: true,
              }
            );
          }
        } else {
          notFound.push(character.name);
        }
      }

      function getSuccessList() {
        let content = "";

        for (const character of characters) {
          content = content.concat(
            `${character.name}: **${
              !isNaN(character.score) ? character.score.toLocaleString("en-US") : "0 (NaN)"
            }**\n`
          );
        }

        return content;
      }

      // Display responses
      let response = `Submitted scores for **${
        successCount - numberNaN.length
      }/${characters.length}** characters\n\n${getSuccessList()}`;

      if (notFound.length > 0) {
        response = response.concat(
          "\n\nThe following characters could not be found:\n- "
        );
        for (const name of notFound) {
          response = response.concat(`**${name}** ⎯ `);
        }
        response = response.slice(0, -3); // Remove the unnecessary hyphen at the end
      }

      if (numberNaN.length > 0) {
        response = response.concat(
          "\n\nThe following characters' scores could not be read:\n- "
        );
        for (const name of numberNaN) {
          response = response.concat(`**${name}** ⎯ `);
        }
        response = response.slice(0, -3);
      }

      interaction.editReply(response);
    })();
  },
};
