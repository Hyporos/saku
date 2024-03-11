const { Events, EmbedBuilder } = require("discord.js");

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

module.exports = {
  name: Events.GuildMemberUpdate,
  async execute(oldMember, newMember) {
    // Fetch the channels to log messages to
    const logChannel = await newMember.guild.channels.cache.find(
      (channel) => channel.name === "server-log"
    );
    await logChannel.fetch();

    // Only send a log if the user nickname was changed
    if (oldMember.nickname === newMember.nickname) {
        return;
    }

    // Check if the nickname was changed
    let event = "";

    if (oldMember.nickname !== newMember.nickname) {
      if (!oldMember.nickname && newMember.nickname) {
        event = "Nickname added";
      } else if (oldMember.nickname && !newMember.nickname) {
        event = "Nickname removed";
      } else {
        event = "Nickname changed";
      }
    }

    // Create the log embed
    const log = new EmbedBuilder()
      .setColor(0x85b0ff)
      .setAuthor({
        name: `${newMember.user.username}`,
        iconURL: `${newMember.displayAvatarURL()}`,
      })
      .setTitle(event)
      .setDescription(
        `**Before:** ${oldMember.nickname ?? oldMember.user.username}\n**+After:** ${newMember.nickname ?? newMember.user.username}`
      )
      .setTimestamp()
      .setFooter({
        text: `ID: ${newMember.id}`,
      });

    // Display event responses
    logChannel.send({ embeds: [log] });
  },
};
