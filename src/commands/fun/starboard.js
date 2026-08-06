const {
  SlashCommandBuilder,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  EmbedBuilder,
  MessageFlags,
} = require("discord.js");
const starboardSchema = require("../../schemas/starboardSchema.js");
const { STAR_EMOJI, THRESHOLD, messageUrl } = require("../../domain/starboard.js");
const { GUILD_ID, CHANNELS, EMOJIS } = require("../../config/ids.js");

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

const ACCENT = 0xffc3c5;
const PAGE_SIZE = 10;
const PODIUM = 3;
const MEDALS = ["🥇", "🥈", "🥉"];
const TOP_POSTS = 3; // how many of someone's best posts to list

// Windows for the leaderboard. `days: null` is all time.
const RANGES = {
  all: { label: "All Time", days: null },
  year: { label: "This Year", days: 365 },
  month: { label: "This Month", days: 30 },
};

// Straight to the original wherever we know which channel it came from. Posts made by an older
// version of the bot carry no jump link, so their source channel is unrecoverable and the starboard
// post itself is the only thing left to point at.
const jumpUrl = (e) =>
  e.channelId ? messageUrl(GUILD_ID, e.channelId, e._id) : messageUrl(GUILD_ID, CHANNELS.STARBOARD, e.starboardId);

// The stored name, not a mention. <@id> renders as "@unknown-user" or a raw id the moment someone
// leaves the server, and a board full of old posts is mostly people who have.
const who = (e) => e.authorName ?? (e.authorId ? `<@${e.authorId}>` : "someone");

// Ranked by the highest a post ever reached, not by where it sits now: stars come off over time and
// an old favourite should not slide down the board because a few people left the server.
const scoreOf = (e) => Math.max(e.peakCount ?? 0, e.count ?? 0);

// Every link to an entry, everywhere, is the word "jump". Using the post's own text as the label was
// tried and dropped: it made each row a different length, and quoting part of a message inside a link
// reads as if the link is about that fragment rather than the post.
const jump = (e) => `[jump](${jumpUrl(e)})`;

const since = (days) => (days ? new Date(Date.now() - days * 24 * 60 * 60 * 1000) : null);

async function entriesFor(days) {
  const when = since(days);
  const query = when ? { starredAt: { $gte: when } } : {};
  // The leaderboard needs a name, a score and somewhere to point. Attachments and the starrer id
  // lists are the two heavy fields on a row and neither is read here, so the whole board no longer
  // gets pulled into memory to render thirteen lines of it.
  const rows = await starboardSchema.find(query, { attachments: 0, starrers: 0, content: 0 }).lean();
  return rows.sort((a, b) => scoreOf(b) - scoreOf(a));
}

// ⎯⎯ /starboard top ⎯⎯ //

