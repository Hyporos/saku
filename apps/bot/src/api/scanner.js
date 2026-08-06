const express = require("express");
const fs = require("fs");
const path = require("path");
const dayjs = require("dayjs");
const culvertSchema = require("../schemas/culvertSchema.js");
const exceptionSchema = require("../schemas/exceptionSchema.js");
const weekSchema = require("../schemas/weekSchema.js");
const { readImage, CULVERT_SCAN_PROMPT } = require("../features/scan/ocr.js");
const { getAllCharacters, isScoreSubmitted, getResetDates } = require("../domain/culvert/utils.js");
const { BACKUPS_DIR, writeActionLog } = require("./shared.js");
const { normalizeConfusableChars, getScanBaseData } = require("./scanCache.js");

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //
// Bulk score entry from screenshots: OCR, matching, logging and finalizing.

const router = express.Router();

router.post("/admin/scanner/scan", async (req, res) => {
  try {
    const { image, week } = req.body;
    if (!image || !image.data) {
      return res.status(400).json({ error: "No image provided" });
    }

    const { lastReset, reset } = getResetDates();
    const selectedWeek = /^\d{4}-\d{2}-\d{2}$/.test(week) ? week : (week === "this_week" ? reset : lastReset);

    // Fetch character/exception data and historical week snapshots in parallel.
    const [[allUsers, exceptions], historicalWeeks] = await Promise.all([
      getScanBaseData(),
      weekSchema.find({}, { "scores.name": 1, _id: 0 }).lean(),
    ]);

    // Set of all character names that have appeared in any past finalized week snapshot.
    // Used to flag not-found OCR names that were once active (renamed or left guild).
    const historicalNames = new Set(
      historicalWeeks.flatMap((w) => (w.scores ?? []).map((s) => s.name.toLowerCase()))
    );

    // Flat list for name-matching loops (same shape as getAllCharacters())
    const characterList = [];
    // name(lower) → { char fields + discordId } — used instead of per-char findOne()
    const charDetailMap = new Map();
    // names that already have a score this week — replaces per-char isScoreSubmitted()
    const hasScoreThisWeek = new Set();

    for (const user of allUsers) {
      for (const char of user.characters ?? []) {
        if (!char.name) continue;
        const key = char.name.toLowerCase();
        characterList.push(char);
        charDetailMap.set(key, { ...char, discordId: user._id });
        if (char.scores?.some((s) => String(s.date) === String(selectedWeek))) {
          hasScoreThisWeek.add(key);
        }
      }
    }

    let entryArray;
    try {
      const text = await readImage({ prompt: CULVERT_SCAN_PROMPT, data: image.data, mimeType: image.mimeType || "image/png", temperature: 0 });
      entryArray = text.trim().split(/\r?\n/);
    } catch (error) {
      console.error("Gemini API Error:", error);
      return res.status(502).json({ error: error.quotaExhausted ? error.message : "Failed to analyze image with Gemini AI" });
    }

    // Parse entries
    const validScores = [];
    const NaNScores = [];
    const zeroScores = [];
    const notFoundChars = [];
    const absentChars = [];
    let totalSuccess = 0;
    let totalFailure = 0;
    let totalScanned = 0;

    for (const entry of entryArray) {
      const entryParts = entry.split(" ");
      const name = entryParts[0];
      const score = Number(entryParts.pop());
      if (!name) continue;

      const exception = exceptions.find(
        (e) => name.toLowerCase() === e.exception.toLowerCase()
      );
      const checkedName = exception ? exception.name : name;

      if (isNaN(score)) {
        NaNScores.push({ name: checkedName });
      } else if (score === 0) {
        zeroScores.push({ name: checkedName });
      }
      validScores.push({ name: checkedName, score, sandbag: false });
    }

    // Bulk write operations — collected below, executed in a single batched call
    const bulkOps = [];

    // Match against DB characters
    for (const validCharacter of validScores) {
      const matchingNames = [];

      // Fast-path: exception-resolved names already carry the exact DB character name.
      // A direct case-insensitive lookup avoids fuzzy-match false negatives for short names.
      const directHit = charDetailMap.get(validCharacter.name.toLowerCase());
      if (directHit) {
        // Skip the entire fuzzy loop and jump straight to the success/failure block below.
        matchingNames.push(validCharacter.name.toLowerCase());
      }

      const isTruncated =
        validCharacter.name.endsWith("...") ||
        validCharacter.name.endsWith("..") ||
        validCharacter.name.endsWith(".");

      let nameBeginning, nameEnd, truncatedPrefix;

      if (isTruncated) {
        truncatedPrefix = validCharacter.name.endsWith("...")
          ? validCharacter.name.slice(0, -3)
          : validCharacter.name.endsWith("..")
            ? validCharacter.name.slice(0, -2)
            : validCharacter.name.slice(0, -1);
        nameBeginning = truncatedPrefix.substring(0, 4);
      } else {
        nameBeginning = validCharacter.name.substring(0, 4);
        nameEnd = validCharacter.name.substring(validCharacter.name.length - 4);
      }

      if (matchingNames.length === 0) {
        for (const character of characterList) {
          if (!character.name) continue;
          if (isTruncated) {
            const normalizedCharName = normalizeConfusableChars(character.name.toLowerCase());
            const normalizedPrefix = normalizeConfusableChars(truncatedPrefix.toLowerCase());
            if (normalizedCharName.startsWith(normalizedPrefix)) {
              matchingNames.push(character.name.toLowerCase());
            }
          } else {
            const normalizedCharName = normalizeConfusableChars(character.name.toLowerCase());
            const normalizedBeginning = normalizeConfusableChars(nameBeginning.toLowerCase());
            const normalizedEnd = normalizeConfusableChars(nameEnd.toLowerCase());
            const isNameMatching = normalizedCharName.match(
              new RegExp(`^${normalizedBeginning}|${normalizedEnd}$`, "gi")
            );
            if (isNameMatching && isNameMatching.length > 0) {
              matchingNames.push(character.name.toLowerCase());
            }
          }
        }
      }

      let character;
      let userDiscordId;

      // I ↔ l substitution fallback: if standard matching yields nothing, try swapping I and l in
      // the scanned name. normalizeConfusableChars already maps both to 'i', but this provides an
      // explicit second pass for any edge cases where the chosen 4-char prefix/suffix avoids the
      // confusable letter entirely (common in MapleStory where I and l are visually identical).
      if (matchingNames.length === 0 && /[Il]/.test(validCharacter.name)) {
        const variants = new Set([
          validCharacter.name.replace(/l/g, "I"),
          validCharacter.name.replace(/I/g, "l"),
        ]);
        for (const variant of variants) {
          if (variant === validCharacter.name) continue;
          const varIsTruncated =
            variant.endsWith("...") || variant.endsWith("..") || variant.endsWith(".");
          const varPrefix = varIsTruncated
            ? (variant.endsWith("...") ? variant.slice(0, -3) : variant.endsWith("..") ? variant.slice(0, -2) : variant.slice(0, -1))
            : null;
          const varBeginning = varIsTruncated ? varPrefix.substring(0, 4) : variant.substring(0, 4);
          const varEnd = varIsTruncated ? null : variant.substring(variant.length - 4);
          for (const character of characterList) {
            if (!character.name) continue;
            const normChar = normalizeConfusableChars(character.name.toLowerCase());
            const normBeg = normalizeConfusableChars(varBeginning.toLowerCase());
            let isMatch = false;
            if (varIsTruncated) {
              isMatch = normChar.startsWith(normalizeConfusableChars(varPrefix.toLowerCase()));
            } else {
              const normEnd = normalizeConfusableChars(varEnd.toLowerCase());
              isMatch = !!normChar.match(new RegExp(`^${normBeg}|${normEnd}$`, "gi"))?.length;
            }
            if (isMatch && !matchingNames.includes(character.name.toLowerCase())) {
              matchingNames.push(character.name.toLowerCase());
            }
          }
          if (matchingNames.length > 0) break;
        }
      }

      // Resolve character from in-memory map — replaces per-character culvertSchema.findOne()
      if (matchingNames.length > 1) {
        const searchName = isTruncated ? truncatedPrefix.toLowerCase() : validCharacter.name.toLowerCase();
        for (const candidateName of matchingNames) {
          const normalizedCandidate = normalizeConfusableChars(candidateName);
          const normalizedSearch = normalizeConfusableChars(searchName);
          const isHit = isTruncated
            ? normalizedCandidate.startsWith(normalizedSearch)
            : normalizedCandidate.includes(normalizedSearch);
          if (isHit) {
            const detail = charDetailMap.get(candidateName);
            if (detail) {
              character = detail;
              userDiscordId = detail.discordId;
              if (isTruncated) break;
            }
          }
        }
      } else if (matchingNames.length === 1) {
        // Use charDetailMap directly — works for both normal and I↔l fallback matches
        const detail = charDetailMap.get(matchingNames[0]);
        if (detail) {
          character = detail;
          userDiscordId = detail.discordId;
        }
      }

      if (character && (!character.memberSince || dayjs(character.memberSince).isBefore(dayjs(selectedWeek).add(1, "week")))) {
        totalScanned++;
        totalSuccess++;
        const oldName = validCharacter.name;
        validCharacter.name = character.name;
        validCharacter.discordId = userDiscordId;

        const nanEntry = NaNScores.find((n) => n.name === oldName || n.name === character.name);
        if (nanEntry) { nanEntry.name = character.name; nanEntry.discordId = userDiscordId; }
        const zeroEntry = zeroScores.find((z) => z.name === oldName || z.name === character.name);
        if (zeroEntry) { zeroEntry.name = character.name; zeroEntry.discordId = userDiscordId; }

        const scoreValue = !isNaN(validCharacter.score) ? validCharacter.score : 0;
        // hasScoreThisWeek replaces the per-character isScoreSubmitted() aggregation pipeline
        const scoreExists = hasScoreThisWeek.has(character.name.toLowerCase());
        if (!scoreExists) {
          bulkOps.push({
            updateOne: {
              filter: { "characters.name": character.name },
              update: { $addToSet: { "characters.$[nameElem].scores": { score: scoreValue, date: selectedWeek } } },
              arrayFilters: [{ "nameElem.name": character.name }],
            },
          });
        } else {
          bulkOps.push({
            updateOne: {
              filter: { "characters.name": character.name, "characters.scores.date": selectedWeek },
              update: { $set: { "characters.$[nameElem].scores.$[dateElem].score": scoreValue } },
              arrayFilters: [{ "nameElem.name": character.name }, { "dateElem.date": selectedWeek }],
            },
          });
        }

        const sortedScores = [...character.scores].sort((a, b) => b.score - a.score);
        const bestScore = sortedScores[0]?.score || 0;
        if (validCharacter.score !== 0 && !isNaN(validCharacter.score) && validCharacter.score < bestScore * 0.85) {
          validCharacter.sandbag = true;
          validCharacter.personalBest = bestScore;
        }
      } else {
        if (character) {
          // Matched in DB but joined after the selected week — exclude from counts, surface as absent
          const zeroIdx = zeroScores.findIndex((z) => z.name === validCharacter.name);
          if (zeroIdx !== -1) zeroScores.splice(zeroIdx, 1);
          absentChars.push({ name: character.name, score: validCharacter.score });
        } else {
          totalScanned++;
          totalFailure++;
          notFoundChars.push({ name: validCharacter.name, discordId: userDiscordId });
        }
      }
    }

    // Execute all score writes in a single batched operation
    if (bulkOps.length > 0) {
      await culvertSchema.bulkWrite(bulkOps, { ordered: false });
    }

    // Build result
    const successEntries = validScores
      .filter((v) => !notFoundChars.some((nf) => nf.name === v.name))
      .map((v) => ({
        name: v.name,
        score: v.score,
        sandbag: v.sandbag,
        isNaN: NaNScores.some((n) => n.name === v.name),
        ...(v.sandbag && v.personalBest ? { personalBest: v.personalBest } : {}),
      }));

    res.json({
      week: selectedWeek,
      success: successEntries,
      notFound: notFoundChars.map((nf) => ({
        name: nf.name,
        ...(historicalNames.has(nf.name.toLowerCase()) ? { previouslyScanned: true } : {}),
      })),
      nanScores: NaNScores.map((n) => ({ name: n.name })),
      zeroScores: zeroScores.map((z) => ({ name: z.name })),
      absentScores: absentChars.map((a) => ({ name: a.name, score: a.score })),
      totalSuccess,
      totalFailure,
      totalScanned,
    });
  } catch (error) {
    console.error("Scanner error:", error);
    res.status(500).json({ error: "An unexpected error occurred during scanning" });
  }
});

