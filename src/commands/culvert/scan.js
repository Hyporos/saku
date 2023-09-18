const { SlashCommandBuilder } = require("discord.js");
const culvertSchema = require("../../culvertSchema.js");
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
      if (name === "dissatisfiedThunder" || name === "dissatisfiedhunder" || name === "dissatisfiedrhunder")
        return "dìssatisfied";
      if (name === "lgniteChee") return "IgniteCheese";
      if (name === "Idiot") return "ldìot";
      if (name === "Takina") return "Takìna";
      if (name === "YapeOnurG") return "VapeOnurGirl";
      if (name === "WhylCry") return "WhyICry";
      if (name === "miche") return "míche";
      if (name === "Náro" || name === "Naro") return "Nàro";
      if (name === "Migs") return "Mïgs";
      if (name === "Cehba") return "Cebba";
      if (name === "Kyéra") return "Kyêra";
      if (name === "Jdéy") return "Jòéy";
      if (name === "yuhing") return "yubin8";
      if (name === "Méllgw" || name === "Méllaw") return "Mëlløw";
      if (name === "¡AmPunny") return "iAmPunny";
      if (name === "eGirl") return "egirI";
      if (name === "Kürea") return "Kùrea";
      if (name === "Aski") return "Aøki";
      if (name === "Laved") return "Løved";
      if (name === "Aina") return "Ainà";
      if (name === "Hikåri") return "Hikárì";
      if (name === "Cukeu") return "Cukcu";
      if (name === "téee") return "táee";
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

      const dupes = [];

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

        // Find the number of characters that match the query
        const dupes = await culvertSchema.aggregate([
          {
            $unwind: "$characters",
          },
        ]);

        const duplicate = [];

        for (const char of dupes) {
          const name = char.characters.name.toLowerCase(); // Convert name to lowercase for case-insensitive search

          // Use regular expression to find all occurrences of splicedLast in the name
          const matches = name.match(
            new RegExp(`^${splicedFirst}|${splicedLast}$`, "gi")
          );

          if (matches && matches.length > 0) {
            duplicate.push(char.characters.name.toLowerCase());
          }
        }

        console.log(duplicate);
        
        let user;

        if (duplicate.length > 1) {
          for (const dupe of duplicate) {
            if (dupe.includes(character.name.toLowerCase())) {
              user = await culvertSchema.findOne(
                {
                  "characters.name": {
                    $regex: `^${dupe}$`,
                    $options: "i",
                  },
                },
                { "characters.$": 1 }
              );
              console.log(user);
            } else {
              console.log("none found");
            }
          }
        } else {
          user = await culvertSchema.findOne(
            {
              "characters.name": {
                $regex: `^${splicedFirst}|${splicedLast}$`,
                $options: "i",
              },
            }, // ! MAKE NEW CHARS ARRAY
            { "characters.$": 1 }
          );
        }

        // Find the character that contains the spliced strings

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
        } else {
          index = characters.indexOf(character.name);
          characters.splice(index, 1);
          notFound.push(character.name);
        }
      }

      function getSuccessList() {
        let content = "";

        for (const character of characters) {
          content = content.concat(
            `${character.name}: **${
              !isNaN(character.score)
                ? character.score.toLocaleString("en-US")
                : "0 (NaN)"
            }**\n`
          );
        }

        return content;
      }

      console.log(dupes);

      // Display responses
      let response = `Submitted **${successCount - numberNaN.length}/${
        characters.length
      }** scores for ${
        selectedWeek === "this_week"
          ? `this week (${reset})`
          : `last week (${lastReset})`
      }\n\n${getSuccessList()}`;

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
