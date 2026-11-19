const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require("discord.js");
const culvertSchema = require("../../schemas/culvertSchema.js");
const exceptionSchema = require("../../schemas/exceptionSchema.js");
const actionLogSchema = require("../../schemas/actionLogSchema.js");
const { getResetDates } = require("../../domain/culvert/utils.js");
const {
  resolveScan,
  parseScanEntries,
  displayScannedName,
  saveScanScores,
  saveLearned,
  undoMainMappings,
} = require("../../domain/culvert/scanMatch.js");
const { readImage, fetchAttachment, CULVERT_SCAN_PROMPT } = require("../../features/scan/ocr.js");
const { isBee } = require("../../config/ids.js");
require("dotenv").config();

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

// An interaction token lasts 15 minutes, so the undo button can't outlive it.
const UNDO_WINDOW_MS = 14 * 60 * 1000;

const logAction = (fields) =>
  actionLogSchema
    .create({ ...fields, timestamp: new Date() })
    .catch((error) => console.error("Error - Could not record the action:", error?.message ?? error));

const shown = (raw) => `\`${displayScannedName(raw)}\``;
const number = (value) => (Number.isNaN(value) ? "NaN" : Number(value).toLocaleString());

// Everything a bee has to know after a scan, in the order they'd act on it.
function buildReport({ result, learned, weekLabel }) {
  const saved = result.rows.filter((r) => r.status === "saved");
  const nan = saved.filter((r) => r.isNaN);
  const zero = saved.filter((r) => !r.isNaN && r.score === 0);
  const sections = [];

  const list = saved
    .map((r) => `${r.name}: **${r.isNaN ? "0 (NaN)" : number(r.score)}**${r.sandbag ? " <:sakuPeek:1134862404900106381>" : ""}`)
    .join("\n");
  sections.push(`Submitted **${saved.length - nan.length}/${result.rows.length}** scores for ${weekLabel}\n\n${list}`);

  if (learned.length > 0) {
    const lines = learned.map((l) =>
      l.replaces
        ? `- Main changed: \`${l.key}\` → **${l.name}** (was \`${l.replaces.key}\`), from ${shown(l.raw)}`
        : `- \`${l.key}\` → **${l.name}**, from ${shown(l.raw)}`
    );
    sections.push(`Learned main links (undo below if any are wrong):\n${lines.join("\n")}`);
  }

  if (result.conflicts.length > 0) {
    const lines = result.conflicts.map(
      (c) => `- **${c.characters.join(" / ")}**: ${c.rows.map((r) => `${shown(r.raw)} ${number(r.score)}`).join(" and ")}`
    );
    sections.push(`Two rows matched the same person, so neither was saved:\n${lines.join("\n")}`);
  }

  if (result.checks.length > 0) {
    const lines = result.checks.map((c) =>
      c.reason === "high"
        ? `- ${shown(c.raw)} → **${c.name}**: ${number(c.score)} is far above their best of ${number(c.best)}`
        : `- ${shown(c.raw)} → **${c.name}**: ${number(c.score)} is far below their average of ${number(c.average)}`
    );
    sections.push(`Check these, not saved because the score doesn't fit the character:\n${lines.join("\n")}`);
  }

  const unmatched = result.rows.filter((r) => r.status === "notFound" || r.status === "ambiguous");
  if (unmatched.length > 0) {
    const lines = unmatched.map((r) => {
      const maybe = result.missing.filter((m) => m.suggestion?.raw === r.raw).map((m) => m.suggestion.character);
      const hint = r.suggestions ? ` (could be ${r.suggestions.join(", ")})` : maybe.length ? ` (maybe ${maybe.join(", ")})` : "";
      return `- **${displayScannedName(r.raw)}**${hint}`;
    });
    sections.push(`The following rows could not be matched:\n${lines.join("\n")}`);
  }

  const elsewhere = result.missing.filter((m) => !m.suggestion).length;
  if (elsewhere > 0) sections.push(`-# ${elsewhere} linked member${elsewhere === 1 ? " has" : "s have"} no row in this screenshot.`);

  if (nan.length > 0) {
    const lines = nan.map((r) => `- **${r.name}** | ID: ${r.discordId}`);
    sections.push(`The following characters' scores could not be read and have defaulted to 0:\n${lines.join("\n")}`);
  }

  if (zero.length > 0) {
    sections.push(`The following characters have not submitted any scores:\n${zero.map((r) => `**${r.name}**`).join(", ")}`);
  }

  return sections.join("\n\n");
}

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

