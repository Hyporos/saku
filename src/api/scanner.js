const express = require("express");
const fs = require("fs");
const path = require("path");
const dayjs = require("dayjs");
const culvertSchema = require("../schemas/culvertSchema.js");
const weekSchema = require("../schemas/weekSchema.js");
const { readImage, CULVERT_SCAN_PROMPT } = require("../features/scan/ocr.js");
const { getResetDates } = require("../domain/culvert/utils.js");
const {
  resolveScan,
  parseScanEntries,
  splitScannedName,
  saveScanScores,
  saveLearned,
} = require("../domain/culvert/scanMatch.js");
const { BACKUPS_DIR, writeActionLog, fail } = require("./shared.js");
const { getScanBaseData, clearScanCache } = require("./scanCache.js");

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

    let entryArray;
    try {
      const text = await readImage({ prompt: CULVERT_SCAN_PROMPT, data: image.data, mimeType: image.mimeType || "image/png" });
      entryArray = text.trim().split(/\r?\n/);
    } catch (error) {
      console.error("Error - OCR failed:", error);
      return res.status(502).json({ error: error.quotaExhausted ? error.message : "Failed to analyze the image" });
    }

    // Matching, learning and every rule about what may be saved live in domain/culvert/scanMatch.js,
    // shared with /scan, so a screenshot resolves the same way whichever one reads it.
    const { scores: rows } = parseScanEntries(entryArray);
    const result = resolveScan({ rows, roster: allUsers, mappings: exceptions, week: selectedWeek });

    await saveScanScores(result.saves, selectedWeek);
    const learned = await saveLearned(result.learned, (entry) => writeActionLog(req, entry));
    if (learned.length > 0) clearScanCache();

    // A cell names two characters; either one appearing in a past week means this row was once active.
    const wasScanned = (raw) => {
      const { outer, inner } = splitScannedName(raw);
      return [outer, inner].some((n) => n && historicalNames.has(n.toLowerCase()));
    };

    const saved = result.rows.filter((r) => r.status === "saved");
    const unmatched = result.rows.filter((r) => r.status === "notFound" || r.status === "ambiguous");

    res.json({
      week: selectedWeek,
      success: saved.map((r) => ({
        name: r.name,
        score: r.score,
        sandbag: r.sandbag,
        isNaN: r.isNaN,
        ...(r.personalBest ? { personalBest: r.personalBest } : {}),
      })),
      notFound: unmatched.map((r) => ({
        name: r.raw,
        ...(wasScanned(r.raw) ? { previouslyScanned: true } : {}),
        ...(r.suggestions ? { suggestions: r.suggestions } : {}),
      })),
      nanScores: saved.filter((r) => r.isNaN).map((r) => ({ name: r.name })),
      zeroScores: saved.filter((r) => !r.isNaN && r.score === 0).map((r) => ({ name: r.name })),
      absentScores: result.rows.filter((r) => r.status === "absent").map((r) => ({ name: r.name, score: r.score })),
      learned: learned.map((l) => ({ id: l.id, key: l.key, name: l.name, raw: l.raw, replaces: l.replaces })),
      conflicts: result.conflicts,
      checks: result.checks,
      missing: result.missing,
      totalSuccess: saved.length,
      totalFailure: unmatched.length,
      totalScanned: saved.length + unmatched.length,
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
    fail(res, error, "Finalize error");
  }
});

module.exports = router;
