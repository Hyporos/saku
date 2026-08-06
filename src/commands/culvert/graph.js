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
  StringSelectMenuBuilder,
  MessageFlags,
} = require("discord.js");
const culvertSchema = require("../../schemas/culvertSchema.js");
const {
  ACCENT,
  GRAPH_COLOR,
  computeStats,
  loadScoreIndex,
  loadFinalizedWeeks,
  buildLineChart,
  textPanel,
  rgbToInt,
  promptWeekCount,
} = require("../../domain/culvert/chart.js");
const dayjs = require("dayjs");

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //
// Interactive per-character culvert progression graph (Components V2).

const GUILD_LINE = "255,255,255"; // neutral white for the guild-median line
const FOOTER = "-# Change your graph color with `/graphcolor`";
const RANK_LABEL_MAX = 16; // beyond this many weeks the per-point rank labels overlap, so hide them

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// datalabels formatter (spliced into the chart as a real function by QuickChart): shows
// "N/A" for weeks the character didn't submit, otherwise the rank number.
const RANK_NA_FORMATTER =
  "function(value, context){return (context.dataset.naFlags && context.dataset.naFlags[context.dataIndex]) ? 'N/A' : value;}";

const VIEWS = { score: "Score", scoremedian: "Score + Median", rank: "Rank" };

// The character's most recent `weeks` score entries (oldest→newest), optionally dropping
// missed (0) weeks.
// `usable` narrows the pool BEFORE the slice, so a view that can't draw certain weeks still gets the
// full count asked for. Filtering after the slice would silently shorten the chart: the last 8 weeks
// minus the two most recent unfinalized ones is 6 points, where stepping two further back gives 8.
function selectCharWeeks(char, weeks, omit, usable = null) {
  const sorted = [...(char.scores ?? [])].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  let filtered = omit ? sorted.filter((s) => s.score > 0) : sorted;
  if (usable) filtered = filtered.filter(usable);
  return filtered.slice(-weeks);
}

// How far back a view can actually reach for this character. Rank needs a finalized snapshot to place
// someone against the guild, and the median needs one to have a guild to take a median of, so both
// stop at the oldest week that has guild data behind it. The plain score view is the character's own
// history and has no such limit, so it returns null.
async function viewCap(state, char, getScoreIndex) {
  if (state.view === "score") return null;
  const { finalized } = await getScoreIndex();
  const sorted = [...(char.scores ?? [])].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const filtered = state.omit ? sorted.filter((s) => s.score > 0) : sorted;
  return filtered.filter((s) => finalized.has(s.date)).length;
}

// Rank and Median can't reach further back than the guild has data, so the week count follows the
// view instead of silently claiming a range it isn't drawing: switching into a limited view drops the
// number to that view's reach, and switching back to Score restores the larger number the person
// picked. `uncapped` holds that original choice, so bouncing between the two limited views never
// loses it, and a view whose cap is looser than the last one gets as much of it back as it can take.
// Pure so the state machine can be tested without driving Discord components.
function applyCap(state, cap) {
  const wanted = state.uncapped ?? { weeks: state.weeks, weeksSet: state.weeksSet };

  if (cap != null && cap >= 2 && wanted.weeks > cap) {
    state.uncapped ??= wanted;
    state.weeks = cap;
    state.weeksSet = true; // show the clamped number, otherwise the change is invisible
    return state;
  }
  if (state.uncapped) {
    state.weeks = state.uncapped.weeks;
    state.weeksSet = state.uncapped.weeksSet;
    state.uncapped = null;
  }
  return state;
}

