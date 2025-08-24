const { SlashCommandBuilder, AttachmentBuilder } = require("discord.js");
const culvertSchema = require("../../schemas/culvertSchema.js");
const { getResetDates } = require("../../utility/culvertUtils.js");
const dayjs = require("dayjs");

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

  async execute(interaction) {
    // Command may take longer to execute. Defer the initial reply.
    await interaction.deferReply();

    // Parse the command arguments
    let weekOption = interaction.options.getString("week");
    const overrideOption = interaction.options.getBoolean("override") || false;

    // Get the current reset and last reset dates (Thursday 12:00 AM UTC)
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
      .map((character) => character.name)
      .filter((name) => name && typeof name === "string" && name.trim()); // Filter out invalid names

    // Convert the character names array into a structured string
    let missedCharacters = missedCharactersArray.join(", ");

    if (missedCharactersArray.length !== 0 && !overrideOption) {
      return interaction.followUp(
        `Error - The following characters have unsubmitted scores for the week of **${weekOption}**: \n\n${missedCharacters}\n\nIf needed, use the optional parameter to override this step.`
      );
    }

    // Extract the collection data
    try {
      const data = await culvertSchema.find({});
      const jsonData = JSON.stringify(data, null, 2);

      // Create a buffer from the JSON data
      const buffer = Buffer.from(jsonData, "utf-8");
      const attachment = new AttachmentBuilder(buffer, { name: `culvert-${weekOption}.json` });

      // Handle responses
      await interaction.followUp({
        content: `${
          missedCharactersArray.length !== 0
            ? `**${allCharacters.length - missedCharactersArray.length}/${
                allCharacters.length
              }** scores`
            : "All scores"
        } have been submitted for the week of **${weekOption}**\n\nJSON backup data:`,
        files: [attachment],
      });
    } catch (error) {
      console.error("Error - Could not export collection to JSON:", error);
      interaction.followUp("Error - Could not export collection to JSON.");
    }
  },
};
