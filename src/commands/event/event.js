const {
  SlashCommandBuilder,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  ComponentType,
  MessageFlags,
} = require("discord.js");
const eventSchema = require("../../schemas/eventSchema.js");
const { CHANNELS, EMOJIS, isBee } = require("../../config/ids.js");

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //
// All four subcommands live here. They used to be sibling files, which the command loader reads as
// commands in their own right — with no `data` export each one failed that check and logged a warning
// on every boot, in index.js, deploy-commands.js and /reload alike.

// The only two channels /event works in.
const ALLOWED_CHANNELS = [CHANNELS.EVENT, CHANNELS.REMINDERS_SCAN];

const PAGE_SIZE = 10;
const NAME_WIDTH = 17;

// ⎯⎯ /event add ⎯⎯ //

async function add(interaction) {
  const count = interaction.options.getInteger("count");
  const targetUser = interaction.options.getUser("user") || interaction.user;
  const isSelf = targetUser.id === interaction.user.id;

  // Adding to someone else's total is a bee action. This used to test the bee role alone, so the
  // owner was refused unless they happened to hold it too.
  if (!isSelf && !isBee(interaction.member, interaction.user.id)) {
    return interaction.reply({
      content: "Error - You do not have permission to add mob count for other users.",
      flags: MessageFlags.Ephemeral,
    });
  }

  let user = await eventSchema.findById(targetUser.id);
  if (!user) {
    user = await eventSchema.create({ _id: targetUser.id, mobcount: count });
  } else {
    user.mobcount += count;
    await user.save();
  }

  const total = user.mobcount.toLocaleString();
  await interaction.reply(
    isSelf
      ? `You've added ${count.toLocaleString()} mobs to your total count! You now have ${total} mobs.`
      : `Added ${count.toLocaleString()} mobs to <@${targetUser.id}>'s total count.\nThey now have ${total} mobs.`
  );
}

// ⎯⎯ /event subtract ⎯⎯ //

async function subtract(interaction) {
  const targetUser = interaction.options.getUser("user");
  const count = interaction.options.getInteger("count");

  if (!targetUser) {
    return interaction.reply("Error - Please specify a valid user.");
  }

  const user = await eventSchema.findById(targetUser.id);
  if (!user) {
    return interaction.reply("Error - User not found in the event database.");
  }

  // Floored at zero: subtracting more than someone has should empty their count, not owe them mobs.
  user.mobcount = Math.max(0, user.mobcount - count);
  await user.save();

  await interaction.reply(
    `Subtracted ${count.toLocaleString()} mobs from <@${targetUser.id}>'s total count.\nThey now have ${user.mobcount.toLocaleString()} mobs.`
  );
}

// ⎯⎯ /event mobcount ⎯⎯ //

async function mobcount(interaction) {
  const targetUser = interaction.options.getUser("user") || interaction.user;

  const user = await eventSchema.findById(targetUser.id);
  if (!user) {
    return interaction.reply({
      content: `Hmmm... <@${targetUser.id}> hasn't logged any mob kills yet.`,
      allowedMentions: { users: [] },
    });
  }

  const total = user.mobcount.toLocaleString();
  // Compared by id, not by object identity — `targetUser === interaction.user` was false even when
  // they were the same person, because getUser returns its own instance.
  if (targetUser.id === interaction.user.id) {
    return interaction.reply(`You've hunted a total of ${total} mobs since the start of this event.`);
  }
  await interaction.reply({
    content: `<@${targetUser.id}> has hunted a total of ${total} mobs since the start of this event.`,
    allowedMentions: { users: [] },
  });
}

// ⎯⎯ /event leaderboard ⎯⎯ //