async function top(interaction) {
  await interaction.reply({
    components: [new ContainerBuilder().setAccentColor(ACCENT).addTextDisplayComponents(new TextDisplayBuilder().setContent("Loading the starboard…"))],
    flags: MessageFlags.IsComponentsV2,
  });

  // Loaded once per range and cached, so paging and switching are instant rather than a query each.
  const cache = new Map();
  const dataFor = async (range) => {
    if (!cache.has(range)) cache.set(range, await entriesFor(RANGES[range].days));
    return cache.get(range);
  };

  const state = { range: "all", page: 1 };
  const mine = interaction.user.id;

  const view = async (disabled = false) => {
    const entries = await dataFor(state.range);
    const podium = entries.slice(0, PODIUM);
    const rest = entries.slice(PODIUM);
    const maxPage = Math.max(1, Math.ceil(rest.length / PAGE_SIZE));
    state.page = Math.min(Math.max(1, state.page), maxPage);
    const rows = rest.slice((state.page - 1) * PAGE_SIZE, state.page * PAGE_SIZE);

    const podiumStr =
      podium
        .map((e, i) => `${MEDALS[i]} ${STAR_EMOJI} **${scoreOf(e)}** — **${who(e)}**${e.authorId === mine ? " ⟵ **you**" : ""} · ${jump(e)}`)
        .join("\n") || `-# Nothing has reached ${THRESHOLD} stars in this window yet.`;

    const listStr = rows.length
      ? rows.map((e, i) => `\`#${PODIUM + (state.page - 1) * PAGE_SIZE + i + 1}\` ${STAR_EMOJI} **${scoreOf(e)}** ${who(e)} · ${jump(e)}`).join("\n")
      : podium.length
      ? "-# That's everything."
      : "-# —";

    const container = new ContainerBuilder()
      .setAccentColor(ACCENT)
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`## Starboard Charts\n-# ${RANGES[state.range].label} · ${entries.length} post${entries.length === 1 ? "" : "s"}`)
      )
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(podiumStr))
      .addSeparatorComponents(new SeparatorBuilder())
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(listStr))
      .addSeparatorComponents(new SeparatorBuilder())
      .addActionRowComponents(
        new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId("sb_range")
            .setDisabled(disabled)
            .addOptions(Object.entries(RANGES).map(([value, r]) => ({ label: r.label, value, default: value === state.range })))
        )
      )
      .addActionRowComponents(
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("sb_first").setEmoji(EMOJIS.NAV.first).setStyle(ButtonStyle.Secondary).setDisabled(disabled || state.page === 1),
          new ButtonBuilder().setCustomId("sb_prev").setEmoji(EMOJIS.NAV.prev).setStyle(ButtonStyle.Primary).setDisabled(disabled || state.page === 1),
          new ButtonBuilder().setCustomId("sb_next").setEmoji(EMOJIS.NAV.next).setStyle(ButtonStyle.Primary).setDisabled(disabled || state.page === maxPage),
          new ButtonBuilder().setCustomId("sb_last").setEmoji(EMOJIS.NAV.last).setStyle(ButtonStyle.Secondary).setDisabled(disabled || state.page === maxPage)
        )
      )
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# Page ${state.page}/${maxPage}`));

    return { components: [container], flags: MessageFlags.IsComponentsV2 };
  };

  const message = await interaction.editReply(await view());
  const collector = message.createMessageComponentCollector({ idle: 120_000 });

  collector.on("collect", async (i) => {
    try {
      if (i.user.id !== interaction.user.id) {
        return i.reply({ content: "This isn't your starboard panel — run `/starboard top` for your own.", flags: MessageFlags.Ephemeral }).catch(() => {});
      }
      try {
        await i.deferUpdate();
      } catch {
        return; // a stale panel can outlive its interaction token
      }
      if (i.customId === "sb_range") {
        state.range = i.values[0];
        state.page = 1;
      } else if (i.customId === "sb_first") state.page = 1;
      else if (i.customId === "sb_prev") state.page -= 1;
      else if (i.customId === "sb_next") state.page += 1;
      else if (i.customId === "sb_last") state.page = Infinity;

      await i.editReply(await view());
    } catch (err) {
      console.error("Error - /starboard top interaction failed:", err);
    }
  });

  collector.on("end", async () => {
    await interaction.editReply(await view(true)).catch(() => {});
  });
}

// ⎯⎯ /starboard user ⎯⎯ //

