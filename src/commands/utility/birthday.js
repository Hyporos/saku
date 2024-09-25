const { SlashCommandBuilder } = require("discord.js");
const userSchema = require("../../schemas/userSchema.js");
const { listTimeZones } = require("timezone-support");
const dayjs = require("dayjs");

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

module.exports = {
  data: new SlashCommandBuilder()
    .setName("birthday")
    .setDescription(
      "Set your birthday date! The bot will announce it in the server :)"
    )
    .addStringOption((option) =>
      option
        .setName("date")
        .setDescription("The date of your birthday")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("timezone")
        .setDescription(
          "Your current timezone (ex: America/Toronto)"
        )
        .setRequired(true)
    ),

  // ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

  async execute(interaction) {
    // Parse the command arguments
    const birthdayDateOption = interaction.options.getString("date");
    const timezoneOption = interaction.options.getString("timezone");

    // Check if the date is valid (real or not)
    if (!dayjs(birthdayDateOption).isValid()) {
      return interaction.reply({
        content: `Error - The date **${birthdayDateOption}** is not valid. Make sure that it is properly formatted (ex: April 28)`,
        ephemeral: true,
      });
    }

    // Check if the timezone is valid
    function isTimezoneValid(timezone) {
      const validTimezones = listTimeZones();
      return validTimezones.map(tz => tz.toLowerCase()).includes(timezone.toLowerCase());
    }

    if (!isTimezoneValid(timezoneOption)) {
      return interaction.reply({
        content: `Error - The timezone **${timezoneOption}** is not valid. Make sure that it is properly formatted (ex: America/Toronto).\n\nYou can find your timezone here: https://www.timezoneconverter.com/cgi-bin/findzone`,
        ephemeral: true,
      });
    }

    // Add or update the birthday date and timezone of the user
    await userSchema.findOneAndUpdate(
      {
        _id: interaction.user.id,
      },
      {
        _id: interaction.user.id,
        birthdayDate: dayjs(birthdayDateOption).format("MMMM DD"),
        timezone: timezoneOption,
      },
      {
        upsert: true,
      }
    );

    // Handle responses
    interaction.reply({
      content: `Your birthday has been set to **${dayjs(
        birthdayDateOption
      ).format("MMMM DD")}**, in the **${timezoneOption}** timezone.`,
      ephemeral: true,
    });
  },
};
