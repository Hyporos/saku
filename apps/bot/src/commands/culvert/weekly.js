const {
  SlashCommandBuilder,
  EmbedBuilder,
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
const { getResetDates } = require("../../utility/culvertUtils.js");
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
} = require("../../utility/culvertChart.js");
const dayjs = require("dayjs");

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

const BEE_ROLE_ID = "720001044746076181";
const OWNER_ID = "631337640754675725";

// Renders a stat with a bracketed week-over-week delta, e.g. "1,234 (🔺 56)"
function statField(current, prev) {
  const value = current.toLocaleString();
  if (prev === null || prev === undefined) return value;
  const diff = current - prev;
  if (diff === 0) return `${value} (➖ 0)`;
  const arrow = diff > 0 ? "🔺" : "🔻";
  return `${value} (${arrow} ${Math.abs(diff).toLocaleString()})`;
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
  data: new SlashCommandBuilder()
    .setName("weekly")
    .setDescription("View weekly guild culvert stats and score graph")
    .addSubcommand((sub) =>
      sub
        .setName("stats")
        .setDescription("View culvert statistics for a given week")
        .addStringOption((opt) =>
          opt
            .setName("date")
            .setDescription("The week to view (YYYY-MM-DD, Wednesday). Defaults to last week.")
        )
        .addIntegerOption((opt) =>
          opt
            .setName("weeks")
            .setDescription("Average stats over the last N finalized weeks instead of a single week")
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("graph")
        .setDescription("Open the interactive guild culvert graph")
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

    // Validate and normalise the date option — defaults to last week if omitted
    function validateDate(dateOption) {
      if (!dateOption) return { valid: true, date: lastReset };
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOption)) {
        return {
          valid: false,
          error: `Error - The date **${dateOption}** is not valid. Make sure it follows the 'YYYY-MM-DD' format.`,
        };
      }
      if (dayjs(dateOption).day() !== 3) {
        return {
          valid: false,
          error: `Error - The date **${dateOption}** is not valid. Make sure the day lands on a Wednesday.`,
        };
      }
      return { valid: true, date: dateOption };
    }

    // ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //
    // /weekly stats

    if (sub === "stats") {
      const dateOption = interaction.options.getString("date");
      const weeksOption = interaction.options.getInteger("weeks");

      const validated = validateDate(dateOption);
      if (!validated.valid) return interaction.reply(validated.error);
      const targetDate = validated.date;

      await interaction.deferReply();

      // Average-over-N-weeks mode
      if (weeksOption !== null) {
        if (weeksOption < 1 || weeksOption > 100) {
          return interaction.editReply(
            "Error - The `weeks` value must be between 1 and 100."
          );
        }

        const weekRecords = await weekSchema
          .find({ week: { $lte: targetDate }, finalized: true }, { week: 1 })
          .sort({ week: -1 })
          .limit(weeksOption)
          .lean();

        if (weekRecords.length === 0) {
          return interaction.editReply(
            `Error - No finalized weeks found on or before **${targetDate}**.`
          );
        }

        const scoreIndex = await loadScoreIndex();

        const statsPerWeek = weekRecords
          .map((r) => computeStats(scoreIndex.get(r.week) ?? []))
          .filter(Boolean);

        if (statsPerWeek.length === 0) {
          return interaction.editReply(
            "Error - No submitted scores found across the selected weeks."
          );
        }

        const avg = (arr) =>
          Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);

        const newestWeek = weekRecords[0].week;
        const oldestWeek = weekRecords[weekRecords.length - 1].week;

        const embed = new EmbedBuilder()
          .setColor(0xffc3c5)
          .setTitle(`${oldestWeek}  →  ${newestWeek}`)
          .setDescription(
            `Averaged over **${statsPerWeek.length}** finalized week${statsPerWeek.length !== 1 ? "s" : ""}\n⠀`
          )
          .addFields(
            { name: "Total Score", value: avg(statsPerWeek.map((s) => s.total)).toLocaleString(), inline: true },
            { name: "​", value: "​", inline: true },
            { name: "​", value: "​", inline: true },
            { name: "Average", value: avg(statsPerWeek.map((s) => s.mean)).toLocaleString(), inline: true },
            { name: "Median (p50)", value: avg(statsPerWeek.map((s) => s.p50)).toLocaleString(), inline: true },
            { name: "​", value: "​", inline: true },
            { name: "25th Percentile", value: avg(statsPerWeek.map((s) => s.p25)).toLocaleString(), inline: true },
            { name: "75th Percentile", value: avg(statsPerWeek.map((s) => s.p75)).toLocaleString(), inline: true },
            { name: "​", value: "​", inline: true }
          );

        return interaction.editReply({ embeds: [embed] });
      }

      // Single-week mode
      const weekRecord = await weekSchema
        .findOne({ week: targetDate, finalized: true }, { week: 1, total: 1 })
        .lean();

      if (!weekRecord) {
        return interaction.editReply(
          `Error - No finalized week record found for **${targetDate}**.`
        );
      }

      const scoreIndex = await loadScoreIndex();
      const weekScores = scoreIndex.get(targetDate) ?? [];

      const stats = computeStats(weekScores);
      if (!stats) {
        return interaction.editReply(
          `Error - No submitted scores found for the week of **${targetDate}**.`
        );
      }

      const submittedCount = weekScores.length;

      // Compare against the previous finalized week for week-over-week deltas
      const prevWeekRecord = await weekSchema
        .findOne({ week: { $lt: targetDate }, finalized: true }, { week: 1 })
        .sort({ week: -1 })
        .lean();
      const prev = prevWeekRecord ? computeStats(scoreIndex.get(prevWeekRecord.week) ?? []) : null;

      const embed = new EmbedBuilder()
        .setColor(0xffc3c5)
        .setAuthor({ name: `Week of ${targetDate}` })
        .setTitle("Guild Culvert Stats")
        .setDescription("⠀")
        .addFields(
          { name: "Total Score", value: statField(stats.total, prev?.total), inline: true },
          { name: "Submitted", value: `${submittedCount}${weekRecord.total ? ` / ${weekRecord.total}` : ""}`, inline: true },
          { name: "​", value: "​", inline: true },
          { name: "Average", value: statField(stats.mean, prev?.mean), inline: true },
          { name: "Median (p50)", value: statField(stats.p50, prev?.p50), inline: true },
          { name: "​", value: "​", inline: true },
          { name: "25th Percentile", value: statField(stats.p25, prev?.p25), inline: true },
          { name: "75th Percentile", value: statField(stats.p75, prev?.p75), inline: true },
          { name: "​", value: "​", inline: true }
        );

      return interaction.editReply({ embeds: [embed] });
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