async function user(interaction) {
  await interaction.deferReply();
  const target = interaction.options.getUser("member") ?? interaction.user;

  // The stars they handed out are counted in the database rather than by pulling every row down and
  // filtering in memory, which is what this used to do: the whole board, every time, to reach one
  // number. Their own posts are projected down to the fields the embed actually reads.
  const [authored, given] = await Promise.all([
    starboardSchema.find({ authorId: target.id }, { channelId: 1, starboardId: 1, count: 1, peakCount: 1 }).lean(),
    starboardSchema.countDocuments({ starrers: target.id }),
  ]);

  // Built once and shared. The empty view is the same embed with a line of text instead of fields,
  // and the footer belongs on both, so the stars they have handed out still show either way.
  const embed = new EmbedBuilder()
    .setColor(ACCENT)
    .setAuthor({ name: target.displayName ?? target.username, iconURL: target.displayAvatarURL() })
    .setFooter({ text: `Stars given on ${given} post${given === 1 ? "" : "s"}` });

  if (!authored.length) {
    return interaction.editReply({ embeds: [embed.setDescription("Nothing of theirs has reached the starboard yet.")] });
  }

  const sorted = [...authored].sort((a, b) => scoreOf(b) - scoreOf(a));
  const totalStars = authored.reduce((sum, e) => sum + scoreOf(e), 0);

  embed.addFields(
    { name: "Posts", value: `**${authored.length}**`, inline: true },
    { name: "Stars earned", value: `${STAR_EMOJI} **${totalStars.toLocaleString()}**`, inline: true }
  );

  // One list rather than a stat plus a link plus a runners-up field: the best post's star count is
  // already the first row below, so naming it twice said nothing new.
  // Every link goes to the original message, not the starboard copy: the copy is a screenshot of the
  // moment, and what people want is the conversation it came from.
  const top = sorted.slice(0, TOP_POSTS);
  embed.addFields({
    name: top.length === 1 ? "Top post" : "Top posts",
    value: top.map((e) => `${STAR_EMOJI} **${scoreOf(e)}** · ${jump(e)}`).join("\n"),
  });

  await interaction.editReply({ embeds: [embed] });
}

// ⎯⎯ /starboard random ⎯⎯ //

async function random(interaction) {
  await interaction.deferReply();
  const [pick] = await starboardSchema.aggregate([{ $sample: { size: 1 } }]);
  if (!pick) return interaction.editReply("Nothing has made the starboard yet.");

  const score = scoreOf(pick);
  const when = pick.starredAt ? Math.floor(new Date(pick.starredAt).getTime() / 1000) : null;
  const context = [
    `${STAR_EMOJI} **${score}** star${score === 1 ? "" : "s"}${pick.peakCount > pick.count ? ` (${pick.count} now)` : ""}`,
    when ? `Made the board <t:${when}:R>` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const body = (pick.content ?? "").trim();
  // The member cache only holds people who are still here, and a lot of the board is people who are
  // not. Fetching the user works either way and is cached by discord.js after the first time.
  const author = pick.authorId
    ? (interaction.guild?.members?.cache?.get(pick.authorId) ?? (await interaction.client.users.fetch(pick.authorId).catch(() => null)))
    : null;

  const embed = new EmbedBuilder()
    .setColor(ACCENT)
    .setAuthor({ name: who(pick), iconURL: author?.displayAvatarURL?.() ?? undefined })
    .setDescription(
      [
        body || null,
        pick.editedAt ? `-# *edited after it reached the starboard*` : null,
        `[${pick.channelId ? "Jump to message" : "Jump to Starboard"}](${jumpUrl(pick)})`,
      ]
        .filter(Boolean)
        .join("\n\n")
    )
    .addFields({ name: "​", value: context });

  const image = (pick.attachments ?? []).find((a) => a.isImage);
  if (image) embed.setImage(image.url);
  if (pick.starredAt) embed.setTimestamp(new Date(pick.starredAt));

  await interaction.editReply({ embeds: [embed] });
}

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

module.exports = {
  data: new SlashCommandBuilder()
    .setName("starboard")
    .setDescription(`Browse the starboard: everything that hit ${THRESHOLD} stars`)
    .addSubcommand((sub) => sub.setName("top").setDescription("The most starred posts, interactive"))
    .addSubcommand((sub) =>
      sub
        .setName("user")
        .setDescription("Someone's starboard record")
        .addUserOption((o) => o.setName("member").setDescription("Whose record to show (defaults to you)"))
    )
    .addSubcommand((sub) => sub.setName("random").setDescription("Pull a random post off the starboard")),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    try {
      if (sub === "top") return await top(interaction);
      if (sub === "user") return await user(interaction);
      if (sub === "random") return await random(interaction);
    } catch (err) {
      console.error(`Error - /starboard ${sub} failed:`, err);
      const notice = { content: "Error - the starboard didn't load. Try again in a moment.", flags: MessageFlags.Ephemeral };
      await (interaction.deferred || interaction.replied ? interaction.followUp(notice) : interaction.reply(notice)).catch(() => {});
    }
  },
};
