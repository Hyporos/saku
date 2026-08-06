const { SlashCommandBuilder, AttachmentBuilder } = require("discord.js");
const dayjs = require("dayjs");
const culvertSchema = require("../../schemas/culvertSchema.js");

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

// One column per week, and the roster has scores going back years. Leaving `weeks` off exports the
// lot; giving a number trims it to that many of the most recent weeks. Ten years is far past anything
// real and only exists so the field has an upper bound.
const MAX_WEEKS = 520;

/**
 * Escape one value for a CSV cell.
 *
 * Only `memberSince` used to be quoted, so anything else containing a comma or a quote would have
 * shifted every column after it. The leading-symbol guard is separate: Excel and Sheets execute a cell
 * starting with = + - or @ as a formula, so a character named `=cmd` would run on open.
 *
 * @param {*} value - The value to write.
 * @returns {string} - A safely quoted cell.
 */
const csvCell = (value) => {
  const text = String(value ?? "");
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

module.exports = {
  tier: "bee",
  culvert: true,
  data: new SlashCommandBuilder()
    .setName("export")
    .setDescription("[BEE] Export a .csv of characters' scores for their respective dates")
    .addIntegerOption((option) =>
      option
        .setName("weeks")
        .setDescription("How many recent weeks to include (leave empty for all time)")
        .setMinValue(1)
        .setMaxValue(MAX_WEEKS)
    ),

  // ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

  async execute(interaction) {
    // Reads the whole roster and builds a file out of it, which is well past what an unacknowledged
    // interaction is allowed to take.
    await interaction.deferReply();

    try {
      // Omitted means everything, which is the useful default for an archive.
      const limit = interaction.options.getInteger("weeks");

      // Only the three fields the sheet is made of, rather than whole documents.
      const docs = await culvertSchema.find({}, { "characters.name": 1, "characters.memberSince": 1, "characters.scores": 1 }).lean();

      const characters = docs
        .flatMap((doc) => doc.characters ?? [])
        .filter((character) => character.name)
        .sort((a, b) => new Date(a.memberSince) - new Date(b.memberSince));

      if (!characters.length) {
        return interaction.editReply("Error - There are no characters to export");
      }

      // Every week anyone scored in, newest last. The window is taken off the end so "last 12" means
      // the twelve most recent weeks that actually exist, not twelve calendar weeks of mostly blanks.
      const allDates = [...new Set(characters.flatMap((character) => (character.scores ?? []).map((score) => score.date)))]
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b));
      const dates = limit ? allDates.slice(-limit) : allDates;

      // Each character's own scores are indexed on their own, so two names differing only in case
      // cannot land in the same bucket and overwrite one another the way a shared name-keyed map let
      // them.
      const rows = characters.map((character) => {
        const byDate = new Map((character.scores ?? []).map((score) => [score.date, score.score]));
        return [
          csvCell(character.name),
          csvCell(character.memberSince),
          ...dates.map((date) => byDate.get(date) ?? ""),
        ].join(",");
      });

      const csv = [["Name", "Member Since", ...dates].map(csvCell).join(","), ...rows].join("\r\n") + "\r\n";

      // The byte order mark is what makes Excel read the file as UTF-8 rather than the local codepage.
      const attachment = new AttachmentBuilder(Buffer.from(`﻿${csv}`, "utf-8"), {
        name: `culvert-${dayjs().format("YYYY-MM-DD")}.csv`,
      });

      const span = dates.length ? `${dates[0]} to ${dates[dates.length - 1]}` : "no weeks logged yet";

      await interaction.editReply({
        content:
          `Exported **${characters.length}** character${characters.length === 1 ? "" : "s"} across ` +
          `**${dates.length}** week${dates.length === 1 ? "" : "s"} (${span})`,
        files: [attachment],
      });
    } catch (error) {
      console.error("Error - Data could not be successfully exported", error);
      await interaction.editReply("Error - Data could not be successfully exported").catch(() => {});
    }
  },
};
