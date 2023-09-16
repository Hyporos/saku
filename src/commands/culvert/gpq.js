//TODO - Add a streak system
//TODO - Validate for negative and massive numbers

const { SlashCommandBuilder } = require("discord.js");
const culvertSchema = require("../../culvertSchema.js");
const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
dayjs.extend(utc);

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

module.exports = {
  data: new SlashCommandBuilder()
    .setName("gpq")
    .setDescription("Log your culvert score for this week")
    .addStringOption((option) =>
      option
        .setName("character")
        .setDescription("The character that the score will be logged to")
        .setRequired(true)
        .setAutocomplete(true)
    )
    .addIntegerOption((option) =>
      option
        .setName("score")
        .setDescription("The score to be logged")
        .setRequired(true)
    ),

  // ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

  async autocomplete(interaction) {
    const user = await culvertSchema.findById(
      interaction.user.id,
      "characters"
    );

    const value = interaction.options.getFocused().toLowerCase();

    let choices = [];

    user.characters.forEach((character) => {
      choices.push(character.name);
    });

    const filtered = choices
      .filter((choice) => choice.toLowerCase().includes(value))
      .slice(0, 25);

    await interaction.respond(
      filtered.map((choice) => ({ name: choice, value: choice }))
    );
  },

  // ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

  async execute(client, interaction) {
    const selectedCharacter = interaction.options.getString("character");
    const culvertScore = interaction.options.getInteger("culvert_score");

    // Check if the sender is a Bee
    const isBee = interaction.member.roles.cache.has("720001044746076181");

    // Day of the week the culvert score gets reset (sunday)
    const reset = dayjs().day(0).format("YYYY-MM-DD");
    const newReset = dayjs().utc().day(1).format("YYYY-MM-DD");

    console.log("Now: " + dayjs().format("YYYY-MM-DD HH:mm:ss"));
    console.log("Now UTC: " + dayjs().utc().format("YYYY-MM-DD HH:mm:ss"));
    console.log("Next Sunday: " + dayjs().day(0).format("YYYY-MM-DD HH:mm:ss"));
    console.log("Next Monday UTC: " + dayjs().utc().day(1).format("YYYY-MM-DD HH:mm:ss"));

    // Check if character exists
    const characterExists = await culvertSchema.exists({
      "characters.name": { $regex: `^${selectedCharacter}$`, $options: "i" },
    });

    // Check if character is linked to user // ! MAKE THIS NORMAL JS BRO
    const characterLinked = await culvertSchema.exists({
      _id: interaction.user.id,
      "characters.name": { $regex: `^${selectedCharacter}$`, $options: "i" },
    });

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
            $regex: `^${selectedCharacter}$`,
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
          _id: !isBee ? interaction.user.id : { $regex: /.*/ },
          "characters.name": {
            $regex: `^${selectedCharacter}$`,
            $options: "i",
          },
        },
        {
          $addToSet: {
            "characters.$[nameElem].scores": {
              score: culvertScore,
              date: reset,
            },
          },
        },
        {
          arrayFilters: [
            {
              "nameElem.name": {
                $regex: `^${selectedCharacter}$`,
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
          _id: !isBee ? interaction.user.id : { $regex: /.*/ },
          "characters.name": {
            $regex: `^${selectedCharacter}$`,
            $options: "i",
          },
          "characters.scores.date": reset,
        },
        {
          $set: {
            "characters.$[nameElem].scores.$[dateElem].score": culvertScore,
          },
        },
        {
          arrayFilters: [
            {
              "nameElem.name": {
                $regex: `^${selectedCharacter}$`,
                $options: "i",
              },
            },
            { "dateElem.date": reset },
          ],
          new: true,
        }
      );
    }

    // Display responses
    let response = "";

    if (!characterLinked && characterExists && !isBee) {
      response = `Error ⎯ The character **${selectedCharacter}** is not linked to you`;
    } else if (!characterExists) {
      response = `Error ⎯ The character **${selectedCharacter}** has not yet been linked`;
    } else if (weekLogged.length > 0) {
      response = `${selectedCharacter}'s score has been updated to **${culvertScore}** for this week! (${reset})`;
    } else {
      response = `${selectedCharacter} has scored **${culvertScore}** for this week! (${reset})`;
    }

    interaction.reply(response);
  },
};
