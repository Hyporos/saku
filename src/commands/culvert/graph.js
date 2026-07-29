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
  buildLineChart,
  textPanel,
  rgbToInt,
  promptWeekCount,
} = require("../../utility/culvertChart.js");
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
function selectCharWeeks(char, weeks, omit) {
  const sorted = [...(char.scores ?? [])].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const filtered = omit ? sorted.filter((s) => s.score > 0) : sorted;
  return filtered.slice(-weeks);
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
    const scoreIndex = await getScoreIndex();
    const perWeek = selected.map((s) => {
      if (s.score <= 0) return null;
      const guild = (scoreIndex.get(s.date) ?? []).filter((x) => x > 0).sort((a, b) => b - a);
      return guild.indexOf(s.score) + 1 || null;
    });
    const ranks = perWeek.filter((r) => r != null);
    const bottom = ranks.length ? Math.max(...ranks) : 1;
    const data = perWeek.map((r) => (r == null ? bottom : r));
    const naFlags = perWeek.map((r) => r == null);
    return {
      url: await buildLineChart(labels, [{ label: "Rank", data, color, fill: "start", naFlags }], {
        yTicks: { reverse: true, precision: 0 },
        datalabels:
          selected.length <= RANK_LABEL_MAX
            ? { display: true, align: "top", anchor: "end", color: "rgba(255,255,255,0.9)", font: { size: 12, weight: "bold" }, formatter: RANK_NA_FORMATTER }
            : null,
      }),
    };
  }

  const series = [{ label: char.name, data: selected.map((s) => s.score), color, fill: true }];

  // Score + the guild median overlaid as a faint dashed line
  if (state.view === "scoremedian") {
    const scoreIndex = await getScoreIndex();
    const median = selected.map((s) => {
      const g = computeStats(scoreIndex.get(s.date) ?? []);
      return g ? g.p50 : null;
    });
    series.push({ label: "Guild median", data: median, color: GUILD_LINE, dashed: true, dim: true, points: false });
    return { url: await buildLineChart(labels, series, { legend: true }) };
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
  data: new SlashCommandBuilder()
    .setName("graph")
    .setDescription("View the interactive progression graph of a character")
    .addStringOption((opt) =>
      opt
        .setName("character")
        .setDescription("The character to graph (defaults to your own; you can view anyone's)")
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
      if (!scoreCache) scoreCache = await loadScoreIndex();
      return scoreCache;
    };

    const state = { charIndex: startIndex, weeks: 8, weeksSet: false, omit: false, view: "score" };
    const render = () => renderCharGraph(state, characters[state.charIndex], getScoreIndex);

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
          const res = await promptWeekCount(i, {
            customId: "graph_weeks_modal",
            max: characters[state.charIndex].scores.length,
            current: state.weeks,
          });
          if (!res) return;
          if (res.error) return res.submit.followUp({ content: res.error, flags: MessageFlags.Ephemeral }).catch(() => {});

          state.weeks = res.value;
          state.weeksSet = true;

          const r = await render();
          if (r.url) lastUrl = r.url;
          return res.submit.editReply(buildCharPanel(state, characters, { imageUrl: r.url, note: r.error }));
        }

        await i.deferUpdate();
        if (i.customId === "graph_char") state.charIndex = Number(i.values[0]);
        else if (i.customId.startsWith("graph_view_")) state.view = i.customId.slice("graph_view_".length);
        else if (i.customId === "graph_omit") state.omit = !state.omit;

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
