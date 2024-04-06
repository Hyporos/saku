const { SlashCommandBuilder } = require("discord.js");
const userSchema = require("../../userSchema.js");
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
    ),

  // ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

  async execute(interaction) {
    const birthdayDateOption = interaction.options.getString("date");

    if (!dayjs(birthdayDateOption).isValid()) {
      return interaction.reply({
        content: `Error - The date **${birthdayDateOption}** is not valid. Make sure that it is properly formatted (ex: April 28 2023 or 04-28-2023)`,
        ephemeral: true,
      });
    }

    // Add or update the birthday date of the user
    await userSchema.findOneAndUpdate(
      {
        _id: interaction.user.id,
      },
      {
        _id: interaction.user.id,
        birthdayDate: dayjs(
            birthdayDateOption
          ).format("MMM DD, YYYY"),
      },
      {
        upsert: true,
      }
    );

    interaction.reply({
      content: `Your birthday has been set to ${dayjs(
        birthdayDateOption
      ).format("MMM DD, YYYY")}`,
      ephemeral: true,
    });
  },
};
