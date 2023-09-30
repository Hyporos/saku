const { Events, EmbedBuilder } = require("discord.js");
const dayjs = require("dayjs");
const relativeTime = require("dayjs/plugin/relativeTime");
dayjs.extend(relativeTime);

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

module.exports = {
  name: Events.GuildMemberAdd,
  async execute(member, client) {
    // Fetch the channels to send welcome messages to
    const welcomeChannel = await member.guild.channels.cache.find(
      (channel) => channel.name === "🤝│introductions"
    );
    await welcomeChannel.fetch();

    const logChannel = await member.guild.channels.cache.find(
      (channel) => channel.name === "server-log"
    );
    await logChannel.fetch();

    // Create the welcome embed
    const welcome = new EmbedBuilder()
      .setColor(0xffc3c5)
      .setAuthor({
        name: `Welcome to Saku, ${member.user.username}!`,
        iconURL:
          "https://cdn.discordapp.com/icons/719788426022617138/a_2ed98f7952ca3456a52008c11a6b79cf.png",
      })
      .setDescription(
        `Hey ${member.user}!\n\nTo gain access to our Discord, please write a little introduction about yourself and change your Discord nickname to your Preferred Name (IGN).\n\nFor example: miche (superbbzzzzz)\n\n✦ • ────────────── · · · · · · · · ✦`
      )
      .setImage(
        "https://media.discordapp.net/attachments/670464920198053891/1128866120561070160/Welcome.png"
      )
      .setFooter({
        text: "We hope you enjoy your stay here!",
        iconURL:
          "https://cdn.discordapp.com/emojis/1113499485042130945.webp?size=96&quality=lossless",
      });

    // Create the log embed
    const createdAt = dayjs(member.user.createdAt).format("MMM D YYYY");

    const log = new EmbedBuilder()
      .setColor(0x85ff89)
      .setAuthor({
        name: `${member.user.username}`,
        iconURL: `${member.displayAvatarURL()}`,
      })
      .setTitle("Member joined")
      .setDescription(
        `${member.user}\nDiscord member since ${createdAt}`
      )
      .setTimestamp()
      .setFooter({
        text: `ID: ${member.id}`,
      });

    // Display event responses
    welcomeChannel.send({ content: `${member.user}`, embeds: [welcome] });
    logChannel.send({ embeds: [log] });
  },
};
