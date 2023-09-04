const { SlashCommandBuilder } = require("discord.js");
const dayjs = require("dayjs");
const culvertSchema = require("../../culvertSchema.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("gpq")
    .setDescription("Log your culvert score for this week")
    .addIntegerOption((option) =>
      option
        .setName("culvert_score")
        .setDescription("The culvert score to be logged")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("character")
        .setDescription("The character that the score will be logged to")
        .setRequired(true)
        .addChoices(
          { name: "satisfied", value: "satisfied" },
          { name: "dissatisfied", value: "dissatisfied" },
          { name: "Movie", value: "gif_movie" }
        )
    ),
  async execute(client, interaction) {
    const selectedCharacter = interaction.options.getString("character");
    const culvertScore = interaction.options.getInteger("culvert_score");

    const culvertObject = { score: culvertScore, date: dayjs().day(0) }; // Set the date to this sunday (reset)

    await culvertSchema.findOneAndUpdate(
      { "characters.name": selectedCharacter },
      { $set: { "characters.$[index].scores": culvertObject } },
      { arrayFilters: [{ "index.name": selectedCharacter }], new: true }
    );

    interaction.reply({
      content: `${selectedCharacter} has scored **${culvertScore}** for this week! ${dayjs().day(0)}`,
    });
  },
};
