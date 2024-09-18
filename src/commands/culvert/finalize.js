const { SlashCommandBuilder, AttachmentBuilder } = require("discord.js");
const fs = require("fs");
const culvertSchema = require("../../culvertSchema.js");
const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const updateLocale = require("dayjs/plugin/updateLocale");
dayjs.extend(utc);
dayjs.extend(updateLocale);

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

module.exports = {
  data: new SlashCommandBuilder()
    .setName("finalize")
    .setDescription("Finalize the scores for the given week")
    .addStringOption((option) =>
      option
        .setName("week")
        .setDescription("The week to be checked")
        .setRequired(true)
        .addChoices(
          { name: "This week", value: "this_week" },
          { name: "Last week", value: "last_week" }
        )
    )
    .addBooleanOption((option) =>
      option
        .setName("override")
        .setDescription(
          "Ignore unsubmittied scores and proceed with finalization"
        )
    ),

  // ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

  async execute(interaction) {
    // Parse the command arguments
    let weekOption = interaction.options.getString("week");
    const overrideOption = interaction.options.getBoolean("override") || false;

    // Set the day of the week that the culvert score gets reset (Wednesday)
    dayjs.updateLocale("en", {
      weekStart: 4,
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

    weekOption = weekOption === "this_week" ? reset : lastReset;

    // Find the total count of characters
    const characterCount = await culvertSchema.aggregate([
      { $unwind: "$characters" },
      { $group: { _id: null, count: { $sum: 1 } } },
    ]);

    // Find the characters with no score submitted on the provided date
    const charactersWithoutScore = await culvertSchema.aggregate([
      { $unwind: "$characters" },
      {
        $match: {
          "characters.scores.date": {
            $ne: weekOption,
          },
        },
      },
    ]);

    // Push the character names into an array to create a list
    const missedCharactersArray = [];

    for (character of charactersWithoutScore) {
      // Check if the character was in the guild at the time of reset
      if (
        weekOption === lastReset &&
        dayjs(character.characters.memberSince).isAfter(lastReset)
      )
        continue;
      missedCharactersArray.push(character.characters.name);
    }

    // Convert the character names array into a structured string
    let missedCharacters = "";

    for (name of missedCharactersArray) {
      missedCharacters = missedCharacters.concat(name + ", ");
    }

    missedCharacters = missedCharacters.slice(0, -2); // Remove the unnecessary comma at the end

    if (missedCharactersArray.length !== 0 && overrideOption === false) {
      return interaction.reply(
        `Error - The following characters have unsubmitted scores for the week of **${weekOption}**: \n\n${missedCharacters}\n\nIf needed, use the optional parameter to override this step.`
      );
    }

    try {
      // Extract entire collection data
      const data = await culvertSchema.find({});

      // Convert data to JSON
      const jsonData = JSON.stringify(data, null, 2); // Add indentation for readability

      // Write the data to JSON file
      fs.writeFile(`culvert-${weekOption}.json`, jsonData, (err) => {
        if (err) {
          console.error("Error - Could not save JSON to file:", err);
          return;
        }
      });
    } catch (error) {
      console.error("Error - Could not export collection to JSON:", error);
    }

    // Create attachment builder with file path
    const attachment = new AttachmentBuilder(`./culvert-${weekOption}.json`);

    // Display response
    interaction.reply({
      content: `${
        missedCharactersArray.length !== 0
          ? `**${characterCount[0].count - missedCharactersArray.length}/${
              characterCount[0].count
            }** scores`
          : "All scores"
      } have been submitted for the week of **${weekOption}**\n\nJSON backup data:`,
      files: [attachment],
    });
  },
};
