const { SlashCommandBuilder } = require("discord.js");
const culvertSchema = require("../../culvertSchema.js");
const { createWorker } = require("tesseract.js");
const dayjs = require("dayjs");
const Jimp = require("jimp");

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

module.exports = {
  data: new SlashCommandBuilder()
    .setName("scan")
    .setDescription("Store user culvert data by image")
    .addAttachmentOption((option) =>
      option.setName("attach").setDescription("Image").setRequired(true)
    ),

  // ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

  async execute(client, interaction) {
    const image = interaction.options.getAttachment("attach");

    await interaction.deferReply();

    // Day of the week the culvert score gets reset (sunday)
    const reset = String(dayjs().day(0).format("YYYY-MM-DD")); // ? Is this String() needed?

    // Process the image
    Jimp.read(image.proxyURL).then(function (image) {
      image
        .contrast(1)
        .grayscale()
        .invert()
        .scale(4)
        .write("processedImage.jpg");
    });

    const worker = await createWorker({
      logger: (m) => console.log(m),
    });

    (async () => {
      await worker.loadLanguage("eng+fra+spa+dan+swe+ita");
      await worker.initialize("eng+fra+spa+dan+swe+ita");
      await worker.setParameters({
        tessedit_char_blacklist: ",.",
      });

      const {
        data: { text },
      } = await worker.recognize("./processedImage.jpg");

      await worker.terminate();

      const entryArray = text.split(/\r?\n/);
      const characters = [];

      const notFound = [];
      let successCount = 0;

      // Split each entry into its own array
      entryArray.forEach((entry) => {
        if (entry.split(" ")[0] != "") {
          // Ignore empty entries
          characters.push({
            name: entry.split(" ")[0],
            score: Number(entry.split(" ").pop()),
          });
        }
      });

      for (const character of characters) {
        // Find the character with the given name
        const splicedFirst = character.name.substring(0,4);
        const splicedLast = character.name.substring(character.name.length -4)
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
          // Check if a score has already been set for this week
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
                "characters.scores.date": reset,
              },
            },
          ]);

          // Create or update an existing score on the selected character
          if (weekLogged.length < 1) {
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
                    score: character.score,
                    date: reset,
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
            await culvertSchema.findOneAndUpdate(
              {
                "characters.name": {
                  $regex: `^${splicedFirst}|${splicedLast}$`,
                  $options: "i",
                },
                "characters.scores.date": reset,
              },
              {
                $set: {
                  "characters.$[nameElem].scores.$[dateElem].score":
                    character.score,
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
                  { "dateElem.date": reset },
                ],
                new: true,
              }
            );
          }
        } else {
          notFound.push(character.name);
        }
      }

      // Display responses
      let response = `Successfully synced data for **${successCount}/${characters.length}** characters\n\n`;

      if (notFound.length > 0) {
        response = response.concat(
          "The following characters could not be found:\n- "
        );
        for (const name of notFound) {
          response = response.concat(`**${name}** ⎯ `);
        };
        response = response.slice(0, -3); // Remove the unnecessary hyphen at the end
      }

      interaction.editReply(response);
    })();
  },
};
