const {
  SlashCommandBuilder,
  ContainerBuilder,
  TextDisplayBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  SeparatorBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} = require("discord.js");
const weekSchema = require("../../schemas/weekSchema.js");
const { getResetDates } = require("../../domain/culvert/utils.js");
const {
  ACCENT,
  GRAPH_COLOR,
  computeStats,
  loadScoreIndex,
  weekTotal,
  buildLineChart,
  buildSpreadUrl,
  textPanel,
  promptWeekCount,
} = require("../../domain/culvert/chart.js");
const dayjs = require("dayjs");
const { ROLES, USERS } = require("../../config/ids.js");

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

const BEE_ROLE_ID = ROLES.BEE;
const OWNER_ID = USERS.OWNER;

// Renders a stat with a bracketed week-over-week delta, e.g. "1,234 (🔺 56)"
const UPTREND = "<:uptrend:1532546386497765416>";
const DOWNTREND = "<:downtrend:1532546371712848013>";

// Pagination chevrons (guild custom emojis), same pair /rankings and /wos use
const CHEVRON = {
  prev: "<:singleleftchevron:1375242927634120804>",
  next: "<:singlerightchevron:1375242928787689693>",
};

function statField(current, prev) {
  const value = current.toLocaleString();
  if (prev === null || prev === undefined) return value;
  const diff = current - prev;
  if (diff === 0) return `${value} (➖ 0)`;
  const arrow = diff > 0 ? UPTREND : DOWNTREND;
  return `${value} (${arrow} ${Math.abs(diff).toLocaleString()})`;
}

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //
// Interactive stats panel (Components V2)

// Every figure here comes from the week's finalized snapshot, so it stays fixed once the week is
// closed. Deltas are against the finalized week immediately before whichever one is on screen.
function buildStatsPanel({ week, stats, prev, submitted, total, index, count, disabled = false }) {
  const rows = [
    `**Submitted** ${submitted}${total ? ` / ${total}` : ""}`,
    `**Total Score** ${statField(stats.total, prev?.total)}`,
    `**Average** ${statField(stats.mean, prev?.mean)}`,
    `**Median (p50)** ${statField(stats.p50, prev?.p50)}`,
    `**25th Percentile** ${statField(stats.p25, prev?.p25)}`,
    `**75th Percentile** ${statField(stats.p75, prev?.p75)}`,
  ];

  const container = new ContainerBuilder()
    .setAccentColor(ACCENT)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## Guild Culvert Stats\n-# Week of ${week}`))
    .addSeparatorComponents(new SeparatorBuilder())
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(rows.join("\n")))
    .addSeparatorComponents(new SeparatorBuilder())
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# Week ${index + 1} of ${count}`))
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("weekly_stats_prev")
          .setEmoji(CHEVRON.prev)
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(disabled || index === 0),
        new ButtonBuilder()
          .setCustomId("weekly_stats_next")
          .setEmoji(CHEVRON.next)
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(disabled || index === count - 1),
        new ButtonBuilder()
          .setCustomId("weekly_stats_latest")
          .setLabel("Latest")
          .setStyle(ButtonStyle.Primary)
          .setDisabled(disabled || index === count - 1)
      )
    );

  return { components: [container], flags: MessageFlags.IsComponentsV2 };
}

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //
// Interactive graph panel (Components V2)

const METRICS = {
  total: { label: "Total Score", title: "Guild Culvert Total" },
  spread: { label: "Score Spread", title: "Guild Culvert Spread" },
};

// Renders the chosen metric over the last `weeks` finalized weeks to an image URL.
// weeksAsc (finalized week dates, oldest→newest) and scoreIndex are built once per panel
// session, so each render is pure in-memory work plus the chart request — no DB round-trip.
async function renderWeeklyGraph({ weeks, metric }, weeksAsc, scoreIndex) {
  const selected = weeksAsc.slice(-weeks);
  if (selected.length < 2) {
    return { error: "Not enough finalized weeks in this range to render a graph (at least 2 are required)." };
  }

  const labels = selected.map((w) => dayjs(w).format("MM/DD"));
  const scoresPerWeek = selected.map((w) => scoreIndex.get(w) ?? []);

  if (metric === "spread") {
    const per = scoresPerWeek.map((s) => computeStats(s));
    return {
      url: await buildSpreadUrl(
        labels,
        per.map((s) => (s ? s.p25 : 0)),
        per.map((s) => (s ? s.p50 : 0)),
        per.map((s) => (s ? s.p75 : 0))
      ),
    };
  }
  return {
    url: await buildLineChart(labels, [
      { label: "Total", data: scoresPerWeek.map((s) => weekTotal(s)), color: GRAPH_COLOR, fill: true },
    ]),
  };
}

