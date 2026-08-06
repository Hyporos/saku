const axios = require("axios");
const {
  ContainerBuilder,
  TextDisplayBuilder,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} = require("discord.js");
const culvertSchema = require("../../schemas/culvertSchema.js");
const weekSchema = require("../../schemas/weekSchema.js");

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //
// Shared culvert chart + stats helpers, used by /weekly and the character graph.

const GRAPH_COLOR = "255,189,213"; // primary pink (R,G,B)
const ACCENT = 0xffc3c5; // Components V2 container accent
const CHART_BG = "202222"; // graph background (hex, no #)
const GRAPH_RGBA = (a) => `rgba(${GRAPH_COLOR},${a})`;
const GRID = "rgba(255,255,255,0.06)";
const AXIS_TEXT = "rgba(255,255,255,0.5)";

// ⎯⎯ Stats ⎯⎯ //

// Nth percentile of a pre-sorted ascending array
function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return Math.round(sorted[lo] + (idx - lo) * (sorted[hi] - sorted[lo]));
}

// Stats from a list of raw scores, excluding 0-scores. Returns null if none submitted.
function computeStats(scores) {
  const values = (scores ?? []).filter((s) => s > 0).sort((a, b) => a - b);
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

// Indexes every character score by week date: Map<"YYYY-MM-DD", number[]>. Built once
// so each week lookup is O(1) instead of re-scanning all characters.
function buildScoreIndex(culvertData) {
  const index = new Map();
  for (const user of culvertData) {
    for (const char of user.characters ?? []) {
      for (const s of char.scores ?? []) {
        const bucket = index.get(s.date);
        if (bucket) bucket.push(s.score);
        else index.set(s.date, [s.score]);
      }
    }
  }
  return index;
}

// Loads every week's scores, indexed by week date.
//
// A finalized week is read from its weekSchema snapshot rather than from the live characters,
// because the snapshot is the only record of what the guild actually scored that week. Character
// scores are deleted along with the character when someone leaves and is unlinked, so building
// history out of them made past weeks shrink retroactively: every week's total drifted down as
// members left, and the median drifted up, since leavers sit mostly in the lower half of the board.
// The week in progress has no snapshot yet, so it still comes from the live data underneath.
async function loadScoreIndex() {
  const [culvertData, weeks] = await Promise.all([
    culvertSchema.find({}, { "characters.scores": 1 }).lean(),
    weekSchema.find({ finalized: true }, { week: 1, scores: 1 }).lean(),
  ]);

  const index = buildScoreIndex(culvertData);
  for (const week of weeks) {
    if (week.scores?.length) index.set(week.week, week.scores.map((s) => s.score));
  }
  return index;
}

// The weeks that have an immutable snapshot behind them. Guild-wide overlays are only meaningful
// for these: outside them the numbers come from live characters, so an old week reflects whoever
// happens to still be linked today rather than who was actually in the guild that week.
async function loadFinalizedWeeks() {
  const weeks = await weekSchema.find({ finalized: true }, { week: 1 }).lean();
  return new Set(weeks.map((w) => w.week));
}

// Total of a week's non-zero scores
function weekTotal(scores) {
  const stats = computeStats(scores);
  return stats ? stats.total : 0;
}

// ⎯⎯ Charts (QuickChart / Chart.js v2 configs) ⎯⎯ //

// Shared dark-theme axis styling; yTicks adds/overrides y-axis ticks (bounds, reverse, …)
function chartScales(yTicks = {}) {
  return {
    xAxes: [{ gridLines: { color: GRID }, ticks: { fontColor: AXIS_TEXT } }],
    yAxes: [{ gridLines: { color: GRID }, ticks: { fontColor: AXIS_TEXT, ...yTicks } }],
  };
}

// Renders a QuickChart config to an image URL. Uses the inline URL directly when short
// enough (avoids a round-trip), only falling back to the short-URL API when the inline
// config would exceed Discord's 2048-char image URL limit.
async function createChartUrl(config, rawFns = {}) {
  // QuickChart evaluates JS functions in the config, but JSON.stringify drops them — so
  // callers pass function bodies as strings under a token, spliced in here unquoted.
  let body = JSON.stringify(config);
  for (const [token, code] of Object.entries(rawFns)) {
    body = body.replace(`"${token}"`, code);
  }
  const inline = `https://quickchart.io/chart?w=600&h=350&bkg=%23${CHART_BG}&c=${encodeURIComponent(body)}`;
  if (inline.length <= 1900) return inline;
  try {
    const { data } = await axios.post("https://quickchart.io/chart/create", {
      width: 600,
      height: 350,
      backgroundColor: `#${CHART_BG}`,
      chart: body,
    });
    if (data?.success && data.url) return data.url;
  } catch {
    // fall through to the inline URL
  }
  return inline;
}

// One or more line series with the y-axis auto-fit to the data (never zero-anchored,
// so tightly-clustered values fill the frame). Each series:
//   { label, data:number[], color:"r,g,b", fill?, dashed?, dim?, points? }
// null data points are skipped (gaps). opts.yTicks overrides y-axis ticks (e.g. reverse).
function buildLineChart(labels, series, { legend = false, yTicks = {}, datalabels = null } = {}) {
  const nums = series.flatMap((s) => s.data).filter((v) => typeof v === "number" && !Number.isNaN(v));
  const lo = nums.length ? Math.min(...nums) : 0;
  const hi = nums.length ? Math.max(...nums) : 0;
  const pad = hi > lo ? Math.round((hi - lo) * 0.2) : Math.max(1, Math.round(hi * 0.1));

  const datasets = series.map((s) => ({
    label: s.label,
    data: s.data,
    borderColor: `rgba(${s.color},${s.dim ? 0.5 : 0.9})`,
    backgroundColor: `rgba(${s.color},0.2)`,
    borderWidth: s.dim ? 1.5 : 2,
    pointRadius: s.points === false ? 0 : 2,
    pointBackgroundColor: `rgba(${s.color},1)`,
    fill: s.fill ?? false, // true | "start" | "end" | dataset index
    lineTension: 0.3,
    borderDash: s.dashed ? [6, 4] : undefined,
    naFlags: s.naFlags, // custom, readable by a datalabels formatter
  }));

  const options = {
    legend: legend ? { labels: { fontColor: "rgba(255,255,255,0.6)" } } : { display: false },
    scales: chartScales({
      maxTicksLimit: 8,
      suggestedMin: lo >= 0 ? Math.max(0, lo - pad) : lo - pad,
      suggestedMax: hi + pad,
      ...yTicks,
    }),
  };

  // Per-point value labels (e.g. rank numbers). A string `formatter` is spliced in as a
  // real JS function via QuickChart. Only added when requested, so other charts are
  // unaffected; extra padding keeps edge labels from clipping.
  const rawFns = {};
  let dl = datalabels;
  if (dl) {
    if (typeof dl.formatter === "string") {
      rawFns.__DL_FMT__ = dl.formatter;
      dl = { ...dl, formatter: "__DL_FMT__" };
    }
    options.plugins = { datalabels: dl };
    options.layout = { padding: { top: 22, right: 12, left: 4 } };
  }

  return createChartUrl({ type: "line", data: { labels, datasets }, options }, rawFns);
}

// p25–p75 spread band: a median line with a shaded ribbon between the 25th and 75th
// percentiles, showing how tightly the guild is clustered each week.
function buildSpreadUrl(labels, p25, p50, p75) {
  return createChartUrl({
    type: "line",
    data: {
      labels,
      datasets: [
        { label: "25th %ile", data: p25, borderColor: GRAPH_RGBA(0.35), backgroundColor: GRAPH_RGBA(0.18), borderWidth: 1, pointRadius: 0, fill: false },
        { label: "75th %ile", data: p75, borderColor: GRAPH_RGBA(0.35), backgroundColor: GRAPH_RGBA(0.18), borderWidth: 1, pointRadius: 0, fill: "-1" },
        { label: "Median", data: p50, borderColor: GRAPH_RGBA(0.9), borderWidth: 2, pointRadius: 0, fill: false },
      ],
    },
    options: {
      legend: { labels: { fontColor: "rgba(255,255,255,0.6)" } },
      scales: chartScales(),
    },
  });
}

// ⎯⎯ Components V2 helpers ⎯⎯ //

// A minimal Components V2 message carrying a single line of text (loading / error states).
function textPanel(text, accent = ACCENT) {
  return {
    components: [
      new ContainerBuilder().setAccentColor(accent).addTextDisplayComponents(new TextDisplayBuilder().setContent(text)),
    ],
    flags: MessageFlags.IsComponentsV2,
  };
}

// "R,G,B" → 0xRRGGBB for a container accent bar. Null on malformed input.
function rgbToInt(rgb) {
  const parts = (rgb || "").split(",").map((n) => parseInt(n, 10));
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return null;
  return (parts[0] << 16) | (parts[1] << 8) | parts[2];
}

// Shows a "number of weeks" modal on the button interaction `i`, waits for submit,
// acknowledges it, and validates the value. Returns one of:
//   { submit, value }  — valid number chosen (submit already deferred)
//   { submit, error }  — invalid input; caller surfaces `error`
//   null               — timed out or the interaction expired
async function promptWeekCount(i, { customId, max, current, min = 2 }) {
  const modal = new ModalBuilder()
    .setCustomId(customId)
    .setTitle("Set Week Count")
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("value")
          .setLabel(`Number of weeks (${min}-${max})`)
          .setStyle(TextInputStyle.Short)
          .setValue(String(current))
          .setRequired(true)
      )
    );
  await i.showModal(modal);

  let submit;
  try {
    submit = await i.awaitModalSubmit({
      time: 120_000,
      filter: (m) => m.customId === customId && m.user.id === i.user.id,
    });
  } catch {
    return null; // modal timed out
  }

  // A modal submit must be answered within ~3s, before any work
  try {
    await submit.deferUpdate();
  } catch {
    return null; // interaction expired in transit (gateway latency); user can retry
  }

  const n = parseInt(submit.fields.getTextInputValue("value").trim(), 10);
  if (!Number.isInteger(n) || n < min || n > max) {
    return { submit, error: `Error - weeks must be a whole number between ${min} and ${max}.` };
  }
  return { submit, value: n };
}

module.exports = {
  GRAPH_COLOR,
  ACCENT,
  percentile,
  computeStats,
  buildScoreIndex,
  loadScoreIndex,
  loadFinalizedWeeks,
  weekTotal,
  chartScales,
  createChartUrl,
  buildLineChart,
  buildSpreadUrl,
  textPanel,
  rgbToInt,
  promptWeekCount,
};