// getScoreIndex lazily loads the guild score index (only the Median/Rank views need it).
async function renderCharGraph(state, char, getScoreIndex) {
  const selected = selectCharWeeks(char, state.weeks, state.omit);
  if (selected.length < 2) {
    return { error: `**${char.name}** needs at least 2 scores${state.omit ? " (with missed weeks hidden)" : ""} to graph.` };
  }

  const labels = selected.map((s) => dayjs(s.date).format("MM/DD"));
  const color = char.graphColor || GRAPH_COLOR;

  // Placement among all non-zero submitted scores that week (1 = top). Axis reversed so the
  // best rank sits at the top; unsubmitted weeks drop to the bottom labelled "N/A".
  if (state.view === "rank") {
    const { index: scoreIndex, finalized } = await getScoreIndex();
    // A rank is a placement against the whole guild, so it only means anything for a week that has
    // a finalized snapshot. Weeks without one are dropped from this view rather than padded with
    // N/A: a partial week would rank someone against the handful who have logged so far, and a week
    // from before finalization existed would rank them against whoever is still linked today.
    const ranked = selectCharWeeks(char, state.weeks, state.omit, (s) => finalized.has(s.date));
    if (ranked.length < 2) {
      return { error: `**${char.name}** needs at least 2 scores in finalized weeks to show rank.` };
    }

    const rankLabels = ranked.map((s) => dayjs(s.date).format("MM/DD"));
    const perWeek = ranked.map((s) => {
      if (s.score <= 0) return null;
      const guild = (scoreIndex.get(s.date) ?? []).filter((x) => x > 0).sort((a, b) => b - a);
      return guild.indexOf(s.score) + 1 || null;
    });
    const ranks = perWeek.filter((r) => r != null);
    const bottom = ranks.length ? Math.max(...ranks) : 1;
    const data = perWeek.map((r) => (r == null ? bottom : r));
    const naFlags = perWeek.map((r) => r == null);
    return {
      url: await buildLineChart(rankLabels, [{ label: "Rank", data, color, fill: "start", naFlags }], {
        yTicks: { reverse: true, precision: 0 },
        datalabels:
          ranked.length <= RANK_LABEL_MAX
            ? { display: true, align: "top", anchor: "end", color: "rgba(255,255,255,0.9)", font: { size: 12, weight: "bold" }, formatter: RANK_NA_FORMATTER }
            : null,
      }),
    };
  }

  const series = [{ label: char.name, data: selected.map((s) => s.score), color, fill: true }];

  // Score + the guild median overlaid as a faint dashed line
  if (state.view === "scoremedian") {
    const { index: scoreIndex, finalized } = await getScoreIndex();
    // Only finalized weeks, exactly like rank. A median is a statement about the whole guild, so a
    // week that hasn't finalized would take it from the handful who happen to have logged so far,
    // and a week from before finalization existed would take it from whoever is still linked today.
    // Both are misleading, so those weeks are dropped rather than drawn, and the view simply starts
    // where the guild data starts.
    const usable = selectCharWeeks(char, state.weeks, state.omit, (s) => finalized.has(s.date));
    if (usable.length < 2) {
      return { error: `**${char.name}** needs at least 2 scores in weeks with guild data to show the median.` };
    }
    const medianLabels = usable.map((s) => dayjs(s.date).format("MM/DD"));
    const medianSeries = [
      { label: char.name, data: usable.map((s) => s.score), color, fill: true },
      {
        label: "Guild median",
        data: usable.map((s) => {
          const g = computeStats(scoreIndex.get(s.date) ?? []);
          return g ? g.p50 : null;
        }),
        color: GUILD_LINE,
        dashed: true,
        dim: true,
        points: false,
      },
    ];
    return { url: await buildLineChart(medianLabels, medianSeries, { legend: true }) };
  }

  // Raw score
  return { url: await buildLineChart(labels, series) };
}

// ⎯⎯ Panel ⎯⎯ //

function buildCharPanel(state, characters, { imageUrl, note, disabled = false }) {
  const char = characters[state.charIndex];

  const container = new ContainerBuilder()
    .setAccentColor(rgbToInt(char.graphColor) ?? ACCENT)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${char.name}'s Culvert Graph`));

  if (imageUrl) {
    container.addMediaGalleryComponents(new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(imageUrl)));
  } else {
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(note ?? "No data."));
  }

  container.addSeparatorComponents(new SeparatorBuilder());

  // Character switcher (only when the roster has more than one)
  if (characters.length > 1) {
    container.addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId("graph_char")
          .setDisabled(disabled)
          .addOptions(characters.map((c, idx) => ({ label: c.name, value: String(idx), default: idx === state.charIndex })))
      )
    );
  }

  // View toggle
  container.addActionRowComponents(
    new ActionRowBuilder().addComponents(
      ...Object.entries(VIEWS).map(([value, label]) =>
        new ButtonBuilder()
          .setCustomId(`graph_view_${value}`)
          .setLabel(label)
          .setStyle(value === state.view ? ButtonStyle.Primary : ButtonStyle.Secondary)
          .setDisabled(disabled)
      )
    )
  );

  // Context controls
  container.addActionRowComponents(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("graph_weeks")
        .setLabel(state.weeksSet ? `${state.weeks} weeks` : "# of Weeks")
        .setStyle(state.weeksSet ? ButtonStyle.Success : ButtonStyle.Secondary)
        .setDisabled(disabled),
      new ButtonBuilder()
        .setCustomId("graph_omit")
        .setLabel("Hide Missed Weeks")
        .setStyle(state.omit ? ButtonStyle.Success : ButtonStyle.Secondary)
        .setDisabled(disabled)
    )
  );

  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(FOOTER));

  return { components: [container], flags: MessageFlags.IsComponentsV2 };
}

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

