const express = require("express");
const culvertSchema = require("../schemas/culvertSchema.js");
const { escapeRegex, isIsoDate, writeActionLog, fail, objectId } = require("./shared.js");

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //
// Individual culvert scores, by character+date or by score id.

const router = express.Router();

// Case-insensitive match on a character name, which every route in this file needs.
const named = (safeName) => ({ $regex: `^${safeName}$`, $options: "i" });

// The score a character already has for a week, or undefined. Read before an edit or a delete so the
// action log can say what the value actually was, which is the only reason the write is preceded by a
// read at all.
async function existingScoreFor(safeCharacter, safeDate) {
  const doc = await culvertSchema
    .findOne({ "characters.name": named(safeCharacter), "characters.scores.date": safeDate }, { "characters.$": 1 })
    .lean();
  return doc?.characters?.[0]?.scores?.find((s) => s.date === safeDate);
}

router.get("/admin/scores/:character", async (req, res) => {
  try {
    const safeCharacter = escapeRegex(req.params.character);
    const user = await culvertSchema.findOne(
      { "characters.name": named(safeCharacter) },
      { "characters.$": 1 }
    );
    res.json(user?.characters[0]?.scores ?? []);
  } catch (error) {
    fail(res, error, "fetching scores");
  }
});

router.post("/admin/scores", async (req, res) => {
  try {
    const character = String(req.body?.character ?? "").trim();
    const date = String(req.body?.date ?? "").trim();
    const score = Number(req.body?.score);
    if (!character || !isIsoDate(date) || !Number.isFinite(score) || score < 0) {
      return res.status(400).json({ error: "Invalid score payload" });
    }
    const safeCharacter = escapeRegex(character);
    await culvertSchema.findOneAndUpdate(
      { "characters.name": named(safeCharacter) },
      { $push: { "characters.$.scores": { date, score } } }
    );
    await writeActionLog(req, {
      action: "Create Score",
      target: character,
      details: `Date: ${date} | Score: ${score}`,
      category: "create",
    });
    res.json({ success: true });
  } catch (error) {
    fail(res, error, "adding score");
  }
});

router.patch("/admin/scores/:character/:date(\\d{4}-\\d{2}-\\d{2})", async (req, res) => {
  try {
    const safeCharacter = escapeRegex(req.params.character);
    const safeDate = String(req.params.date ?? "").trim();
    const score = Number(req.body?.score);
    if (!isIsoDate(safeDate) || !Number.isFinite(score) || score < 0) {
      return res.status(400).json({ error: "Invalid score payload" });
    }
    const existingScore = await existingScoreFor(safeCharacter, safeDate);

    await culvertSchema.findOneAndUpdate(
      {
        "characters.name": named(safeCharacter),
        "characters.scores.date": safeDate,
      },
      { $set: { "characters.$[c].scores.$[s].score": score } },
      { arrayFilters: [{ "c.name": named(safeCharacter) }, { "s.date": safeDate }] }
    );
    await writeActionLog(req, {
      action: "Edit Score",
      target: String(req.params.character),
      details: `Score updated from ${Number(existingScore?.score ?? 0)} to ${score}`,
      category: "edit",
    });
    res.json({ success: true });
  } catch (error) {
    fail(res, error, "updating score");
  }
});

router.delete("/admin/scores/:character/:date(\\d{4}-\\d{2}-\\d{2})", async (req, res) => {
  try {
    const safeCharacter = escapeRegex(req.params.character);
    const safeDate = String(req.params.date ?? "").trim();
    if (!isIsoDate(safeDate)) return res.status(400).json({ error: "Invalid score date" });

    const existingScore = await existingScoreFor(safeCharacter, safeDate);

    await culvertSchema.findOneAndUpdate(
      { "characters.name": named(safeCharacter) },
      { $pull: { "characters.$.scores": { date: safeDate } } }
    );
    await writeActionLog(req, {
      action: "Delete Score",
      target: String(req.params.character),
      details: `Deleted score of ${Number(existingScore?.score ?? 0)} for date ${safeDate}`,
      category: "delete",
    });
    res.json({ success: true });
  } catch (error) {
    fail(res, error, "deleting score");
  }
});

// By-ID score routes — used for scores that have a Mongoose-generated _id.
// These are unambiguous and safer than using date as a key.

