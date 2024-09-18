const { SlashCommandBuilder, AttachmentBuilder } = require("discord.js");
const fs = require("fs");
const culvertSchema = require("../../culvertSchema.js");
const {
  getResetDates,
  handleResponse,
} = require("../../utility/culvertUtils.js");
const dayjs = require("dayjs");

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

    // Get the current reset and last reset dates
    const { reset, lastReset } = getResetDates();
    weekOption = weekOption === "this_week" ? reset : lastReset;

    // Fetch a list of all characters
    const charactersData = await culvertSchema.find({}, "characters");
    const allCharacters = charactersData.flatMap((list) => list.characters);

    // Extract the names of characters without scores submitted if they joined after the weekly reset
    const missedCharactersArray = allCharacters
      .filter((character) => {
        const hasNoScore = character.scores.every(
          (score) => score.date !== weekOption
        );
        const wasInGuild = !(
          weekOption === lastReset &&
          dayjs(character.memberSince).isAfter(lastReset)
        );

        return hasNoScore && wasInGuild;
      })
      .map((character) => character.name);

    // Convert the character names array into a structured string
    let missedCharacters = missedCharactersArray.join(", ");

    if (missedCharactersArray.length !== 0 && overrideOption === false) {
      return interaction.reply(
        `Error - The following characters have unsubmitted scores for the week of **${weekOption}**: \n\n${missedCharacters}\n\nIf needed, use the optional parameter to override this step.`
      );
    }

    // Extract the collection data and write it to a JSON file
    try {
      const data = await culvertSchema.find({});

      const jsonData = JSON.stringify(data, null, 2);

      fs.writeFile(`culvert-${weekOption}.json`, jsonData, (err) => {
        if (err) {
          console.error("Error - Could not save JSON to file:", err);
          return;
        }
      });
    } catch (error) {
      console.error("Error - Could not export collection to JSON:", error);
    }

    const attachment = new AttachmentBuilder(`./culvert-${weekOption}.json`);

    // Handle responses
    interaction.reply({
      content: `${
        missedCharactersArray.length !== 0
          ? `**${allCharacters.length - missedCharactersArray.length}/${
              allCharacters.length
            }** scores`
          : "All scores"
      } have been submitted for the week of **${weekOption}**\n\nJSON backup data:`,
      files: [attachment],
    });
  },
};