// Builds the Components V2 message: the graph image and its controls inside one container.
function buildGraphPanel({ metric, weeks, weeksSet, imageUrl, disabled = false }) {
  const container = new ContainerBuilder()
    .setAccentColor(ACCENT)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${METRICS[metric].title}`))
    .addMediaGalleryComponents(new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(imageUrl)))
    .addSeparatorComponents(new SeparatorBuilder())
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        ...Object.entries(METRICS).map(([value, { label }]) =>
          new ButtonBuilder()
            .setCustomId(`weekly_metric_${value}`)
            .setLabel(label)
            .setStyle(value === metric ? ButtonStyle.Primary : ButtonStyle.Secondary)
            .setDisabled(disabled)
        ),
        new ButtonBuilder()
          .setCustomId("weekly_weeks")
          .setLabel(weeksSet ? `${weeks} weeks` : "# of Weeks")
          .setStyle(weeksSet ? ButtonStyle.Success : ButtonStyle.Secondary)
          .setDisabled(disabled)
      )
    );
  return { components: [container], flags: MessageFlags.IsComponentsV2 };
}

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

module.exports = {
  tier: "bee",
  culvert: true,
  data: new SlashCommandBuilder()
    .setName("weekly")
    .setDescription("[BEE] View weekly guild culvert stats and score graph")
    .addSubcommand((sub) =>
      sub
        .setName("stats")
        .setDescription("[BEE] View the latest finalized week's culvert statistics")
    )
    .addSubcommand((sub) =>
      sub
        .setName("graph")
        .setDescription("[BEE] Open the interactive guild culvert graph")
    ),

  // ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

  async execute(interaction) {
    // Restrict to bees and owner only
    const isBee =
      interaction.member.roles.cache.has(BEE_ROLE_ID) ||
      interaction.user.id === OWNER_ID;
    if (!isBee) {
      return interaction.reply({
        content: "Error - You do not have permission to use this command.",
        ephemeral: true,
      });
    }

    const sub = interaction.options.getSubcommand();
    const { lastReset } = getResetDates();

    // ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //
    // /weekly stats

    if (sub === "stats") {
      await interaction.deferReply();

      // The whole finalized list is fetched once so paging is in-memory. Opens on the newest week;
      // the chevrons walk back from there, so there is nothing to pass in.
      const records = await weekSchema
        .find({ finalized: true, week: { $lte: lastReset } }, { week: 1, total: 1 })
        .sort({ week: 1 })
        .lean();

      if (records.length === 0) {
        return interaction.editReply("Error - No finalized weeks found.");
      }

      let cursor = records.length - 1;

      const scoreIndex = await loadScoreIndex();

      // Reads the week at a list position, with its delta against the finalized week before it.
      const viewAt = (position) => {
        const record = records[position];
        const scores = scoreIndex.get(record.week) ?? [];
        const stats = computeStats(scores);
        if (!stats) return null;
        return {
          week: record.week,
          stats,
          prev: position > 0 ? computeStats(scoreIndex.get(records[position - 1].week) ?? []) : null,
          submitted: scores.length,
          total: record.total,
          index: position,
          count: records.length,
        };
      };

      const first = viewAt(cursor);
      if (!first) {
        return interaction.editReply(
          `Error - No submitted scores found for the week of **${records[cursor].week}**.`
        );
      }

      const message = await interaction.editReply(buildStatsPanel(first));
      const collector = message.createMessageComponentCollector({ idle: 300_000 });

      collector.on("collect", async (i) => {
        try {
          if (i.user.id !== interaction.user.id) {
            return i
              .reply({ content: "This isn't your stats panel — run `/weekly stats` for your own.", flags: MessageFlags.Ephemeral })
              .catch(() => {});
          }
          await i.deferUpdate();

          if (i.customId === "weekly_stats_prev") cursor = Math.max(0, cursor - 1);
          else if (i.customId === "weekly_stats_next") cursor = Math.min(records.length - 1, cursor + 1);
          else if (i.customId === "weekly_stats_latest") cursor = records.length - 1;

          const view = viewAt(cursor);
          if (!view) {
            return i.followUp({ content: `Error - No scores recorded for **${records[cursor].week}**.`, flags: MessageFlags.Ephemeral }).catch(() => {});
          }
          await i.editReply(buildStatsPanel(view));
        } catch (err) {
          console.error("Error - /weekly stats interaction failed:", err);
        }
      });

      collector.on("end", async () => {
        const view = viewAt(cursor);
        if (view) await interaction.editReply(buildStatsPanel({ ...view, disabled: true })).catch(() => {});
      });

      return;
    }

    // ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //
    // /weekly graph

    if (sub === "graph") {
      await interaction.reply(textPanel("Rendering graph…"));

      // Fetch the finalized week list + all scores once; every button press then works in-memory
      const weeksAsc = (
        await weekSchema
          .find({ finalized: true, week: { $lte: lastReset } }, { week: 1 })
          .sort({ week: 1 })
          .lean()
      ).map((r) => r.week);
      const maxWeeks = weeksAsc.length;

      if (maxWeeks < 2) {
        return interaction.editReply(
          textPanel("Error - Not enough finalized weeks to render a graph (at least 2 are required).")
        );
      }

      const scoreIndex = await loadScoreIndex();

      const state = { metric: "total", weeks: Math.min(8, maxWeeks), weeksSet: false };
      const first = await renderWeeklyGraph(state, weeksAsc, scoreIndex);
      if (first.error) return interaction.editReply(textPanel(`Error - ${first.error}`));

      let lastUrl = first.url;
      const message = await interaction.editReply(buildGraphPanel({ ...state, imageUrl: lastUrl }));

      const collector = message.createMessageComponentCollector({ idle: 300_000 });

      collector.on("collect", async (i) => {
        try {
          if (i.user.id !== interaction.user.id) {
            return i
              .reply({ content: "This isn't your graph panel — run `/weekly graph` for your own.", flags: MessageFlags.Ephemeral })
              .catch(() => {});
          }

          // Week-count modal — showModal must be the first response, so no deferUpdate here
          if (i.customId === "weekly_weeks") {
            const res = await promptWeekCount(i, {
              customId: "weekly_weeks_modal",
              max: maxWeeks,
              current: state.weeks,
            });
            if (!res) return;
            if (res.error) return res.submit.followUp({ content: res.error, flags: MessageFlags.Ephemeral }).catch(() => {});

            state.weeks = res.value;
            state.weeksSet = true;

            const rendered = await renderWeeklyGraph(state, weeksAsc, scoreIndex);
            if (rendered.error) return res.submit.followUp({ content: `Error - ${rendered.error}`, flags: MessageFlags.Ephemeral }).catch(() => {});
            lastUrl = rendered.url;
            return res.submit.editReply(buildGraphPanel({ ...state, imageUrl: lastUrl }));
          }

          await i.deferUpdate();
          if (i.customId.startsWith("weekly_metric_")) state.metric = i.customId.slice("weekly_metric_".length);

          const rendered = await renderWeeklyGraph(state, weeksAsc, scoreIndex);
          if (rendered.error) {
            return i.followUp({ content: `Error - ${rendered.error}`, flags: MessageFlags.Ephemeral }).catch(() => {});
          }
          lastUrl = rendered.url;
          await i.editReply(buildGraphPanel({ ...state, imageUrl: lastUrl }));
        } catch (err) {
          console.error("Error - /weekly graph interaction failed:", err);
        }
      });

      collector.on("end", async () => {
        try {
          await interaction.editReply(buildGraphPanel({ ...state, imageUrl: lastUrl, disabled: true }));
        } catch {
          // message may have been deleted
        }
      });

      return;
    }
  },
};
