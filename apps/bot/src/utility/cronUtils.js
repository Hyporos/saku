const { EmbedBuilder } = require("discord.js");
const User = require("../schemas/userSchema.js");
const Culvert = require("../schemas/culvertSchema.js");
const cron = require("cron");
const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
dayjs.extend(utc);

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

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

const ANNIVERSARY_CHANNEL_ID = "1147319860481765500";
const GUILD_ID = "719788426022617138";

/**
 * Schedules a daily midnight UTC job that announces server join anniversaries.
 *
 * @param {Object} client - The Discord.js client.
 */
const setAnniversaries = (client) => {
  new cron.CronJob(
    "0 0 * * *",
    async () => {
      try {
        const guild = client.guilds.cache.get(GUILD_ID);
        if (!guild) {
          console.error("Error - Guild not found for anniversary check");
          return;
        }

        await guild.members.fetch();

        const today = dayjs.utc();
        const culvertUsers = await Culvert.find({});

        const celebrants = culvertUsers
          .flatMap((doc) => {
            if (!doc.characters.length) return [];

            // Use the earliest memberSince across all characters
            const earliest = doc.characters.reduce((min, char) => {
              const date = dayjs.utc(char.memberSince, "MMM DD, YYYY");
              return date.isBefore(min) ? date : min;
            }, dayjs.utc(doc.characters[0].memberSince, "MMM DD, YYYY"));

            const isAnniversary =
              earliest.month() === today.month() &&
              earliest.date() === today.date() &&
              earliest.year() < today.year();

            if (!isAnniversary) return [];

            const member = guild.members.cache.get(doc._id);
            if (!member) return [];

            return [{ member, years: today.year() - earliest.year() }];
          })
          .sort((a, b) => b.years - a.years);

        if (!celebrants.length) return;

        const channel = client.channels.cache.get(ANNIVERSARY_CHANNEL_ID);
        if (!channel) {
          console.error("Error - Anniversary channel not found");
          return;
        }

        const description = celebrants
          .map(
            ({ member, years }) =>
              `${member.user} — **${years}** year${years !== 1 ? "s" : ""} in the guild!`
          )
          .join("\n");

        const embed = new EmbedBuilder()
          .setColor(0xffd700)
          .setTitle("Happy Anniversary!")
          .setDescription(description)
          .setTimestamp()
          .setFooter({
            text: "Thank you for being a part of Saku!",
            iconURL:
              "https://cdn.discordapp.com/attachments/1147319860481765500/1149549510066978826/Saku.png",
          });

        channel.send({ embeds: [embed] });
      } catch (error) {
        console.error("Error - Could not send anniversary announcements:", error);
      }
    },
    null,
    true,
    "UTC"
  );
};

module.exports = { setBirthdays, setAnniversaries };
