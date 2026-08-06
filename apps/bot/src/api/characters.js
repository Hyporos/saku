const express = require("express");
const axios = require("axios");
const culvertSchema = require("../schemas/culvertSchema.js");
const actionLogSchema = require("../schemas/actionLogSchema.js");
const { RANKINGS_URL } = require("../domain/culvert/utils.js");
const { ARCHIVE_WINDOW_DAYS, escapeRegex, isDiscordId, isIsoDate, isStoredDate, graphColorName, writeActionLog, fail } = require("./shared.js");

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //
// Creating, editing, transferring and removing characters, plus the restorable archive.

const router = express.Router();

router.post("/admin/characters", async (req, res) => {
  try {
    const userId = String(req.body?.userId ?? "").trim();
    const name = String(req.body?.name ?? "").trim();
    const memberSince = String(req.body?.memberSince ?? "").trim();
    const avatar = typeof req.body?.avatar === "string" ? req.body.avatar : "";

    if (!isDiscordId(userId) || !name) return res.status(400).json({ error: "Invalid character payload" });
    if (memberSince && !isIsoDate(memberSince) && !isStoredDate(memberSince)) {
      return res.status(400).json({ error: "Invalid memberSince date" });
    }

    const safeName = escapeRegex(name);
    const duplicateDoc = await culvertSchema.findOne(
      { "characters.name": { $regex: `^${safeName}$`, $options: "i" } },
      { _id: 1 }
    );
    if (duplicateDoc) return res.status(409).json({ error: "Character name already exists" });

    await culvertSchema.findByIdAndUpdate(userId, {
      $push: { characters: { name, memberSince, avatar: avatar || "", graphColor: "255,189,213", scores: [] } },
    }, { upsert: true });
    const username = String(req.body?.username ?? "").trim() || userId;
    await writeActionLog(req, {
      action: "Link Character",
      target: username,
      details: `Linked character ${name} to user ${username} | User: ${username} | Character: ${name}`,
      category: "create",
    });
    res.json({ success: true });
  } catch (error) {
    fail(res, error, "creating character");
  }
});

router.patch("/admin/characters/:userId/:name", async (req, res) => {
  try {
    if (!isDiscordId(req.params.userId)) return res.status(400).json({ error: "Invalid user id" });
    const nextName = String(req.body?.name ?? "").trim();
    const memberSince = String(req.body?.memberSince ?? "");
    const avatar = typeof req.body?.avatar === "string" ? req.body.avatar : "";
    const graphColor = typeof req.body?.graphColor === "string" ? req.body.graphColor : undefined;
    const currentName = String(req.params.name ?? "");

    if (!nextName) return res.status(400).json({ error: "Character name is required" });
    if (memberSince && !isIsoDate(memberSince) && !isStoredDate(memberSince)) {
      return res.status(400).json({ error: "Invalid memberSince date" });
    }
    if (graphColor !== undefined && !/^\d{1,3},\d{1,3},\d{1,3}$/.test(graphColor)) {
      return res.status(400).json({ error: "Invalid graph color" });
    }

    let canonicalName = nextName;
    if (nextName.toLowerCase() !== currentName.toLowerCase()) {
      try {
        const rankingsRes = await axios.get(RANKINGS_URL(nextName));
        const topRank = rankingsRes?.data?.ranks?.[0] ?? null;
        const rankedName = String(
          topRank?.characterName ?? topRank?.character_name ?? topRank?.name ?? ""
        ).trim();
        if (rankedName) canonicalName = rankedName;
      } catch {
        // Fallback to requested name when rankings lookup fails.
      }
    }

    const safeNextName = escapeRegex(canonicalName);
    const safeCurrentName = escapeRegex(currentName);

    const existingOwner = await culvertSchema.findOne(
      { _id: req.params.userId, "characters.name": { $regex: `^${safeCurrentName}$`, $options: "i" } },
      { "characters.$": 1 }
    );
    const existingChar = existingOwner?.characters?.[0];
    if (!existingChar) return res.status(404).json({ error: "Character not found" });

    const duplicateDoc = await culvertSchema.findOne(
      {
        "characters.name": { $regex: `^${safeNextName}$`, $options: "i" },
      },
      { _id: 1, characters: 1 }
    );

    const isSameCharacterRename = !!duplicateDoc &&
      String(duplicateDoc._id) === String(req.params.userId) &&
      duplicateDoc.characters?.some((c) => c.name?.toLowerCase() === currentName.toLowerCase()) &&
      canonicalName.toLowerCase() === currentName.toLowerCase();

    if (duplicateDoc && !isSameCharacterRename) {
      return res.status(409).json({ error: "Character name already exists" });
    }

    const nextMemberSince = memberSince || existingChar.memberSince || "";
    const nextAvatar = avatar || existingChar.avatar || "";
    const nextGraphColor = graphColor ?? existingChar.graphColor;

    await culvertSchema.findOneAndUpdate(
      { _id: req.params.userId, "characters.name": { $regex: `^${safeCurrentName}$`, $options: "i" } },
      {
        $set: {
          "characters.$.name": canonicalName,
          "characters.$.memberSince": nextMemberSince,
          "characters.$.avatar": nextAvatar,
          "characters.$.graphColor": nextGraphColor,
        },
      }
    );

    const nameChanged = existingChar.name !== canonicalName;
    const memberSinceChanged = existingChar.memberSince !== nextMemberSince;
    const graphColorChanged = existingChar.graphColor !== nextGraphColor;

    const detailsParts = [];
    if (nameChanged) detailsParts.push(`Renamed from ${existingChar.name} to ${canonicalName}`);
    if (memberSinceChanged) detailsParts.push(`Member Since updated from ${existingChar.memberSince || "—"} to ${nextMemberSince || "—"}`);
    if (graphColorChanged) {
      detailsParts.push(
        `Graph Color updated from ${graphColorName(existingChar.graphColor)} to ${graphColorName(nextGraphColor)}`
      );
    }
    const details = detailsParts.join(" | ") || "Character updated";

    await writeActionLog(req, {
      action: nameChanged ? "Rename Character" : "Edit Character",
      target: existingChar.name,
      details,
      category: nameChanged ? "rename" : "edit",
    });
    res.json({ success: true });
  } catch (error) {
    fail(res, error, "updating character");
  }
});