/**
 * POST /admin/scanner/log
 * Body: { week, imageCount, totalSuccess, totalFailure }
 * Logs the aggregate scan results to the action log (called once after all images processed).
 */
router.post("/admin/scanner/log", async (req, res) => {
  try {
    const { weekLabel, imageCount, matched = [], notFound = [], anomalies = [] } = req.body;
    const target = weekLabel || "Unknown Week";

    // Build a structured details string: first segment is the summary (shown as Detail Summary)
    // in the action log modal; subsequent Key: Value pairs populate the Changes Made section.
    const parts = [`Scanned ${imageCount} image${imageCount !== 1 ? "s" : ""} for ${target}`];

    // Build a lookup so anomaly entries can be emitted inline with each matched character,
    // preserving the original scan order rather than pushing them to the bottom.
    const anomalyMap = new Map(anomalies.map((a) => [a.name, a]));

    for (const m of matched) {
      const anomaly = anomalyMap.get(m.name);
      if (anomaly) {
        const detail =
          anomaly.previousScore != null
            ? `${m.score} above previous ${anomaly.previousScore}`
            : String(m.score);
        parts.push(`${m.name} (Score Anomaly): ${detail}`);
      } else if (m.isNaN) {
        parts.push(`${m.name} (NaN Score): NaN`);
      } else if (m.sandbag) {
        parts.push(`${m.name} (Sandbag): ${m.score}`);
      } else if (m.score === 0) {
        parts.push(`${m.name} (Zero Score): 0`);
      } else {
        parts.push(`${m.name}: ${m.score}`);
      }
    }

    for (const nf of notFound) {
      parts.push(`${nf.name} (Not Found): —`);
    }

    await writeActionLog(req, {
      action: "Scan Scores",
      target,
      details: parts.join(" | "),
      category: "scan",
    });
    res.json({ ok: true });
  } catch (error) {
    console.error("Scanner log error:", error);
    res.status(500).json({ error: "Failed to log scan action" });
  }
});

