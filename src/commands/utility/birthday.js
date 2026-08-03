const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const userSchema = require("../../schemas/userSchema.js");
const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const timezone = require("dayjs/plugin/timezone");
dayjs.extend(utc);
dayjs.extend(timezone);

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //
// Only the month is asked for. Everyone born in a month is wished together on the 1st, so a day
// was never used, and free-text dates were the whole source of the old command's problems.

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// Announcements run at midnight Pacific, so that's the clock every date below is worked out in.
const BIRTHDAY_TZ = "America/Los_Angeles";

/**
 * When this person will actually be wished, given the month they just saved.
 *
 * Saving your own month partway through it doesn't miss the year: the nightly pass picks up anyone
 * the 1st didn't cover, so the wish lands at the next midnight Pacific. The one gap is saving it on
 * the last day of your own month, because by that next midnight the month has rolled over and the
 * query no longer matches, so it waits for next year.
 *
 * @param {number} month - 1-12, the month that was just saved.
 * @param {boolean} alreadyWished - true if this person has already been announced this year.
 * @param {Object} [now] - Pacific-zone dayjs for "now"; injectable so the month boundary is testable.
 * @returns {string} A sentence describing when the announcement lands.
 */
function announcementTiming(month, alreadyWished, now = dayjs().tz(BIRTHDAY_TZ)) {
  const name = MONTHS[month - 1];

  if (month !== now.month() + 1) return `Saku will wish you on the 1st of **${name}**, along with everyone else born that month.`;
  if (alreadyWished) return `**${name}** has already been wished this year, so Saku will get you next time around.`;

  const next = now.add(1, "day").startOf("day");
  if (next.month() + 1 !== month) {
    return `**${name}** ends tonight, so Saku will wish you on the 1st of **${name}** next year.`;
  }
  return `Saku will wish you tomorrow, **${next.format("MMMM D")}**, at midnight Pacific.`;
}

module.exports = {
  announcementTiming, // exported for tests/birthdayTiming.js
  data: new SlashCommandBuilder()
    .setName("birthday")
    .setDescription("Set your birthday month so Saku can celebrate it with the guild")
    .addSubcommand((sub) =>
      sub
        .setName("set")
        .setDescription("Set the month you were born in")
        .addIntegerOption((option) =>
          option
            .setName("month")
            .setDescription("The month you were born in")
            .setRequired(true)
            .addChoices(...MONTHS.map((name, i) => ({ name, value: i + 1 })))
        )
    )
    .addSubcommand((sub) =>
      sub.setName("clear").setDescription("Remove your birthday so it is no longer announced")
    ),

  // ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === "clear") {
      const existing = await userSchema.findById(interaction.user.id, "birthdayMonth").lean();
      if (!existing?.birthdayMonth) {
        return interaction.reply({ content: "You don't have a birthday saved.", flags: MessageFlags.Ephemeral });
      }
      await userSchema.updateOne(
        { _id: interaction.user.id },
        { $unset: { birthdayMonth: "", birthdayAnnouncedYear: "" } }
      );
      return interaction.reply({ content: "Your birthday has been removed.", flags: MessageFlags.Ephemeral });
    }

    const month = interaction.options.getInteger("month");
    const name = MONTHS[month - 1];

    // Changing to a different month clears the announced marker, so someone who fixes a wrong month
    // can still be included this year. Re-picking the same month leaves it alone, so it can't be
    // used to trigger a second announcement.
    const existing = await userSchema.findById(interaction.user.id, "birthdayMonth birthdayAnnouncedYear").lean();
    const moved = existing?.birthdayMonth !== month;

    await userSchema.findOneAndUpdate(
      { _id: interaction.user.id },
      { _id: interaction.user.id, birthdayMonth: month, ...(moved ? { birthdayAnnouncedYear: null } : {}) },
      { upsert: true }
    );

    // Only counts as already wished if the marker survived, which it doesn't when the month changed.
    const alreadyWished = !moved && existing?.birthdayAnnouncedYear === dayjs().tz(BIRTHDAY_TZ).year();

    await interaction.reply({
      content: `Your birthday is set to **${name}**. ${announcementTiming(month, alreadyWished)}`,
      flags: MessageFlags.Ephemeral,
    });
  },
};