async function leaderboard(interaction) {
  await interaction.deferReply();

  let users = await eventSchema.find({}, { _id: 1, mobcount: 1 }).lean();
  users = users.filter((u) => (u.mobcount || 0) > 0);

  if (!users.length) {
    return interaction.editReply("Error - No mob counts have been submitted");
  }

  users.sort((a, b) => (b.mobcount || 0) - (a.mobcount || 0));
  users.forEach((u, i) => (u.rank = i + 1));

  let page = 1;
  const maxPage = Math.max(1, Math.ceil(users.length / PAGE_SIZE));

  async function resolveNames(list) {
    for (const entry of list) {
      const member = await interaction.guild.members.fetch(entry._id).catch(() => null);
      entry.display = member ? member.user.tag : entry._id;
    }
  }

  function format(list) {
    const maxRankDigits = String(users.length).length;
    let out = "```";
    for (const e of list) {
      const rankStr = String(e.rank).padStart(maxRankDigits);
      const name =
        e.display.length > NAME_WIDTH
          ? e.display.slice(0, NAME_WIDTH - 1) + "…"
          : e.display.padEnd(NAME_WIDTH, " ");
      out += `${rankStr}. ${name} ${(e.mobcount || 0).toLocaleString()}\n`;
    }
    return `${out}\`\`\``;
  }

  async function buildEmbed(p) {
    const start = (p - 1) * PAGE_SIZE;
    const pageData = users.slice(start, start + PAGE_SIZE);
    await resolveNames(pageData);
    return new EmbedBuilder()
      .setColor(0xffc3c5)
      .setAuthor({ name: "Event Leaderboard (Mob Count)" })
      .setDescription(format(pageData))
      .setFooter({ text: `Participants: ${users.length}` });
  }

  function makeRow() {
    return new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("prev")
        .setEmoji(EMOJIS.NAV.prev)
        .setStyle(ButtonStyle.Primary)
        .setDisabled(page === 1),
      new ButtonBuilder()
        .setCustomId("page")
        .setLabel(`${page}/${maxPage}`)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true),
      new ButtonBuilder()
        .setCustomId("next")
        .setEmoji(EMOJIS.NAV.next)
        .setStyle(ButtonStyle.Primary)
        .setDisabled(page === maxPage)
    );
  }

  const message = await interaction.editReply({
    embeds: [await buildEmbed(page)],
    components: [makeRow()],
  });

  if (maxPage === 1) return;

  const collector = message.createMessageComponentCollector({
    componentType: ComponentType.Button,
    idle: 120000,
    filter: (i) => i.user.id === interaction.user.id,
  });

  collector.on("collect", async (i) => {
    if (i.customId === "prev" && page > 1) page--;
    else if (i.customId === "next" && page < maxPage) page++;

    // Deferred first: resolving ten members can outlast the three seconds `update` allows.
    await i.deferUpdate();
    await interaction.editReply({ embeds: [await buildEmbed(page)], components: [makeRow()] });
  });

  collector.on("end", async () => {
    await interaction.editReply({ components: [] }).catch(() => {});
  });
}

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

const SUBCOMMANDS = { add, subtract, mobcount, leaderboard };

module.exports = {
  // Only this subcommand is restricted; the rest of /event is open to everyone.
  tiers: { subtract: "bee" },
  data: new SlashCommandBuilder()
    .setName("event")
    .setDescription("Saku Event Commands")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("add")
        .setDescription("Log the number of mobs you've hunted")
        .addIntegerOption((option) =>
          option.setName("count").setDescription("Mob count to add").setRequired(true)
        )
        .addUserOption((option) =>
          option
            .setName("user")
            .setDescription("[ADMIN] The user you wish to add mob count to")
            .setRequired(false)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("subtract")
        .setDescription("[BEE] Subtract mob count from a user's total")
        .addIntegerOption((option) =>
          option.setName("count").setDescription("Mob count to subtract").setRequired(true)
        )
        .addUserOption((option) =>
          option
            .setName("user")
            .setDescription("The user you wish to subtract mob count from")
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("mobcount")
        .setDescription("View the amount of mobs you've hunted this event")
        .addUserOption((option) =>
          option
            .setName("user")
            .setDescription("The user's mob count you wish to view")
            .setRequired(false)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand.setName("leaderboard").setDescription("View the mob count leaderboard")
    ),

  async execute(interaction) {
    if (!ALLOWED_CHANNELS.includes(interaction.channelId)) {
      return interaction.reply({
        content: "Error - You can only use this command in the designated event channels",
        flags: MessageFlags.Ephemeral,
      });
    }

    try {
      await SUBCOMMANDS[interaction.options.getSubcommand()](interaction);
    } catch (error) {
      console.error("Error - /event failed:", error);
      // Only reply if nothing has been sent yet: /event leaderboard defers, and replying to a
      // deferred interaction throws a second error on top of the first.
      const notice = "Error - Could not execute event command";
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(notice).catch(() => {});
      } else {
        await interaction.reply({ content: notice, flags: MessageFlags.Ephemeral }).catch(() => {});
      }
    }
  },
};