/**
 * POST /admin/scanner/finalize
 * Body: { week: "this_week" | "last_week", override: boolean }
 */
router.post("/admin/scanner/finalize", async (req, res) => {
  try {
    const { week, override } = req.body;
    const { reset, lastReset } = getResetDates();
    const selectedWeek = /^\d{4}-\d{2}-\d{2}$/.test(week) ? week : (week === "this_week" ? reset : lastReset);

    const charactersData = await culvertSchema.find({}, "characters");
    const allCharacters = charactersData.flatMap((list) => list.characters);

    const missedCharacters = allCharacters
      .filter((character) => {
        const hasNoScore = character.scores.every((score) => score.date !== selectedWeek);
        const wasInGuild = !(selectedWeek === lastReset && dayjs(character.memberSince).isAfter(lastReset));
        return hasNoScore && wasInGuild;
      })
      .map((character) => character.name)
      .filter((name) => name && typeof name === "string" && name.trim());

    if (missedCharacters.length > 0 && !override) {
      return res.json({
        success: false,
        missedCharacters,
        total: allCharacters.length,
        submitted: allCharacters.length - missedCharacters.length,
        week: selectedWeek,
      });
    }

    // Create backup
    const data = await culvertSchema.find({});
    const jsonData = JSON.stringify(data, null, 2);
    const backupFilename = `saku_culvert_${selectedWeek}_${Date.now()}.json`;

    // Save backup to disk
    fs.mkdirSync(BACKUPS_DIR, { recursive: true });
    fs.writeFileSync(path.join(BACKUPS_DIR, backupFilename), jsonData, "utf-8");

    const submitted = allCharacters.length - missedCharacters.length;
    const total = allCharacters.length;

    const summaryLine = `${submitted}/${total} scores submitted for week of ${selectedWeek}`;

    const weekLabel = `Week of ${selectedWeek}`;
    const overrideUsed = missedCharacters.length > 0 && !!override;

    await writeActionLog(req, {
      action: "Finalize Scores",
      target: weekLabel,
      details: `${summaryLine} | Backup: ${backupFilename}${overrideUsed ? " | Override: true" : ""}`,
      category: "finalize",
    });

    // Build scores snapshot (all characters that have a score this week, sorted desc)
    const scoresSnapshot = allCharacters
      .filter((c) => c.scores.some((s) => s.date === selectedWeek))
      .map((c) => {
        const entry = c.scores.find((s) => s.date === selectedWeek);
        return { name: c.name, score: entry.score };
      })
      .sort((a, b) => b.score - a.score);

    // Upsert the week record
    await weekSchema.findOneAndUpdate(
      { week: selectedWeek },
      { week: selectedWeek, finalized: true, override: overrideUsed, submitted, total, scores: scoresSnapshot, finalizedAt: new Date() },
      { upsert: true, new: true }
    );

    res.json({
      success: true,
      missedCharacters,
      total,
      submitted,
      week: selectedWeek,
      backupFilename,
    });
  } catch (error) {
    console.error("Finalize error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

module.exports = router;
