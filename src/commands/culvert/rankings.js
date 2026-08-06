const {
  SlashCommandBuilder,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  MessageFlags,
} = require("discord.js");
const culvertSchema = require("../../schemas/culvertSchema.js");
const characterMetaSchema = require("../../schemas/characterMetaSchema.js");
const { getAllCharacters, getResetDates, normalizeName } = require("../../utility/culvertUtils.js");
const { ACCENT, textPanel } = require("../../utility/culvertChart.js");
const { EMOJIS } = require("../../config/ids.js");
const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
dayjs.extend(utc);

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

const PAGE_SIZE = 10;
const PODIUM = 3;
const MEDALS = ["🥇", "🥈", "🥉"];

// Pagination chevrons (guild custom emojis)
const NAV = {
  first: "<:doubleleftchevron:1193783344996024350>",
  prev: "<:singleleftchevron:1375242927634120804>",
  next: "<:singlerightchevron:1375242928787689693>",
  last: "<:doublerightchevron:1193783935071682591>",
};

const METRICS = {
  weekly: { label: "Weekly", field: "thisScore" },
  yearly: { label: "Yearly", field: "yearlyThis" },
};

// Classes come from the cached rankings metadata rather than a list written down here. MapleStory has
// well over forty jobs and gains more with every big patch, so anything hardcoded would be wrong
// within a year — and at 46 and counting it is already past the 25 option cap a choice list allows,
// which is why this is an autocomplete instead.
//
// Keyed with the shared normalizeName, not a plain toLowerCase: that collection folds l/1/i and o/0
// together, so lowercasing missed 73 of the 202 linked characters outright.
async function jobsByCharacter() {
  const metas = await characterMetaSchema.find({ job: { $ne: null } }, { name: 1, job: 1 }).lean();
  return new Map(metas.map((meta) => [normalizeName(meta._id), meta.job]));
}

// ⎯⎯ Helpers ⎯⎯ //

// Sorted entries for a metric: [{ c, value, rank }] descending by value.
function rankEntries(metric, chars) {
  const field = METRICS[metric].field;
  const list = chars.filter((c) => c[field] > 0).map((c) => ({ c, value: c[field] }));
  list.sort((a, b) => b.value - a.value);
  list.forEach((e, i) => (e.rank = i + 1));
  return list;
}

const fmtScore = (e) => `**${e.value.toLocaleString()}**`;

// Time until the current culvert week resets (Thursday 12:00 AM UTC).
function updatesIn(nextReset) {
  const now = dayjs().utc();
  const days = nextReset.diff(now, "day");
  if (days >= 1) return `${days} day${days > 1 ? "s" : ""}`;
  const hours = nextReset.diff(now, "hour");
  if (hours >= 1) return `${hours} hour${hours > 1 ? "s" : ""}`;
  const mins = nextReset.diff(now, "minute");
  return `${mins} minute${mins !== 1 ? "s" : ""}`;
}

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

