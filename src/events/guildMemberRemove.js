const { Events, EmbedBuilder } = require("discord.js");
const dayjs = require("dayjs");
const relativeTime = require("dayjs/plugin/relativeTime");
dayjs.extend(relativeTime);

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

module.exports = {
  name: Events.GuildMemberRemove,
  async execute(member) {
    // Fetch the channels to log messages to
    const logChannel = await member.guild.channels.cache.find(
      (channel) => channel.name === "server-log"
    );
    await logChannel.fetch();

    // Create the log embed
    const joinedAt = dayjs(member.joinedAt).format("MMM D YYYY");

    const log = new EmbedBuilder()
      .setColor(0xff6161)
      .setAuthor({
        name: `${member.user.username}`,
        iconURL: `${member.displayAvatarURL()}`,
      })
      .setTitle("Member left")
      .setDescription(`${member.user}\nSaku member since ${joinedAt}`)
      .setTimestamp()
      .setFooter({
        text: `ID: ${member.id}`,
      });

    // Display event responses
    logChannel.send({ embeds: [log] });
  },
};