module.exports = {
  tier: "bee",
  culvert: true,
  data: new SlashCommandBuilder()
    .setName("scan")
    .setDescription("[BEE] Submit bulk culvert data from a screenshot")
    .addAttachmentOption((option) =>
      option.setName("attach").setDescription("Image").setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("week")
        .setDescription("The specific week to submit the scores to")
        .setRequired(true)
        .addChoices(
          { name: "This week", value: "this_week" },
          { name: "Last week", value: "last_week" }
        )
    ),

  // ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

  async execute(interaction) {
    const imageOption = interaction.options.getAttachment("attach");
    const weekOption = interaction.options.getString("week");

    await interaction.deferReply();
    await interaction.editReply("Preparing to analyze image...");

    const { lastReset, reset } = getResetDates();
    const selectedWeek = weekOption === "this_week" ? reset : lastReset;
    const weekLabel = weekOption === "this_week" ? `this week (${reset})` : `last week (${lastReset})`;

    // Read once: the whole scan is decided from this snapshot.
    const [roster, mappings] = await Promise.all([
      culvertSchema.find({}, { characters: 1 }).lean(),
      exceptionSchema.find({}).lean(),
    ]);

    async function updateProgress(progress, message) {
      await interaction.editReply(`${message} ${progress}%`);
    }

    await updateProgress(10, "Analyzing image...");
    const image = await fetchAttachment(imageOption);

    let lines;
    try {
      await updateProgress(30, "Processing image...");
      const text = await readImage({ prompt: CULVERT_SCAN_PROMPT, ...image });
      lines = text.trim().split(/\r?\n/);
    } catch (error) {
      console.error("Error - OCR failed:", error);
      return interaction.editReply(error.quotaExhausted ? error.message : "Error - Failed to analyze the image.");
    }

    await updateProgress(80, "Submitting scores...");

    // Matching, learning and every rule about what may be saved live in domain/culvert/scanMatch.js,
    // shared with the webapp's scanner route.
    const { scores: rows } = parseScanEntries(lines);
    const result = resolveScan({ rows, roster, mappings, week: selectedWeek });

    await saveScanScores(result.saves, selectedWeek);
    const learned = await saveLearned(result.learned, (entry) =>
      logAction({ ...entry, actorId: String(interaction.user.id) })
    );

    await updateProgress(100, "Submitting scores...");

    const response = buildReport({ result, learned, weekLabel });

    // Discord caps a message at 2000 characters and a full guild list comfortably exceeds that.
    let last;
    for (let i = 0; i < response.length; i += 2000) {
      last = await interaction.followUp({ content: response.slice(i, i + 2000), allowedMentions: { parse: [] } });
    }

    if (learned.length === 0 || !last) return;

    const undoRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("scan_undo_learned").setLabel("Undo learned links").setStyle(ButtonStyle.Danger)
    );
    await last.edit({ components: [undoRow] });

    const press = await last
      .awaitMessageComponent({
        componentType: ComponentType.Button,
        filter: (i) => i.customId === "scan_undo_learned" && isBee(i.member, i.user.id),
        time: UNDO_WINDOW_MS,
      })
      .catch(() => null);

    if (!press) {
      await last.edit({ components: [] }).catch(() => {});
      return;
    }

    const removed = await undoMainMappings(learned);
    await logAction({
      action: "Undo Learned Mains",
      target: learned.map((l) => l.name).join(", ").slice(0, 200),
      details: learned.map((l) => `${l.key} → ${l.name}${l.replaces ? ` (restored ${l.replaces.key})` : ""}`).join(" | "),
      category: "delete",
      actorId: String(press.user.id),
    });
    await press.update({ components: [] });
    await press.followUp({
      content: `Undone by <@${press.user.id}>: ${removed} learned link${removed === 1 ? "" : "s"} removed. Scores already saved stay.`,
      allowedMentions: { parse: [] },
    });
  },
};
