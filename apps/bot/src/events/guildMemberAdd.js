const { Events, EmbedBuilder } = require("discord.js");
const dayjs = require("dayjs");
const relativeTime = require("dayjs/plugin/relativeTime");
dayjs.extend(relativeTime);
const { CHANNELS } = require("../config/ids.js");

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

module.exports = {
  name: Events.GuildMemberAdd,
  async execute(member, client) {
    // Fetch the channels to send welcome messages to
    const welcomeChannel = member.guild.channels.cache.get(CHANNELS.INTRODUCTIONS);
    await welcomeChannel.fetch();

    const logChannel = member.guild.channels.cache.get(CHANNELS.MEMBER_LOG);
    await logChannel.fetch();

    // Create the welcome message
    const welcomeMessage = `${member.user} Welcome to Saku's Discord server! Change your nickname to Preferred Name (IGN).

Then comment: Preferred Name / IGN / Reason for joining (e.g. new member, bossing with miche, guest of miche, emotes only)`;

    // Create the log embed
    const createdAt = dayjs().from(dayjs(member.user.createdAt), true);
    const memberCount = member.guild.members.cache.filter(
      (member) => !member.user.bot
    ).size;

    const log = new EmbedBuilder()
      .setColor(0x85ff89)
      .setAuthor({
        name: `${member.user.username}`,
        iconURL: `${member.displayAvatarURL()}`,
      })
      .setTitle("Member joined")
      .setDescription(
        `${member.user}\nDiscord member for ${createdAt}\n**Member Count:** ${memberCount}`
      )
      .setTimestamp()
      .setFooter({
        text: `ID: ${member.id}`,
      });

    // Handle responses
    welcomeChannel.send(welcomeMessage);
    logChannel.send({ embeds: [log] });
  },
};
