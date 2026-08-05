const { SlashCommandBuilder } = require("discord.js");
const culvertSchema = require("../../schemas/culvertSchema.js");
const { EMOJI_IDS } = require("../../config/ids.js");
const { nameMatch, getResetDates } = require("../../utility/culvertUtils.js");

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

// The highest score ever recorded in this database is a little over 1.1 million, so this is roughly
// double the real ceiling: high enough never to reject a genuine score, low enough that a
// fat-fingered extra digit is caught before it skews the guild median and every graph reading it.
const MAX_SCORE = 2000000;

module.exports = {
  data: new SlashCommandBuilder()
    .setName("gpq")
    .setDescription("Log your culvert score for this week")
    .addIntegerOption((option) =>
      option
        .setName("score")
        .setDescription("The score to be logged")
        .setRequired(true)
        .setMinValue(0)
        .setMaxValue(MAX_SCORE)
    )
    .addStringOption((option) =>
      option
        .setName("character")
        .setDescription("The character that the score will be logged to")
        .setRequired(false)
        .setAutocomplete(true)
    ),

  // ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

  // Only your own characters: you can only log a score to one of them.
  async autocomplete(interaction) {
    // A member with nothing linked has no document at all, and reading `.characters` off null threw
    // every time one of them started typing this command.
    const user = await culvertSchema.findById(interaction.user.id, "characters").lean();
    const value = interaction.options.getFocused().toLowerCase();

    const filtered = (user?.characters ?? [])
      .map((character) => character.name)
      .filter((name) => name?.toLowerCase().includes(value))
      .sort((a, b) => a.localeCompare(b))
      .slice(0, 25);

    await interaction.respond(filtered.map((name) => ({ name, value: name }))).catch(() => {});
  },

  // ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

  async execute(interaction) {
    // Parse the command arguments
    const characterOption = interaction.options.getString("character");
    const scoreOption = interaction.options.getInteger("score");

    // Get the current reset date (Thursday 12:00 AM UTC)
    const { reset } = getResetDates();

    // One lookup covers all of it. This used to be four separate queries against the same document:
    // is the character linked, does it belong to you, fetch it, and does it already have a score.
    const user = await culvertSchema.findById(interaction.user.id, "characters").lean();
    if (!user?.characters?.length) {
      return interaction.reply("Error - You have no characters linked yet.");
    }

    let character;
    if (characterOption) {
      character = user.characters.find((entry) => entry.name.toLowerCase() === characterOption.toLowerCase());
      if (!character) {
        return interaction.reply(`Error - The character **${characterOption}** is not linked to you`);
      }
    } else {
      // If no character was specified, auto-select if the user only has one linked
      if (user.characters.length > 1) {
        return interaction.reply(
          "Error - You have multiple characters linked. Please specify which character to log the score for"
        );
      }
      character = user.characters[0];
    }

    const scores = character.scores ?? [];
    const existing = scores.find((score) => score.date === reset);

    // Find the character's best (highest) score, ignoring the week being written so that correcting
    // this week's own entry upward still reads as a personal best.
    const bestScore = scores
      .filter((score) => score.date !== reset)
      .reduce((best, score) => Math.max(best, score.score), 0);

    if (existing) {
      await culvertSchema.updateOne(
        { _id: interaction.user.id, "characters.name": nameMatch(character.name) },
        { $set: { "characters.$[nameElem].scores.$[dateElem].score": scoreOption } },
        { arrayFilters: [{ "nameElem.name": nameMatch(character.name) }, { "dateElem.date": reset }] }
      );
    } else {
      // $addToSet compared whole objects, so the same week could be inserted twice with two different
      // scores. There is only ever one score per week, so it is pushed once and set thereafter.
      await culvertSchema.updateOne(
        { _id: interaction.user.id, "characters.name": nameMatch(character.name) },
        { $push: { "characters.$[nameElem].scores": { score: scoreOption, date: reset } } },
        { arrayFilters: [{ "nameElem.name": nameMatch(character.name) }] }
      );
    }

    // Handle Responses
    const isNewPB = scoreOption > bestScore;

    await interaction.reply(
      existing
        ? `${character.name}'s score has been updated to **${scoreOption}**${isNewPB ? " :trophy:" : ""} for this week! (${reset})`
        : `${character.name} has scored **${scoreOption}**${isNewPB ? " :trophy:" : ""} for this week! (${reset})`
    );

    // React to the message. A missing or renamed emote must not fail the command after the score has
    // already been saved and reported.
    const reply = await interaction.fetchReply().catch(() => null);
    if (!reply) return;

    await reply.react(EMOJI_IDS.THUMB_SHADOW).catch(() => {}); // sakuThumbShadow for all scores
    if (isNewPB) await reply.react(EMOJI_IDS.STONKS).catch(() => {}); // sakuStonks for PBs
  },
};
