const { SlashCommandBuilder } = require("discord.js");
const culvertSchema = require("../../culvertSchema.js");
const fs = require("fs");
const { parse } = require("csv");

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

module.exports = {
  data: new SlashCommandBuilder()
    .setName("import")
    .setDescription("Import character data from a .csv"),

  // ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

  // ! WELCOME TO MY TWO TIME USE SPAGHETTI CODE ! NO POINT IN OPTIMIZING THIS !

  async execute(interaction) {
    await interaction.deferReply();

    fs.createReadStream("./culv.csv")
      .pipe(parse({ delimiter: ",", from_line: 2 }))
      .on("data", async function (row) {
        for (let j = 4; j <= 28; j++) {
          const memberSince = row[0].split(/\r?\n/);
          const charNames = row[1].split(/\r?\n/);
          const charScore = row[j].split(/\r?\n/);

          const dates = [
            "Member-Since",
            "GuildMember",
            "Discord",
            "DiscordId",
            "2023-03-19",
            "2023-03-26",
            "2023-04-02",
            "2023-04-09",
            "2023-04-16",
            "2023-04-23",
            "2023-04-30",
            "2023-05-07",
            "2023-05-14",
            "2023-05-21",
            "2023-05-28",
            "2023-06-04",
            "2023-06-11",
            "2023-06-18",
            "2023-06-25",
            "2023-07-02",
            "2023-07-09",
            "2023-07-16",
            "2023-07-23",
            "2023-07-30",
            "2023-08-06",
            "2023-08-13",
            "2023-08-20",
            "2023-08-27",
            "2023-09-03",
          ];

          console.log(dates[j]);

          // AOKI, JIEYAH, DWAEKKI HAVE WRONG PICS
          // EGGSITE, ALACARTE, ULTRAZIRALL, RINKAWA, THANHY HAVE WRONG DISCORD
          for (let i = 0; i < charNames.length; i++) {
            if (charScore[i] !== "" && !isNaN(Number(charScore[i]))) {
              const updated = charScore[i].replaceAll(",", "");
              await culvertSchema.findOneAndUpdate(
                {
                  "characters.name": {
                    $regex: `^${charNames[i]}$`,
                    $options: "i",
                  },
                },
                {
                  $addToSet: {
                    "characters.$[nameElem].scores": {
                      score: updated,
                      date: dates[j],
                    },
                  },
                },
                {
                  arrayFilters: [
                    {
                      "nameElem.name": {
                        $regex: `^${charNames[i]}$`,
                        $options: "i",
                      },
                    },
                  ],
                  new: true,
                }
              );
              // member since
              await culvertSchema.findOneAndUpdate(
                {
                  "characters.name": {
                    $regex: `^${charNames[i]}$`,
                    $options: "i",
                  },
                },
                {
                  $set: {
                    "characters.$[nameElem].memberSince": memberSince[i],
                    graphColor: "255,189,213",
                  },
                },
                {
                  arrayFilters: [
                    {
                      "nameElem.name": {
                        $regex: `^${charNames[i]}$`,
                        $options: "i",
                      },
                    },
                  ],
                  new: true,
                }
              );
            }
          }
        }
      })
      .on("end", async function () {
        await interaction.editReply("Finished");
      })
      .on("error", async function (error) {
        console.error(error.message);
        await interaction.editReply("Error");
      });
  },
};