router.post("/admin/characters/transfer", async (req, res) => {
  try {
    const { fromUserId, characterName, toUserId, deleteSource } = req.body;
    const fromUsername = String(req.body?.fromUsername ?? fromUserId);
    const toUsername = String(req.body?.toUsername ?? toUserId);
    if (!isDiscordId(fromUserId) || !isDiscordId(toUserId) || !characterName) {
      return res.status(400).json({ error: "Invalid transfer payload" });
    }
    const safeCharacterName = escapeRegex(String(characterName ?? ""));

    // Find the character in the source user's document
    const sourceDoc = await culvertSchema.findOne(
      { _id: fromUserId, "characters.name": { $regex: `^${safeCharacterName}$`, $options: "i" } },
      { "characters.$": 1 }
    );
    if (!sourceDoc?.characters?.[0]) {
      return res.status(404).json({ error: "Character not found" });
    }
    const character = sourceDoc.characters[0].toObject();

    const duplicateAtDestination = await culvertSchema.findOne(
      { _id: toUserId, "characters.name": { $regex: `^${safeCharacterName}$`, $options: "i" } },
      { _id: 1 }
    );
    if (duplicateAtDestination) {
      return res.status(409).json({ error: "Destination already has this character" });
    }

    // Push the character into the destination user (upsert if they have no DB doc yet)
    await culvertSchema.findByIdAndUpdate(
      toUserId,
      { $addToSet: { characters: character } },
      { upsert: true }
    );

    // Remove the character from the source user
    await culvertSchema.findByIdAndUpdate(fromUserId, {
      $pull: { characters: { name: { $regex: `^${safeCharacterName}$`, $options: "i" } } },
    });

    if (deleteSource) {
      // Checkbox checked — delete the source user document regardless of remaining characters
      await culvertSchema.deleteOne({ _id: fromUserId });
    }

    const transferDetailsParts = [`Owner updated from ${fromUsername} to ${toUsername}`];
    if (deleteSource) transferDetailsParts.push("Source User updated from Active to Deleted");

    await writeActionLog(req, {
      action: "Transfer Character",
      target: String(characterName),
      details: transferDetailsParts.join(" | "),
      category: "transfer",
    });

    res.json({ success: true });
  } catch (error) {
    fail(res, error, "transferring character");
  }
});

