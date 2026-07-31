const { EmbedBuilder } = require("discord.js");
const User = require("../schemas/userSchema.js");
const Culvert = require("../schemas/culvertSchema.js");
const cron = require("cron");
const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const timezone = require("dayjs/plugin/timezone");
dayjs.extend(utc);
dayjs.extend(timezone);

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

const BIRTHDAY_CHANNEL_ID = "1090002887410729090";
const BIRTHDAY_TZ = "America/Los_Angeles";

// Everyone born this month, wished together in one message. Fires on the 1st and only on the 1st:
// a bot that is down at that moment skips the month rather than posting late. birthdayAnnouncedYear
// is kept as a cheap guard so the same month can never be announced twice.
const announceBirthdays = async (client) => {
  try {
    const now = dayjs().tz(BIRTHDAY_TZ);
    const month = now.month() + 1;
    const year = now.year();

    // $ne already matches documents where the field is missing or null, so no $or is needed.
    const users = await User.find({ birthdayMonth: month, birthdayAnnouncedYear: { $ne: year } }, { _id: 1 }).lean();
    if (!users.length) return;

    const channel = client.channels.cache.get(BIRTHDAY_CHANNEL_ID);
    if (!channel) return console.error("Error - Birthday message channel not found");

    const guild = channel.guild;
    // Anyone who has left is skipped rather than mentioned as a stale ping.
    const present = users.filter((u) => guild?.members?.cache?.has(u._id));
    if (!present.length) return;

    // "A" · "A and B" · "A, B, and C"
    const names = present.map((u) => `<@${u._id}>`);
    const mentions = names.length <= 2 ? names.join(" and ") : `${names.slice(0, -1).join(", ")}, and ${names.at(-1)}`;

    const embed = new EmbedBuilder()
      .setColor(0xffc3c5)
      .setThumbnail("https://cdn.discordapp.com/emojis/1072880580187930735.png?size=64")
      .setTitle("It's a special month!")
      .setDescription(`Everybody wish ${mentions} a happy birthday this month!`)
      .setFooter({
        text: "Set your own birthday with /birthday set",
        iconURL: "https://cdn.discordapp.com/attachments/1147319860481765500/1149549510066978826/Saku.png",
      });

    await channel.send({ embeds: [embed] });
    await User.updateMany({ _id: { $in: present.map((u) => u._id) } }, { $set: { birthdayAnnouncedYear: year } });
    console.log(`Saku birthdays: announced ${present.length} for ${now.format("MMMM YYYY")}`);
  } catch (error) {
    console.error("Error - Could not announce birthdays:", error);
  }
};

/**
 * Starts the birthday announcer: midnight Pacific on the 1st of every month, and nothing else. There
 * is deliberately no catch-up pass at startup, so the announcement only ever lands on the 1st.
 *
 * The old version built one cron job per person from their own timezone, but converted only the hour
 * and kept the calendar day, so anyone whose midnight fell on a different date in the host's timezone
 * was announced a day out. It also baked the offset in at boot (so it drifted at the next DST change),
 * only built jobs at startup (so a birthday saved later never fired), and had the owner's ID hardcoded
 * into the message, meaning every birthday announced the same person.
 *
 * One monthly job in a named timezone has none of that: cron resolves the zone itself, so the DST
 * shift is handled, and nothing is precomputed per person.
 */
const setBirthdays = (client) => {
  new cron.CronJob("0 0 1 * *", () => announceBirthdays(client), null, true, BIRTHDAY_TZ);
};

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

const ANNIVERSARY_CHANNEL_ID = "719788426022617142";
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
              `${member.user} - **${years}** year${years !== 1 ? "s" : ""} in the guild!`
          )
          .join("\n");

        const embed = new EmbedBuilder()
          .setColor(0xffc3c5)
          .setTitle("Happy Anniversary!")
          .setDescription(description)
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

// announceBirthdays is exported for the test suite: the schedule only fires on the 1st, so there is
// otherwise no way to exercise it without waiting for the calendar.
module.exports = { setBirthdays, announceBirthdays, setAnniversaries };
