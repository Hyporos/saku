const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const culvertSchema = require("../../schemas/culvertSchema.js");
const { nameMatch, getResetDates } = require("../../domain/culvert/utils.js");
const dayjs = require("dayjs");
const axios = require("axios");

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

const ACCENT = 0xffc3c5;
const PREVIOUS_SCORES = 4;
const YEAR_WEEKS = 52;

const RANKINGS_URL = (name) =>
  `https://www.nexon.com/api/maplestory/no-auth/ranking/v2/na?type=overall&id=legendary&reboot_index=1&page_index=1&character_name=${encodeURIComponent(
    name
  )}`;

const RANKINGS_PAGE = (name) =>
  `https://www.nexon.com/maplestory/rankings/north-america/overall-ranking/legendary?world_type=heroic&search_type=character-name&search=${encodeURIComponent(
    name
  )}`;

// Ranks are deliberately built from the live roster rather than from the finalized week snapshots.
// The snapshots include everyone who has since left, and placing a current member behind a string of
// people who are no longer in the guild is not a rank anyone wants to read.
async function rankOf(name, lastReset) {
  const docs = await culvertSchema.find({}, { "characters.name": 1, "characters.scores": 1 }).lean();
  const characters = docs.flatMap((doc) => doc.characters ?? []).filter((character) => character.name);

  const target = name.toLowerCase();
  const weekly = [];
  const yearly = [];

  for (const character of characters) {
    const scores = character.scores ?? [];
    weekly.push({
      name: character.name,
      score: scores.find((score) => score.date === lastReset)?.score ?? 0,
    });
    yearly.push({
      name: character.name,
      score: scores.slice(-YEAR_WEEKS).reduce((sum, score) => sum + score.score, 0),
    });
  }

  const place = (list) => {
    list.sort((a, b) => b.score - a.score);
    const index = list.findIndex((entry) => entry.name.toLowerCase() === target);
    return index === -1 ? null : index + 1;
  };

  return { weeklyRank: place(weekly), yearlyRank: place(yearly), rosterSize: characters.length };
}

// The last few weeks, newest first. A week with no entry at all is shown as a miss rather than left
// out, since a gap in the list reads as though it never happened.
function previousScores(scores, reset) {
  if (!scores.length) return "```No scores yet```";

  const recent = [...scores]
    .sort((a, b) => b.date.localeCompare(a.date))
    .filter((score) => score.date !== reset)
    .slice(0, PREVIOUS_SCORES);

  if (!recent.length) return "```No previous weeks yet```";

  return `\`\`\`${recent.map((score) => `${score.date}: ${score.score.toLocaleString()}`).join("\n")}\`\`\``;
}

