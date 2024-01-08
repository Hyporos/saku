const { SlashCommandBuilder } = require("discord.js");
const culvertSchema = require("../../culvertSchema.js");
const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const updateLocale = require("dayjs/plugin/updateLocale");
dayjs.extend(utc);
dayjs.extend(updateLocale);

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

module.exports = {
  data: new SlashCommandBuilder()
    .setName("checkscores")
    .setDescription("Check for scores that were not successfully submitted")
    .addStringOption((option) =>
      option
        .setName("week")
        .setDescription("The week to check for unsubmitted scores")
        .setRequired(true)
        .addChoices(
          { name: "This week", value: "this_week" },
          { name: "Last week", value: "last_week" }
        )
    ),

  // ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

  async execute(interaction) {
    const selectedWeek = interaction.options.getString("week");

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

    // Find the characters with no score submitted on the provided date
    const charactersWithoutScore = await culvertSchema.aggregate([
      { $unwind: "$characters" },
      {
        $match: {
          "characters.scores.date": {
            $ne: selectedWeek === "this_week" ? reset : lastReset,
          },
        },
      },
    ]);

    if (charactersWithoutScore.length === 0) {
      return interaction.reply(`All scores have been submitted for the week of **${selectedWeek === "this_week" ? reset : lastReset}**`);
    }

    // Push the character names into an array to create a list
    const missedCharactersArray = [];

    for (character of charactersWithoutScore) {
      missedCharactersArray.push(character.characters.name);
    }

    // Convert the character names array into a structured string
    let missedCharacters = "";

    for (name of missedCharactersArray) {
      missedCharacters = missedCharacters.concat(name + ", ");
    }

    missedCharacters = missedCharacters.slice(0, -2); // Remove the unnecessary comma at the end

    // Display responses
    interaction.reply(
      `The following characters have unsubmitted scores for the week of **${
        selectedWeek === "this_week" ? reset : lastReset
      }**: \n\n${missedCharacters}`
    );
  },
};