module.exports = {
  data: new SlashCommandBuilder()
    .setName("rankings")
    .setDescription("View the interactive culvert leaderboard")
    .addStringOption((option) =>
      option
        .setName("class")
        .setDescription("Only rank characters of this class")
        .setRequired(false)
        .setAutocomplete(true)
    ),

  // ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

  // Only classes somebody in the guild actually plays, so the list stays short and can never go stale:
  // a class nobody plays is not worth offering, and a brand new one appears the moment its metadata is
  // cached.
  async autocomplete(interaction) {
    const value = interaction.options.getFocused().toLowerCase();
    const [jobs, docs] = await Promise.all([
      jobsByCharacter(),
      culvertSchema.find({}, { "characters.name": 1 }).lean(),
    ]);

    const linked = docs.flatMap((doc) => (doc.characters ?? []).map((character) => normalizeName(character.name)));
    const classes = [...new Set(linked.map((name) => jobs.get(name)).filter(Boolean))]
      .filter((job) => job.toLowerCase().includes(value))
      .sort((a, b) => a.localeCompare(b))
      .slice(0, 25);

    await interaction.respond(classes.map((job) => ({ name: job, value: job }))).catch(() => {});
  },

  async execute(interaction) {
    const classOption = interaction.options.getString("class");
    await interaction.reply(textPanel("Loading rankings…"));

    const { lastReset, nextReset } = getResetDates();
    const thisWeek = lastReset;

    // One load of every character + the invoker's own names (for "you are here")
    const [allCharacters, mineDoc, jobs] = await Promise.all([
      getAllCharacters(),
      culvertSchema.findById(interaction.user.id, "characters").lean(),
      classOption ? jobsByCharacter() : Promise.resolve(new Map()),
    ]);
    const mineNames = new Set((mineDoc?.characters ?? []).map((c) => c.name.toLowerCase()));

    const everyone = allCharacters.map((c) => {
      const asc = [...c.scores].sort((a, b) => a.date.localeCompare(b.date));
      return {
        name: c.name,
        mine: mineNames.has(c.name.toLowerCase()),
        thisScore: asc.find((s) => s.date === thisWeek)?.score ?? 0,
        yearlyThis: asc.slice(-52).reduce((a, s) => a + s.score, 0),
      };
    });

    // The option is free text, so someone can type "adele" instead of picking "Adele" off the
    // dropdown. Resolved back to the spelling the game uses, from the same data the dropdown is built
    // from, so the header never echoes whatever case was typed.
    const className = classOption
      ? [...new Set(jobs.values())].find((job) => job.toLowerCase() === classOption.toLowerCase()) ?? classOption
      : null;

    // Filtering happens before ranking, so a class board reads 1..N within that class rather than
    // showing everyone's guild-wide position with the gaps left in.
    const chars = classOption
      ? everyone.filter((c) => jobs.get(normalizeName(c.name))?.toLowerCase() === classOption.toLowerCase())
      : everyone;

    if (classOption && !chars.length) {
      // Class comes from cached rankings data that fills in gradually, so "nobody" can also mean
      // "nobody looked up yet" — worth saying rather than showing an empty board.
      const known = everyone.filter((c) => jobs.has(normalizeName(c.name))).length;
      return interaction.editReply(
        textPanel(
          `No **${className}** characters are on the board.\n` +
            `-# Class is known for ${known}/${everyone.length} characters, so a very new one may not be recorded yet.`
        )
      );
    }

    // Ranked entries per metric are computed once, then cached for instant switching / paging
    const cache = new Map();
    const metricData = (metric) => {
      if (!cache.has(metric)) cache.set(metric, rankEntries(metric, chars));
      return cache.get(metric);
    };

    // A ranked character's page (podium ranks live on page 1). view() clamps to the real maxPage.
    const jumpPageFor = (metric) => {
      const mine = metricData(metric).find((e) => e.c.mine);
      if (!mine) return null;
      return mine.rank <= PODIUM ? 1 : Math.ceil((mine.rank - PODIUM) / PAGE_SIZE);
    };

    const state = { metric: "weekly", page: 1 };

    function view(disabled = false) {
      const entries = metricData(state.metric);
      const meta = METRICS[state.metric];
      const podium = entries.slice(0, PODIUM);
      const rest = entries.slice(PODIUM);
      const maxPage = Math.max(1, Math.ceil(rest.length / PAGE_SIZE));
      state.page = Math.min(Math.max(1, state.page), maxPage);
      const pageRows = rest.slice((state.page - 1) * PAGE_SIZE, state.page * PAGE_SIZE);
      const hasMine = entries.some((e) => e.c.mine);

      const podiumStr =
        podium
          .map((e, i) => `${MEDALS[i]} **${e.c.name}** — ${fmtScore(e)}${e.c.mine ? ` ${EMOJIS.STAR}` : ""}`)
          .join("\n") || "-# No scores submitted yet.";

      const listStr = pageRows.length
        ? pageRows
            .map((e) => `\`#${e.rank}\` ${e.c.name} — ${fmtScore(e)}${e.c.mine ? ` ${EMOJIS.STAR}` : ""}`)
            .join("\n")
        : podium.length
        ? "-# That's everyone!"
        : "-# —";

      const context = state.metric === "weekly" ? `Week of ${thisWeek}` : "Last 52 weeks";
      const footer = `Page ${state.page}/${maxPage} · Resets in ${updatesIn(nextReset)}`;

      const container = new ContainerBuilder()
        .setAccentColor(ACCENT)
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `## Culvert Rankings${className ? ` — ${className}` : ""}\n-# ${meta.label} · ${context}`
          )
        )
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(podiumStr))
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(listStr))
        .addSeparatorComponents(new SeparatorBuilder())
        .addActionRowComponents(
          new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
              .setCustomId("rank_metric")
              .setDisabled(disabled)
              .addOptions(Object.entries(METRICS).map(([value, m]) => ({ label: m.label, value, default: value === state.metric })))
          )
        )
        .addActionRowComponents(
          new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("rank_first").setEmoji(NAV.first).setStyle(ButtonStyle.Secondary).setDisabled(disabled || state.page === 1),
            new ButtonBuilder().setCustomId("rank_prev").setEmoji(NAV.prev).setStyle(ButtonStyle.Primary).setDisabled(disabled || state.page === 1),
            new ButtonBuilder().setCustomId("rank_next").setEmoji(NAV.next).setStyle(ButtonStyle.Primary).setDisabled(disabled || state.page === maxPage),
            new ButtonBuilder().setCustomId("rank_last").setEmoji(NAV.last).setStyle(ButtonStyle.Secondary).setDisabled(disabled || state.page === maxPage),
            new ButtonBuilder().setCustomId("rank_jump").setLabel("Jump to Me").setStyle(ButtonStyle.Success).setDisabled(disabled || !hasMine)
          )
        )
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${footer}`));

      return { components: [container], flags: MessageFlags.IsComponentsV2 };
    }

    const message = await interaction.editReply(view());
    const collector = message.createMessageComponentCollector({ idle: 120_000 });

    collector.on("collect", async (i) => {
      try {
        if (i.user.id !== interaction.user.id) {
          return i.reply({ content: "This isn't your rankings panel — run `/rankings` for your own.", flags: MessageFlags.Ephemeral }).catch(() => {});
        }

        // Ack first; a stale panel or gateway latency can expire the interaction (10062) — bail quietly
        try {
          await i.deferUpdate();
        } catch {
          return;
        }

        // view() clamps state.page to [1, maxPage], so nav can freely over/undershoot
        if (i.customId === "rank_metric") {
          state.metric = i.values[0];
          state.page = 1;
        } else if (i.customId === "rank_first") state.page = 1;
        else if (i.customId === "rank_prev") state.page -= 1;
        else if (i.customId === "rank_next") state.page += 1;
        else if (i.customId === "rank_last") state.page = Infinity;
        else if (i.customId === "rank_jump") state.page = jumpPageFor(state.metric) ?? state.page;

        await i.editReply(view());
      } catch (err) {
        console.error("Error - /rankings interaction failed:", err);
      }
    });

    collector.on("end", async () => {
      try {
        await interaction.editReply(view(true));
      } catch {
        // message may have been deleted
      }
    });
  },
};