router.patch("/admin/scores/by-id/:scoreId", async (req, res) => {
  try {
    const scoreId = objectId(req.params.scoreId);
    if (!scoreId) return res.status(400).json({ error: "Invalid score id" });
    const scoreProvided = req.body?.score !== undefined;
    const dateProvided = req.body?.date !== undefined;
    if (!scoreProvided && !dateProvided) {
      return res.status(400).json({ error: "No score update fields provided" });
    }

    const score = Number(req.body?.score);
    const nextDate = String(req.body?.date ?? "").trim();
    if (scoreProvided && (!Number.isFinite(score) || score < 0)) {
      return res.status(400).json({ error: "Invalid score" });
    }
    if (dateProvided && !isIsoDate(nextDate)) {
      return res.status(400).json({ error: "Invalid score date" });
    }

    const ownerDoc = await culvertSchema.findOne(
      { "characters.scores._id": scoreId },
      { characters: 1 }
    ).lean();
    if (!ownerDoc?.characters?.length) {
      return res.status(404).json({ error: "Score not found" });
    }

    let ownerCharacter = null;
    let existingScore = null;
    for (const character of ownerDoc.characters) {
      const matched = (character.scores ?? []).find((s) => String(s._id) === String(scoreId));
      if (matched) {
        ownerCharacter = character;
        existingScore = matched;
        break;
      }
    }

    if (!ownerCharacter || !existingScore) {
      return res.status(404).json({ error: "Score not found" });
    }

    if (dateProvided && nextDate !== existingScore.date) {
      const duplicateDate = (ownerCharacter.scores ?? []).some(
        (s) => s.date === nextDate && String(s._id) !== String(scoreId)
      );
      if (duplicateDate) {
        return res.status(409).json({ error: "A score for this date already exists" });
      }
    }

    const setFields = {};
    if (scoreProvided) setFields["characters.$[].scores.$[s].score"] = score;
    if (dateProvided) setFields["characters.$[].scores.$[s].date"] = nextDate;

    await culvertSchema.findOneAndUpdate(
      { "characters.scores._id": scoreId },
      { $set: setFields },
      { arrayFilters: [{ "s._id": scoreId }] }
    );

    const detailsParts = [];
    if (scoreProvided && Number(existingScore.score) !== score) {
      detailsParts.push(`Score updated from ${Number(existingScore.score)} to ${score}`);
    }
    if (dateProvided && existingScore.date !== nextDate) {
      detailsParts.push(`Date updated from ${existingScore.date} to ${nextDate}`);
    }

    await writeActionLog(req, {
      action: "Edit Score",
      target: String(ownerCharacter.name),
      details: detailsParts.length > 0 ? detailsParts.join(" | ") : "Score updated",
      category: "edit",
    });
    res.json({ success: true });
  } catch (error) {
    fail(res, error, "updating score by id");
  }
});

router.delete("/admin/scores/by-id/:scoreId", async (req, res) => {
  try {
    const scoreId = objectId(req.params.scoreId);
    if (!scoreId) return res.status(400).json({ error: "Invalid score id" });

    const ownerDoc = await culvertSchema.findOne(
      { "characters.scores._id": scoreId },
      { characters: 1 }
    ).lean();
    let ownerCharacterName = String(req.params.scoreId);
    let deletedScoreValue = 0;
    let deletedScoreDate = "";
    if (ownerDoc?.characters?.length) {
      for (const character of ownerDoc.characters) {
        const matchedScore = (character.scores ?? []).find((s) => String(s._id) === String(scoreId));
        if (matchedScore) {
          ownerCharacterName = String(character.name);
          deletedScoreValue = Number(matchedScore.score ?? 0);
          deletedScoreDate = String(matchedScore.date ?? "");
          break;
        }
      }
    }

    await culvertSchema.findOneAndUpdate(
      { "characters.scores._id": scoreId },
      { $pull: { "characters.$[c].scores": { _id: scoreId } } },
      { arrayFilters: [{ "c.scores._id": scoreId }] }
    );
    await writeActionLog(req, {
      action: "Delete Score",
      target: ownerCharacterName,
      details: `Deleted score of ${deletedScoreValue} for date ${deletedScoreDate || "unknown"}`,
      category: "delete",
    });
    res.json({ success: true });
  } catch (error) {
    fail(res, error, "deleting score by id");
  }
});

// Exceptions — exceptionSchema documents

module.exports = router;