module.exports = {
  culvert: true,
  data: new SlashCommandBuilder()
    .setName("profile")
    .setDescription("View the culvert profile of a character")
    .addStringOption((option) =>
      option
        .setName("character")
        .setDescription("The character to view (defaults to your own)")
        .setRequired(false)
        .setAutocomplete(true)
    ),

  // ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

  // Every linked character, not just your own: this command shows anyone's profile, so offering only
  // your own left no way to find the name you were actually after.
  async autocomplete(interaction) {
    const value = interaction.options.getFocused().toLowerCase();
    const docs = await culvertSchema.find({}, { "characters.name": 1 }).lean();

    const filtered = docs
      .flatMap((doc) => (doc.characters ?? []).map((character) => character.name))
      .filter((name) => name?.toLowerCase().includes(value))
      .sort((a, b) => a.localeCompare(b))
      .slice(0, 25);

    await interaction.respond(filtered.map((name) => ({ name, value: name }))).catch(() => {});
  },

  // ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

  async execute(interaction) {
    const characterOption = interaction.options.getString("character");

    await interaction.deferReply();

    // Get the last reset and current reset dates (Thursday 12:00 AM UTC)
    const { lastReset, reset } = getResetDates();

    // With a character given, show that one (anyone's); otherwise default to the invoker's own, the
    // same way /graph does.
    let character;
    if (characterOption) {
      const doc = await culvertSchema
        .findOne({ "characters.name": nameMatch(characterOption) }, { "characters.$": 1 })
        .lean();
      if (!doc) {
        return interaction.editReply(`Error - The character **${characterOption}** is not linked to any user`);
      }
      character = doc.characters[0];
    } else {
      const doc = await culvertSchema.findById(interaction.user.id, "characters").lean();
      if (!doc?.characters?.length) {
        return interaction.editReply("Error - You have no characters linked yet.");
      }
      if (doc.characters.length > 1) {
        return interaction.editReply(
          "Error - You have multiple characters linked. Please specify which one to view"
        );
      }
      character = doc.characters[0];
    }

    // Get and sort all scores by date, from oldest to newest
    const scores = [...(character.scores ?? [])].sort((a, b) => a.date.localeCompare(b.date));

    const totalScore = scores.slice(-YEAR_WEEKS).reduce((sum, score) => sum + score.score, 0);
    const bestScore = scores.reduce((best, score) => Math.max(best, score.score), 0);
    const submittedWeeks = scores.filter((score) => score.score > 0);

    // A character with no scores at all divided by zero and printed NaN%.
    const participation = scores.length ? Math.round((submittedWeeks.length / scores.length) * 100) : 0;

    const currentScore = scores.find((score) => score.date === reset)?.score ?? 0;
    const { weeklyRank, yearlyRank } = await rankOf(character.name, lastReset);

    // The rankings lookup is best effort: a profile is mostly guild data, and Nexon being slow or
    // down should cost the class and level line, not the whole reply. The old version put the request
    // in a `.then()` inside a `try`, so a rejection escaped the catch entirely and the interaction was
    // never answered at all.
    let ranked = null;
    try {
      const { data } = await axios.get(RANKINGS_URL(character.name), { timeout: 10000 });
      ranked = data?.ranks?.[0] ?? null;
    } catch (error) {
      console.error("Error - /profile could not reach the rankings:", error?.message ?? error);
    }

    // `"prefix" + value || fallback` reads as `("prefix" + value) || fallback`, and a prefixed string
    // is always truthy, so the fallback could never be reached and a missing character produced a
    // thumbnail URL ending in "undefined".
    const portrait = ranked?.characterImgURL ? `https://i.mapleranks.com/u/${ranked.characterImgURL.slice(38)}` : null;

    const profile = new EmbedBuilder()
      .setColor(ACCENT)
      .setTitle(character.name)
      .setAuthor({ name: "Culvert Profile" })
      .setURL(RANKINGS_PAGE(character.name))
      .addFields(
        { name: "Class", value: ranked?.jobName || "Unknown", inline: true },
        { name: "Level", value: `${ranked?.level ?? "?"}`, inline: true },
        { name: "Member Since", value: dayjs(character.memberSince).format("MMM DD, YYYY"), inline: true }
      )
      .addFields(
        { name: "Current Score", value: currentScore.toLocaleString(), inline: true },
        { name: "Weekly Rank", value: weeklyRank ? `${weeklyRank}` : "Unranked", inline: true },
        { name: "Personal Best", value: bestScore.toLocaleString(), inline: true }
      )
      .addFields({ name: "Previous Scores", value: previousScores(scores, reset), inline: false })
      .addFields(
        { name: "Yearly Score", value: totalScore.toLocaleString(), inline: true },
        { name: "Yearly Rank", value: yearlyRank ? `${yearlyRank}` : "Unranked", inline: true },
        {
          name: "Participation",
          value: `${submittedWeeks.length}/${scores.length} (${participation}%)`,
          inline: true,
        }
      )
      .setFooter({
        text: "Submit scores with /gpq • Visualize progress with /graph",
        iconURL: "https://cdn.discordapp.com/attachments/1147319860481765500/1149549510066978826/Saku.png",
      });

    if (portrait) profile.setThumbnail(portrait);

    await interaction.editReply({ embeds: [profile] });
  },
};
