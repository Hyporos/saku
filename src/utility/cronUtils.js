const { EmbedBuilder } = require("discord.js");
const User = require("../schemas/userSchema.js");
const cron = require("cron");
const dayjs = require("dayjs");

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

const setBirthdays = async (client) => {
  try {
    const users = await User.find({});
    for (const user of users) {
      const channel = client.channels.cache.get("1090002887410729090");
      const birthdayDate = user.birthdayDate;
      const timezone = user.timezone;

      // Check if values were provided and accessible
      if (!channel) {
        console.log("Error - Birthday message channel not found");
        return;
      }

      if (!birthdayDate || !timezone) continue;

      // Create the birthday message embed
      const birthdayMessage = new EmbedBuilder()
        .setColor(0xffc3c5)
        .setThumbnail(
          "https://cdn.discordapp.com/emojis/1072880580187930735.png?size=64"
        )
        .setTitle("It's a special day today!")
        .setDescription(
          `Everybody wish <@631337640754675725> a happy birthday!`
        )
        .setFooter({
          text: "Set your own birthday with /birthday",
          iconURL:
            "https://cdn.discordapp.com/attachments/1147319860481765500/1149549510066978826/Saku.png",
        });

      // Parse the birthday date
      const birthday = dayjs(birthdayDate, "MM DD");
      const month = birthday.month() + 1; // Add 1 because dayjs month is zero-based
      const day = birthday.date();

      // Convert the user's time zone to EST (as the bot is hosted in this timezone)
      const midnight = dayjs().tz(timezone).startOf("day");
      const hour = midnight.tz("America/Toronto").hour();

      // Create a cron schedule for the user's birthday at midnight
      const cronSchedule = `0 ${hour} ${day} ${month} *`;

      // Create a birthday job for the user
      new cron.CronJob(
        cronSchedule,
        () => {
          channel.send({ embeds: [birthdayMessage] });
        },
        null,
        true // Start the job right away
      );
    }
  } catch (error) {
    console.error("Error - Could not set up birthday jobs:", error);
  }
};

module.exports = { setBirthdays };
