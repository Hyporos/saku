const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const weekSchema = require("../../schemas/weekSchema.js");
const culvertSchema = require("../../schemas/culvertSchema.js");
const { getResetDates } = require("../../utility/culvertUtils.js");
const dayjs = require("dayjs");

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

const BEE_ROLE_ID = "720001044746076181";
const OWNER_ID = "631337640754675725";
const GRAPH_COLOR = "255,189,213";
const GRAPH_TEMPLATE = "https://quickchart.io/chart/render/zm-c2f6cd67-0740-44d6-a023-649110e22db9";

// Returns the Nth percentile of a pre-sorted ascending array
function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return Math.round(sorted[lo] + (idx - lo) * (sorted[hi] - sorted[lo]));
}

// Compute stats from a scores array [{name, score}], excluding 0-scores
function computeStats(scores) {
  const values = (scores ?? [])
    .map((s) => s.score)
    .filter((s) => s > 0)
    .sort((a, b) => a - b);
  if (values.length === 0) return null;
  const total = values.reduce((a, b) => a + b, 0);
  return {
    total,
    count: values.length,
    mean: Math.round(total / values.length),
    p25: percentile(values, 25),
    p50: percentile(values, 50),
    p75: percentile(values, 75),
  };
}

// Extract live scores for a specific week date from culvertSchema data
function getWeekScores(culvertData, dateStr) {
  return culvertData.flatMap((user) =>
    (user.characters ?? []).flatMap((char) => {
      const entry = (char.scores ?? []).find((s) => s.date === dateStr);
      return entry !== undefined ? [{ name: char.name, score: entry.score }] : [];
    })
  );
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
        .setDescription("View the guild's weekly total score progression graph")
        .addStringOption((opt) =>
          opt
            .setName("date")
            .setDescription("The end week (YYYY-MM-DD, Wednesday). Defaults to last week.")
        )
        .addIntegerOption((opt) =>
          opt
            .setName("number_of_weeks")
            .setDescription("The number of weeks to display (default: 8)")
        )
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

        const culvertData = await culvertSchema.find({}, { "characters.name": 1, "characters.scores": 1 }).lean();

        const statsPerWeek = weekRecords
          .map((r) => computeStats(getWeekScores(culvertData, r.week)))
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

      const culvertData = await culvertSchema.find({}, { "characters.name": 1, "characters.scores": 1 }).lean();
      const weekScores = getWeekScores(culvertData, targetDate);

      const stats = computeStats(weekScores);
      if (!stats) {
        return interaction.editReply(
          `Error - No submitted scores found for the week of **${targetDate}**.`
        );
      }

      const submittedCount = weekScores.length;

      const embed = new EmbedBuilder()
        .setColor(0xffc3c5)
        .setTitle(`Week of ${targetDate}`)
        .setDescription(`⠀`)
        .addFields(
          { name: "Total Score", value: stats.total.toLocaleString(), inline: true },
          { name: "Submitted", value: `${submittedCount}${weekRecord.total ? ` / ${weekRecord.total}` : ""}`, inline: true },
          { name: "​", value: "​", inline: true },
          { name: "Average", value: stats.mean.toLocaleString(), inline: true },
          { name: "Median (p50)", value: stats.p50.toLocaleString(), inline: true },
          { name: "​", value: "​", inline: true },
          { name: "25th Percentile", value: stats.p25.toLocaleString(), inline: true },
          { name: "75th Percentile", value: stats.p75.toLocaleString(), inline: true },
          { name: "​", value: "​", inline: true }
        );

      return interaction.editReply({ embeds: [embed] });
    }

    // ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //
    // /weekly graph

    if (sub === "graph") {
      const dateOption = interaction.options.getString("date");
      const weeksOption = interaction.options.getInteger("number_of_weeks") ?? 8;

      const validated = validateDate(dateOption);
      if (!validated.valid) return interaction.reply(validated.error);
      const targetDate = validated.date;

      if (weeksOption <= 1) {
        return interaction.reply(
          "Error - The number of weeks to display must be greater than 1."
        );
      }
      if (weeksOption > 1000) {
        return interaction.reply(
          "Error - The number of weeks to display must be less than 1,000."
        );
      }

      await interaction.deferReply();

      const weekRecords = await weekSchema
        .find({ week: { $lte: targetDate }, finalized: true }, { week: 1 })
        .sort({ week: -1 })
        .limit(weeksOption)
        .lean();

      if (weekRecords.length < 2) {
        return interaction.editReply(
          "Error - Not enough finalized weeks found to render a graph. At least 2 are required."
        );
      }

      const culvertData = await culvertSchema.find({}, { "characters.scores": 1 }).lean();

      const xLabels = weekRecords.map((r) => dayjs(r.week).format("MM/DD")).join(",");
      const yLabels = weekRecords
        .map((r) => {
          const scores = getWeekScores(culvertData, r.week);
          return scores.filter((s) => s.score > 0).reduce((sum, s) => sum + s.score, 0);
        })
        .join(",");

      const url = `${GRAPH_TEMPLATE}?labels=${xLabels}&data1=${yLabels}&borderColor1=rgba(${GRAPH_COLOR},0.6)&backgroundColor1=rgba(${GRAPH_COLOR},0.4)`;

      const embed = new EmbedBuilder()
        .setColor(0x202222)
        .setAuthor({ name: "Weekly Guild Graph" })
        .setImage(url)
        .setTitle("Guild Culvert Total")
        .setFooter({ text: `Rendering the last ${weekRecords.length} weeks` });

      return interaction.editReply({ embeds: [embed] });
    }
  },
};
