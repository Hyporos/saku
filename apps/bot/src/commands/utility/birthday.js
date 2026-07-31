const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const userSchema = require("../../schemas/userSchema.js");

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //
// Only the month is asked for. Everyone born in a month is wished together on the 1st, so a day
// was never used, and free-text dates were the whole source of the old command's problems.

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

module.exports = {
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
    const existing = await userSchema.findById(interaction.user.id, "birthdayMonth").lean();
    const moved = existing?.birthdayMonth !== month;

    await userSchema.findOneAndUpdate(
      { _id: interaction.user.id },
      { _id: interaction.user.id, birthdayMonth: month, ...(moved ? { birthdayAnnouncedYear: null } : {}) },
      { upsert: true }
    );

    await interaction.reply({
      content: `Your birthday is set to **${name}**. Saku will wish you on the 1st, along with everyone else born that month.`,
      flags: MessageFlags.Ephemeral,
    });
  },
};