module.exports = {
  culvert: true,
  // exported for tests/graphWeeks.js
  applyCap,
  viewCap,
  data: new SlashCommandBuilder()
    .setName("graph")
    .setDescription("View the interactive progression graph of a character")
    .addStringOption((opt) =>
      opt
        .setName("character")
        .setDescription("The character to graph (defaults to your own)")
        .setAutocomplete(true)
    ),

  async autocomplete(interaction) {
    const value = interaction.options.getFocused().toLowerCase();
    const docs = await culvertSchema.find({}, { "characters.name": 1 }).lean();
    const names = docs.flatMap((d) => (d.characters ?? []).map((c) => c.name));
    const filtered = names
      .filter((n) => n.toLowerCase().includes(value))
      .sort((a, b) => a.localeCompare(b))
      .slice(0, 25);
    try {
      await interaction.respond(filtered.map((n) => ({ name: n, value: n })));
    } catch (e) {
      if (e.code !== 10062) throw e;
    }
  },

  async execute(interaction) {
    const charOption = interaction.options.getString("character");

    // With a character given, graph that character (anyone's) and its owner's roster in the
    // switcher; otherwise default to the invoker's own characters.
    let characters;
    let startIndex = 0;
    if (charOption) {
      const doc = await culvertSchema
        .findOne({ "characters.name": { $regex: `^${escapeRegex(charOption)}$`, $options: "i" } }, { characters: 1 })
        .lean();
      if (!doc) {
        return interaction.reply({ content: `Error - No character named **${charOption}** was found.`, ephemeral: true });
      }
      characters = doc.characters;
      startIndex = Math.max(0, characters.findIndex((c) => c.name.toLowerCase() === charOption.toLowerCase()));
    } else {
      const doc = await culvertSchema.findById(interaction.user.id, "characters").lean();
      if (!doc || !doc.characters || doc.characters.length === 0) {
        return interaction.reply({ content: "Error - You have no characters linked yet.", ephemeral: true });
      }
      characters = doc.characters;
    }

    const startChar = characters[startIndex];
    if ((startChar.scores?.length ?? 0) < 2) {
      return interaction.reply({ content: `Error - **${startChar.name}** needs at least 2 scores to graph.`, ephemeral: true });
    }

    await interaction.reply(textPanel("Rendering graph…"));

    // Guild scores are only needed by the Median/Rank views — load once, on first use.
    let scoreCache = null;
    const getScoreIndex = async () => {
      if (!scoreCache) {
        const [index, finalized] = await Promise.all([loadScoreIndex(), loadFinalizedWeeks()]);
        scoreCache = { index, finalized };
      }
      return scoreCache;
    };

    const state = { charIndex: startIndex, weeks: 8, weeksSet: false, omit: false, view: "score", uncapped: null };
    const render = () => renderCharGraph(state, characters[state.charIndex], getScoreIndex);

    // Rank and Median can't reach further back than the guild has data, so the week count follows the
    // view instead of silently lying: switching into one of them drops the number to that view's
    // limit, and switching back to Score puts the larger number the person picked back. `uncapped`
    // holds that original choice, so bouncing between the two limited views never loses it.
    const reconcileWeeks = async () => applyCap(state, await viewCap(state, characters[state.charIndex], getScoreIndex));

    let lastUrl = null;
    const first = await render();
    lastUrl = first.url ?? null;
    const message = await interaction.editReply(buildCharPanel(state, characters, { imageUrl: lastUrl, note: first.error }));

    const collector = message.createMessageComponentCollector({ idle: 300_000 });

    collector.on("collect", async (i) => {
      try {
        if (i.user.id !== interaction.user.id) {
          return i.reply({ content: "This isn't your graph panel — run `/graph` for your own.", flags: MessageFlags.Ephemeral }).catch(() => {});
        }

        // # of Weeks modal — showModal must be the first response, so no deferUpdate here
        if (i.customId === "graph_weeks") {
          const cap = await viewCap(state, characters[state.charIndex], getScoreIndex);
          const res = await promptWeekCount(i, {
            customId: "graph_weeks_modal",
            // Asking for 52 weeks of rank when only 17 are finalized is a request that can't be met,
            // so the ceiling offered here is the current view's reach, not the raw score count.
            max: Math.max(2, Math.min(characters[state.charIndex].scores.length, cap ?? Infinity)),
            current: state.weeks,
          });
          if (!res) return;
          if (res.error) return res.submit.followUp({ content: res.error, flags: MessageFlags.Ephemeral }).catch(() => {});

          state.weeks = res.value;
          state.weeksSet = true;
          state.uncapped = null; // typing a number is a fresh choice, so there's nothing left to restore

          const r = await render();
          if (r.url) lastUrl = r.url;
          return res.submit.editReply(buildCharPanel(state, characters, { imageUrl: r.url, note: r.error }));
        }

        await i.deferUpdate();
        if (i.customId === "graph_char") state.charIndex = Number(i.values[0]);
        else if (i.customId.startsWith("graph_view_")) state.view = i.customId.slice("graph_view_".length);
        else if (i.customId === "graph_omit") state.omit = !state.omit;

        // All three of those move the limit: a different character has a different history, and
        // hiding missed weeks changes how many usable weeks are left.
        await reconcileWeeks();

        const r = await render();
        if (r.url) lastUrl = r.url;
        await i.editReply(buildCharPanel(state, characters, { imageUrl: r.url, note: r.error }));
      } catch (err) {
        console.error("Error - /graph interaction failed:", err);
      }
    });

    collector.on("end", async () => {
      try {
        await interaction.editReply(
          buildCharPanel(state, characters, { imageUrl: lastUrl, note: lastUrl ? null : "Panel expired.", disabled: true })
        );
      } catch {
        // message may have been deleted
      }
    });
  },
};
