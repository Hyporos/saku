const { Events, EmbedBuilder } = require("discord.js");
const dayjs = require("dayjs");

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

module.exports = {
  name: Events.GuildMemberRemove,
  async execute(member) {
    // Fetch the channels to log messages to
    const logChannel = await member.guild.channels.cache.find(
      (channel) => channel.name === "server-log"
    );
    await logChannel.fetch();

    // Fetch the roles that the user had
    function getMemberRoles() {
      const roles = member.roles.cache;
      const roleNames = ["Guests/Friends", "Member", "Alliance", "Legacy"];

      for (const roleName of roleNames) {
        const foundRole = roles.find((role) => role.name === roleName);
        if (foundRole) {
          return roleName;
        }
      }

      return "None";
    }

    // Create the log embed
    const joinedAt = dayjs(member.joinedAt).format("MMM D YYYY");

    const log = new EmbedBuilder()
      .setColor(0xff8585)
      .setAuthor({
        name: `${member.user.username}`,
        iconURL: `${member.displayAvatarURL()}`,
      })
      .setTitle("Member left")
      .setDescription(
        `${
          member.user
        }\nSaku member since ${joinedAt}\n**Role:** ${getMemberRoles()}`
      )
      .setTimestamp()
      .setFooter({
        text: `ID: ${member.id}`,
      });

    // Display event responses
    logChannel.send({ embeds: [log] });
  },
};
