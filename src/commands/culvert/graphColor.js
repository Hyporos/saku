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
const { GRAPH_COLOR, buildLineChart, textPanel, rgbToInt } = require("../../utility/culvertChart.js");
const dayjs = require("dayjs");

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

const EPHEMERAL_V2 = MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral;

// Selectable graph colors (line + fill on the dark chart card). Order runs warm → cool.
// Keep in sync with GRAPH_COLORS in apps/webapp/src/features/admin/constants.ts
const COLORS = [
  { key: "pink", label: "Saku Pink", rgb: "255,189,213", emoji: { id: "1530345810787569877", name: "sakupink" } },
  { key: "rose", label: "Hot Pink", rgb: "232,60,150", emoji: { id: "1530345717728546906", name: "hotpink" } },
  { key: "red", label: "Red", rgb: "189,36,36", emoji: { id: "1530345800528298096", name: "red" } },
  { key: "coral", label: "Coral", rgb: "251,113,90", emoji: { id: "1530345667661398117", name: "coral" } },
  { key: "orange", label: "Orange", rgb: "214,110,45", emoji: { id: "1530345778885955816", name: "orange" } },
  { key: "gold", label: "Gold", rgb: "234,179,8", emoji: { id: "1530345691849818152", name: "gold" } },
  { key: "yellow", label: "Yellow", rgb: "235,215,45", emoji: { id: "1530345845273264148", name: "yellow" } },
  { key: "lime", label: "Lime", rgb: "132,204,22", emoji: { id: "1530345756832174111", name: "lime" } },
  { key: "green", label: "Green", rgb: "58,180,31", emoji: { id: "1530345703317049496", name: "green" } },
  { key: "mint", label: "Mint Green", rgb: "173,235,179", emoji: { id: "1530345767577981078", name: "mintgreen" } },
  { key: "cyan", label: "Cyan", rgb: "34,211,238", emoji: { id: "1530345679678083236", name: "cyan" } },
  { key: "blue", label: "Blue", rgb: "45,140,214", emoji: { id: "1530345650452037693", name: "blue" } },
  { key: "indigo", label: "Indigo", rgb: "99,102,241", emoji: { id: "1530345728675676380", name: "indigo" } },
  { key: "purple", label: "Purple", rgb: "145,68,207", emoji: { id: "1530345789459795968", name: "purple" } },
  { key: "lavender", label: "Lavender", rgb: "200,160,240", emoji: { id: "1530345746463719649", name: "lavender" } },
  { key: "slate", label: "Slate", rgb: "148,163,184", emoji: { id: "1530345822196203550", name: "slate" } },
  { key: "white", label: "White", rgb: "240,240,240", emoji: { id: "1530345832258469978", name: "white" } },
];

// key → color (with precomputed accent int), so lookups are O(1) and parsing happens once.
const COLOR_BY_KEY = new Map(COLORS.map((c) => [c.key, { ...c, int: rgbToInt(c.rgb) }]));

// Builds the preview dataset: the invoker's first graphable character (basic score view,
// last 8 weeks) or a synthetic sample line when they have nothing to graph.
function buildPreviewData(characters) {
  const graphable = characters.find((c) => (c.scores?.length ?? 0) >= 2);
  if (graphable) {
    const selected = [...graphable.scores].sort((a, b) => a.date.localeCompare(b.date)).slice(-8);
    return {
      name: graphable.name,
      labels: selected.map((s) => dayjs(s.date).format("MM/DD")),
      data: selected.map((s) => s.score),
    };
  }
  const sample = [41250, 47800, 45300, 52100, 58600, 56200, 64900, 71500];
  return {
    name: "Sample",
    labels: sample.map((_, i) => dayjs().subtract(7 - i, "week").format("MM/DD")),
    data: sample,
  };
}

function renderPreview(key, preview) {
  return buildLineChart(preview.labels, [
    { label: preview.name, data: preview.data, color: COLOR_BY_KEY.get(key).rgb, fill: true },
  ]);
}

// ⎯⎯ Panel ⎯⎯ //

function buildColorPanel(state, { imageUrl, disabled = false }) {
  const selected = COLOR_BY_KEY.get(state.key);
  const applied = state.savedKey ? COLOR_BY_KEY.get(state.savedKey) : null;
  const isSaved = state.key === state.savedKey;

  const container = new ContainerBuilder()
    .setAccentColor(selected.int)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent("## Graph Color Picker"))
    .addMediaGalleryComponents(new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(imageUrl)))
    .addSeparatorComponents(new SeparatorBuilder())
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId("gc_select")
          .setPlaceholder("Choose a color")
          .setDisabled(disabled)
          .addOptions(COLORS.map((c) => ({ label: c.label, value: c.key, emoji: c.emoji, default: c.key === state.key })))
      )
    )
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("gc_save")
          .setLabel(isSaved ? "Applied" : "Apply Color")
          .setStyle(ButtonStyle.Success)
          .setDisabled(disabled || !state.hasChars || isSaved)
      )
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`-# Applied color: **${applied ? applied.label : "None"}**`)
    );

  return { components: [container], flags: EPHEMERAL_V2 };
}

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

module.exports = {
  data: new SlashCommandBuilder()
    .setName("graphcolor")
    .setDescription("Change the color of your progression graph area"),

  async execute(interaction) {
    const doc = await culvertSchema.findById(interaction.user.id, "characters").lean();
    const characters = doc?.characters ?? [];
    const currentRgb = characters[0]?.graphColor || GRAPH_COLOR;

    const preview = buildPreviewData(characters);
    const currentKey = COLORS.find((c) => c.rgb === currentRgb)?.key ?? null;
    const state = {
      key: currentKey ?? "pink",
      savedKey: currentKey,
      hasChars: characters.length > 0,
    };

    await interaction.reply({ ...textPanel("Rendering preview…"), flags: EPHEMERAL_V2 });

    let lastUrl = await renderPreview(state.key, preview);
    const message = await interaction.editReply(buildColorPanel(state, { imageUrl: lastUrl }));

    const collector = message.createMessageComponentCollector({ idle: 300_000 });

    collector.on("collect", async (i) => {
      try {
        if (i.user.id !== interaction.user.id) {
          return i.reply({ content: "This isn't your color panel — run `/graphcolor` for your own.", ephemeral: true });
        }

        await i.deferUpdate();

        if (i.customId === "gc_select") {
          if (i.values[0] === state.key) return; // no change — skip the re-render
          state.key = i.values[0];
          lastUrl = await renderPreview(state.key, preview);
          return i.editReply(buildColorPanel(state, { imageUrl: lastUrl }));
        }

        if (i.customId === "gc_save") {
          await culvertSchema.findByIdAndUpdate(interaction.user.id, {
            $set: { "characters.$[].graphColor": COLOR_BY_KEY.get(state.key).rgb },
          });
          state.savedKey = state.key;
          return i.editReply(buildColorPanel(state, { imageUrl: lastUrl }));
        }
      } catch (err) {
        console.error("Error - /graphcolor interaction failed:", err);
      }
    });

    collector.on("end", async () => {
      try {
        await interaction.editReply(buildColorPanel(state, { imageUrl: lastUrl, disabled: true }));
      } catch {
        // message may have been deleted
      }
    });
  },
};