router.delete("/admin/characters/batch", async (req, res) => {
  try {
    const userId = String(req.body?.userId ?? "").trim();
    const names = Array.isArray(req.body?.names) ? req.body.names.map(String).filter(Boolean) : [];
    const deleteSource = req.body?.deleteSource === true;
    const username = String(req.body?.username ?? "").trim();

    if (!isDiscordId(userId) || names.length === 0) {
      return res.status(400).json({ error: "Invalid batch unlink payload" });
    }

    // Snapshot all current char names BEFORE any modification so collateral chars can be logged
    const userDoc = await culvertSchema.findById(userId, { "characters.name": 1 }).lean();
    const allCharNames = (userDoc?.characters ?? []).map((c) => String(c.name));
    const selectedLower = new Set(names.map((n) => n.toLowerCase()));
    const collateralNames = allCharNames.filter((n) => !selectedLower.has(n.toLowerCase()));

    // Pull all selected chars in a single update
    await culvertSchema.findByIdAndUpdate(userId, {
      $pull: {
        characters: { name: { $in: names.map((n) => new RegExp(`^${escapeRegex(n)}$`, "i")) } },
      },
    });

    if (deleteSource) {
      await culvertSchema.deleteOne({ _id: userId });
    }

    // One log entry per selected char
    for (const name of names) {
      await writeActionLog(req, {
        action: deleteSource ? "Unlink Character / Delete User" : "Unlink Character",
        target: String(name),
        details: deleteSource
          ? `Deleted character ${String(name)} and its associated user ${username || userId}`
          : `Unlinked character ${String(name)} from user ${username || userId}`,
        category: "delete",
      });
    }

    // One log entry per collateral char (deleted because the whole user was removed)
    if (deleteSource) {
      for (const name of collateralNames) {
        await writeActionLog(req, {
          action: "Unlink Character",
          target: String(name),
          category: "delete",
        });
      }
    }

    res.json({ success: true });
  } catch (error) {
    fail(res, error, "batch unlinking characters");
  }
});

router.delete("/admin/characters/:userId/:name", async (req, res) => {
  try {
    if (!isDiscordId(req.params.userId)) return res.status(400).json({ error: "Invalid user id" });
    const deleteSource = String(req.query.deleteSource ?? "").toLowerCase() === "true";
    const safeName = escapeRegex(req.params.name);

    await culvertSchema.findByIdAndUpdate(req.params.userId, {
      $pull: { characters: { name: { $regex: `^${safeName}$`, $options: "i" } } },
    });

    if (deleteSource) {
      await culvertSchema.deleteOne({ _id: req.params.userId });
    }

    const unlinkUsername = String(req.query.username ?? "").trim();
    await writeActionLog(req, {
      action: deleteSource ? "Unlink Character / Delete User" : "Unlink Character",
      target: String(req.params.name),
      details: deleteSource
        ? `Deleted character ${String(req.params.name)} and its associated user ${unlinkUsername || String(req.params.userId)}`
        : `Unlinked character ${String(req.params.name)} from user ${unlinkUsername || String(req.params.userId)}`,
      category: "delete",
    });

    res.json({ success: true });
  } catch (error) {
    fail(res, error, "deleting character");
  }
});

// Scores — embedded in characters within culvertSchema

// Characters that /character unlink removed but that can still be put back. The unlink writes a full
// snapshot into the action log, and the log expires after 90 days, so this window is exactly how long
// a restore stays possible.
router.get("/admin/archived-characters", async (req, res) => {
  try {
    const entries = await actionLogSchema
      .find({ action: "Unlink Character", snapshot: { $ne: null } })
      .sort({ timestamp: -1 })
      .limit(200)
      .lean();

    const live = new Set(
      (await culvertSchema.find({}, { "characters.name": 1 }).lean())
        .flatMap((doc) => (doc.characters ?? []).map((character) => character.name?.toLowerCase()))
        .filter(Boolean)
    );

    const seen = new Set();
    const archived = [];

    for (const entry of entries) {
      const character = entry.snapshot?.character;
      if (!character?.name) continue;

      // Only the most recent unlink of a name can be restored, and a name that is linked again is no
      // longer archived at all.
      const key = character.name.toLowerCase();
      if (seen.has(key) || live.has(key)) continue;
      seen.add(key);

      const expiresAt = new Date(new Date(entry.timestamp).getTime() + ARCHIVE_WINDOW_DAYS * 86400000);
      archived.push({
        id: String(entry._id),
        name: character.name,
        ownerId: entry.snapshot.ownerId ?? null,
        memberSince: character.memberSince ?? null,
        scoreCount: character.scores?.length ?? 0,
        unlinkedAt: entry.timestamp,
        unlinkedBy: entry.actorId ?? null,
        expiresAt,
        daysLeft: Math.max(0, Math.ceil((expiresAt - Date.now()) / 86400000)),
      });
    }

    res.json(archived);
  } catch (error) {
    fail(res, error, "fetching archived characters");
  }
});

module.exports = router;
