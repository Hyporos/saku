const culvertSchema = require("../schemas/culvertSchema.js");
const exceptionSchema = require("../schemas/exceptionSchema.js");
const actionLogSchema = require("../schemas/actionLogSchema.js");
const weekSchema = require("../schemas/weekSchema.js");
const express = require("express");
const axios = require("axios");
const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");

const router = express.Router();
const MAX_ACTION_LOG_ENTRIES = 500;
const ACTION_LOG_CATEGORIES = new Set(["create", "edit", "delete", "transfer", "rename", "finalize", "scan"]);
const BACKUPS_DIR = path.join(__dirname, "../../backups");
const GRAPH_COLOR_NAMES = {
  "255,189,213": "Pink",
  "145,68,207": "Purple",
  "31,119,180": "Blue",
  "189,36,36": "Red",
  "214,110,45": "Orange",
  "180,170,31": "Yellow",
  "58,180,31": "Green",
  "173,235,179": "Mint Green",
  "216,185,255": "Lavender",
};

const escapeRegex = (value = "") => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const isDiscordId = (value = "") => /^\d{5,25}$/.test(String(value));
const isIsoDate = (value = "") => /^\d{4}-\d{2}-\d{2}$/.test(String(value));
const isStoredDate = (value = "") => /^[A-Za-z]{3} \d{2}, \d{4}$/.test(String(value));
const graphColorName = (rgb = "") => GRAPH_COLOR_NAMES[String(rgb).trim()] ?? String(rgb).trim();

const writeActionLog = async (req, entry) => {
  const actorId = getActorId(req);
  if (!actorId || !isDiscordId(actorId)) return;
  if (!entry?.action || !entry?.target || !ACTION_LOG_CATEGORIES.has(entry?.category)) return;

  await actionLogSchema.create({
    action: String(entry.action).trim().slice(0, 120),
    target: String(entry.target).trim().slice(0, 200),
    details: entry.details ? String(entry.details).trim().slice(0, 800) : null,
    category: String(entry.category).trim().toLowerCase(),
    actorId,
    timestamp: new Date(),
  });

  const stale = await actionLogSchema
    .find({}, { _id: 1 })
    .sort({ timestamp: -1, _id: -1 })
    .skip(MAX_ACTION_LOG_ENTRIES)
    .lean();

  if (stale.length > 0) {
    await actionLogSchema.deleteMany({ _id: { $in: stale.map((s) => s._id) } });
  }
};

const getActorId = (req) => {
  const actorId = String(req.headers["x-admin-user-id"] ?? "").trim();
  return actorId || null;
};

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

// Get all Method
router.get("/getAll", async (req, res) => {
  try {
    const culverts = await culvertSchema.find();
    res.json(culverts);
  } catch (error) {
    console.error("Error fetching culverts:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Find the character with the given name
router.get("/character/:name", async (req, res) => {
  try {
    const safeName = escapeRegex(req.params.name);
    const user = await culvertSchema.findOne(
      {
        "characters.name": { $regex: `^${safeName}$`, $options: "i" },
      },
      { "characters.$": 1 }
    );
    if (!user?.characters?.[0]) {
      return res.status(404).json({ error: "Character not found" });
    }
    res.json(user.characters[0]);
  } catch (error) {
    console.error("Error fetching culverts:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Get character info from MapleStory rankings
router.get("/rankings/:name", async (req, res) => {
  try {
    const characterName = String(req.params.name ?? "").trim();
    if (!characterName) return res.status(400).json({ error: "Character name is required" });
    const response = await axios.get(
      `https://www.nexon.com/api/maplestory/no-auth/ranking/v2/na?type=overall&id=legendary&reboot_index=1&page_index=1&character_name=${encodeURIComponent(characterName)}`
    );

    const characterImgURL = response.data.ranks[0].characterImgURL;
    const level = response.data.ranks[0].level;
    const characterClassName = response.data.ranks[0].characterClassName ?? null;

    const characterData = {
      characterImgURL,
      level,
      characterClassName,
    };

    res.json(characterData);
  } catch (error) {
    console.error("Error fetching character:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //
// Admin routes — called by the webapp Admin Panel (bee role required)
// The webapp's server.js verifies isBee from the session before forwarding, and
// adds an X-Admin-Secret header so the bot can confirm the request is legitimate.
// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

const requireAdminSecret = (req, res, next) => {
  const secret = process.env.ADMIN_API_SECRET;
  if (!secret || req.headers["x-admin-secret"] !== secret) {
    return res.status(403).json({ error: "Forbidden" });
  }
  next();
};

router.use("/admin", requireAdminSecret);

router.get("/admin/action-log", async (req, res) => {
  try {
    const requestedLimit = Number(req.query.limit ?? MAX_ACTION_LOG_ENTRIES);
    const limit = Number.isFinite(requestedLimit)
      ? Math.min(Math.max(Math.trunc(requestedLimit), 1), MAX_ACTION_LOG_ENTRIES)
      : MAX_ACTION_LOG_ENTRIES;

    const entries = await actionLogSchema
      .find({}, { action: 1, target: 1, details: 1, category: 1, timestamp: 1, actorId: 1 })
      .sort({ timestamp: -1, _id: -1 })
      .limit(limit)
      .lean();

    res.json(
      entries.map((entry) => ({
        id: String(entry._id),
        action: entry.action,
        target: entry.target,
        details: entry.details ?? undefined,
        category: entry.category,
        timestamp: entry.timestamp,
        actorId: entry.actorId ?? null,
      }))
    );
  } catch (error) {
    console.error("Error fetching action log:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/admin/action-log", async (req, res) => {
  try {
    const action = String(req.body?.action ?? "").trim();
    const target = String(req.body?.target ?? "").trim();
    const detailsRaw = req.body?.details;
    const details = typeof detailsRaw === "string" ? detailsRaw.trim() : "";
    const category = String(req.body?.category ?? "").trim().toLowerCase();

    if (!action || !target || !ACTION_LOG_CATEGORIES.has(category)) {
      return res.status(400).json({ error: "Invalid action log payload" });
    }

    await writeActionLog(req, { action, target, details, category });

    const created = await actionLogSchema
      .findOne({}, { action: 1, target: 1, details: 1, category: 1, timestamp: 1, actorId: 1 })
      .sort({ timestamp: -1, _id: -1 })
      .lean();

    if (!created) return res.status(500).json({ error: "Internal Server Error" });

    res.status(201).json({
      id: String(created._id),
      action: created.action,
      target: created.target,
      details: created.details ?? undefined,
      category: created.category,
      timestamp: created.timestamp,
      actorId: created.actorId ?? null,
    });
  } catch (error) {
    console.error("Error creating action log entry:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.delete("/admin/action-log", async (req, res) => {
  try {
    const actorId = getActorId(req);
    const ownerId = String(process.env.OWNER_ID ?? process.env.VITE_OWNER_ID ?? "").trim();
    const isOwnerFromProxy = String(req.headers["x-admin-is-owner"] ?? "").toLowerCase() === "true";
    const isOwnerById = !!actorId && /^\d{5,25}$/.test(actorId) && !!ownerId && actorId === ownerId;
    if (!isOwnerById && !isOwnerFromProxy) {
      return res.status(403).json({ error: "Forbidden" });
    }
    await actionLogSchema.deleteMany({});
    res.json({ success: true });
  } catch (error) {
    console.error("Error clearing action log:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Users — culvertSchema documents (keyed by Discord user ID)

const BEE_ROLE_ID = process.env.BEE_ROLE_ID;
const MEMBER_ROLE_ID = process.env.MEMBER_ROLE_ID;

router.get("/admin/users", async (req, res) => {
  try {
    const discordClient = req.app.get("client");
    const guild = discordClient?.guilds.cache.get(process.env.SAKU_GUILD_ID)
                  || await discordClient.guilds.fetch(process.env.SAKU_GUILD_ID).catch(() => null);

    // Load all DB records
    const dbUsers = await culvertSchema.find({}, { _id: 1, characters: 1 });

    // Resolve Discord member data: use cache first, then individual REST fetch for uncached IDs.
    // Individual guild.members.fetch(id) uses the REST API (not gateway opcode 8) so it
    // won't trigger the rate limit that a full guild.members.fetch() causes.
    const memberMap = new Map();
    if (guild) {
      const uncachedIds = [];
      for (const dbUser of dbUsers) {
        const userId = String(dbUser._id);
        const cached = guild.members.cache.get(userId);
        if (cached) {
          memberMap.set(userId, cached);
        } else {
          uncachedIds.push(userId);
        }
      }

      if (uncachedIds.length > 0) {
        await Promise.allSettled(
          uncachedIds.map(async (id) => {
            try {
              const member = await guild.members.fetch(id);
              memberMap.set(id, member);
            } catch {
              // Member may have left the guild — skip gracefully
            }
          })
        );
      }
    }

    const results = dbUsers.map((dbUser) => {
      const userId = String(dbUser._id);
      const member = memberMap.get(userId) ?? null;
      const role = member
        ? (member.roles.cache.has(BEE_ROLE_ID) ? "bee" : (member.roles.cache.has(MEMBER_ROLE_ID) ? "member" : null))
        : null;
      const avatarUrl = member ? member.displayAvatarURL({ extension: "webp", size: 128 }) : null;

      return {
        _id: userId,
        graphColor: dbUser?.characters?.[0]?.graphColor ?? "255,189,213",
        characters: dbUser?.characters ?? [],
        username: member?.user?.username ?? null,
        nickname: member?.nickname ?? null,
        joinedAt: member?.joinedAt?.toISOString() ?? null,
        role,
        avatarUrl,
      };
    });

    // Sort by username alphabetically (nulls last)
    results.sort((a, b) => {
      if (!a.username && !b.username) return 0;
      if (!a.username) return 1;
      if (!b.username) return -1;
      return a.username.localeCompare(b.username);
    });
    res.json(results);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.patch("/admin/users/:id", async (req, res) => {
  try {
    const { graphColor } = req.body;
    if (!isDiscordId(req.params.id)) return res.status(400).json({ error: "Invalid user id" });
    if (typeof graphColor !== "string" || !/^\d{1,3},\d{1,3},\d{1,3}$/.test(graphColor)) {
      return res.status(400).json({ error: "Invalid graph color" });
    }
    // Update graphColor on every character belonging to this user
    await culvertSchema.findByIdAndUpdate(req.params.id, { $set: { "characters.$[].graphColor": graphColor } });
    res.json({ success: true });
  } catch (error) {
    console.error("Error updating user:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.delete("/admin/users/:id", async (req, res) => {
  try {
    if (!isDiscordId(req.params.id)) return res.status(400).json({ error: "Invalid user id" });
    const username = String(req.query.username ?? "").trim();
    await culvertSchema.findByIdAndDelete(req.params.id);
    await writeActionLog(req, {
      action: "Delete User",
      target: username || String(req.params.id),
      category: "delete",
    });
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Fetch a single guild member by Discord ID — server avatar + nickname, no role filter
router.get("/admin/member/:id", async (req, res) => {
  try {
    const discordClient = req.app.get("client");
    
    // 1. Fetch the guild instead of just checking cache
    const guild = discordClient.guilds.cache.get(process.env.SAKU_GUILD_ID) 
                  || await discordClient.guilds.fetch(process.env.SAKU_GUILD_ID).catch(() => null);

    if (!guild) return res.status(503).json({ error: "Guild not found/unavailable" });

    // 2. Use member.fetch() directly - it's more reliable than the cache check
    const member = await guild.members.fetch(req.params.id).catch(() => null);

    if (!member) return res.status(404).json({ error: "Member not found in this guild" });

    // 3. Robust Avatar Logic: Server Avatar -> Global Avatar -> Default Blurple
    const avatarUrl = member.displayAvatarURL({ extension: "png", size: 256 });

    const role = member.roles.cache.has(BEE_ROLE_ID) ? "bee" : "member";
    res.json({
      _id: req.params.id,
      username: member.user.username,
      nickname: member.nickname || member.user.globalName || member.user.username,
      joinedAt: member.joinedAt?.toISOString() ?? null,
      role,
      avatarUrl,
    });
  } catch (error) {
    console.error("Error fetching member:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// List all guild members (for autocomplete)

router.get("/admin/guild-members", async (req, res) => {
  try {
    const discordClient = req.app.get("client");
    const guild = discordClient?.guilds.cache.get(process.env.SAKU_GUILD_ID)
                  || await discordClient.guilds.fetch(process.env.SAKU_GUILD_ID).catch(() => null);

    if (!guild) return res.status(503).json({ error: "Guild not available" });

    const members = await guild.members.fetch();
    const list = members
      .filter((m) => !m.user.bot)
      .map((m) => ({
        id: m.id,
        username: m.user.username,
        nickname: m.nickname || m.user.globalName || m.user.username,
        avatarUrl: m.displayAvatarURL({ extension: "webp", forceStatic: true, size: 64 }),
      }));

    list.sort((a, b) => (a.nickname ?? a.username).localeCompare(b.nickname ?? b.username));
    res.json(list);
  } catch (error) {
    console.error("Error fetching guild members:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Characters — sub-documents embedded in culvertSchema

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
    console.error("Error creating character:", error);
    res.status(500).json({ error: "Internal Server Error" });
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
        const rankingsRes = await axios.get(
          `https://www.nexon.com/api/maplestory/no-auth/ranking/v2/na?type=overall&id=legendary&reboot_index=1&page_index=1&character_name=${encodeURIComponent(nextName)}`
        );
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
    console.error("Error updating character:", error);
    res.status(500).json({ error: "Internal Server Error" });
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
    console.error("Error transferring character:", error);
    res.status(500).json({ error: "Internal Server Error" });
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
    console.error("Error batch unlinking characters:", error);
    res.status(500).json({ error: "Internal Server Error" });
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
    console.error("Error deleting character:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Scores — embedded in characters within culvertSchema

router.get("/admin/scores/:character", async (req, res) => {
  try {
    const safeCharacter = escapeRegex(req.params.character);
    const user = await culvertSchema.findOne(
      { "characters.name": { $regex: `^${safeCharacter}$`, $options: "i" } },
      { "characters.$": 1 }
    );
    res.json(user?.characters[0]?.scores ?? []);
  } catch (error) {
    console.error("Error fetching scores:", error);
    res.status(500).json({ error: "Internal Server Error" });
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
      { "characters.name": { $regex: `^${safeCharacter}$`, $options: "i" } },
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
    console.error("Error adding score:", error);
    res.status(500).json({ error: "Internal Server Error" });
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
    const existingDoc = await culvertSchema.findOne(
      {
        "characters.name": { $regex: `^${safeCharacter}$`, $options: "i" },
        "characters.scores.date": safeDate,
      },
      { "characters.$": 1 }
    ).lean();
    const existingScore = existingDoc?.characters?.[0]?.scores?.find((s) => s.date === safeDate);

    await culvertSchema.findOneAndUpdate(
      {
        "characters.name": { $regex: `^${safeCharacter}$`, $options: "i" },
        "characters.scores.date": safeDate,
      },
      { $set: { "characters.$[c].scores.$[s].score": score } },
      { arrayFilters: [{ "c.name": { $regex: `^${safeCharacter}$`, $options: "i" } }, { "s.date": safeDate }] }
    );
    await writeActionLog(req, {
      action: "Edit Score",
      target: String(req.params.character),
      details: `Score updated from ${Number(existingScore?.score ?? 0)} to ${score}`,
      category: "edit",
    });
    res.json({ success: true });
  } catch (error) {
    console.error("Error updating score:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.delete("/admin/scores/:character/:date(\\d{4}-\\d{2}-\\d{2})", async (req, res) => {
  try {
    const safeCharacter = escapeRegex(req.params.character);
    const safeDate = String(req.params.date ?? "").trim();
    if (!isIsoDate(safeDate)) return res.status(400).json({ error: "Invalid score date" });

    const existingDoc = await culvertSchema.findOne(
      {
        "characters.name": { $regex: `^${safeCharacter}$`, $options: "i" },
        "characters.scores.date": safeDate,
      },
      { "characters.$": 1 }
    ).lean();
    const existingScore = existingDoc?.characters?.[0]?.scores?.find((s) => s.date === safeDate);

    await culvertSchema.findOneAndUpdate(
      { "characters.name": { $regex: `^${safeCharacter}$`, $options: "i" } },
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
    console.error("Error deleting score:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// By-ID score routes — used for scores that have a Mongoose-generated _id.
// These are unambiguous and safer than using date as a key.

router.patch("/admin/scores/by-id/:scoreId", async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.scoreId)) {
      return res.status(400).json({ error: "Invalid score id" });
    }
    const scoreId = new mongoose.Types.ObjectId(req.params.scoreId);
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
    console.error("Error updating score by id:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.delete("/admin/scores/by-id/:scoreId", async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.scoreId)) {
      return res.status(400).json({ error: "Invalid score id" });
    }
    const scoreId = new mongoose.Types.ObjectId(req.params.scoreId);

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
    console.error("Error deleting score by id:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Exceptions — exceptionSchema documents

router.get("/admin/exceptions", async (req, res) => {
  try {
    const exceptions = await exceptionSchema.find();
    res.json(exceptions);
  } catch (error) {
    console.error("Error fetching exceptions:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/admin/exceptions", async (req, res) => {
  try {
    const name = String(req.body?.name ?? "").trim();
    const exception = String(req.body?.exception ?? "").trim();
    if (!name) return res.status(400).json({ error: "Name is required" });
    await exceptionSchema.create({ name, exception });
    await writeActionLog(req, {
      action: "Create Exception",
      target: name,
      details: `Character: ${name} | Exception: ${exception}`,
      category: "create",
    });
    res.json({ success: true });
  } catch (error) {
    console.error("Error creating exception:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.patch("/admin/exceptions/:id", async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: "Invalid exception id" });
    }
    const name = String(req.body?.name ?? "").trim();
    const exception = String(req.body?.exception ?? "").trim();
    if (!name) return res.status(400).json({ error: "Name is required" });
    const existing = await exceptionSchema.findById(req.params.id, { name: 1, exception: 1 }).lean();
    if (!existing) return res.status(404).json({ error: "Exception not found" });
    await exceptionSchema.findByIdAndUpdate(req.params.id, { $set: { name, exception } });

    const nameChanged = existing.name !== name;
    const exceptionChanged = existing.exception !== exception;

    const detailsParts = [];
    if (nameChanged) detailsParts.push(`Character updated from ${existing.name} to ${name}`);
    if (exceptionChanged) detailsParts.push(`Exception updated from ${existing.exception} to ${exception}`);
    const details = detailsParts.join(" | ") || "Exception updated";

    await writeActionLog(req, {
      action: "Edit Exception",
      target: existing.name,
      details,
      category: "edit",
    });
    res.json({ success: true });
  } catch (error) {
    console.error("Error updating exception:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.delete("/admin/exceptions/:id", async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: "Invalid exception id" });
    }
    const existing = await exceptionSchema.findById(req.params.id, { name: 1, exception: 1 }).lean();
    await exceptionSchema.findByIdAndDelete(req.params.id);
    await writeActionLog(req, {
      action: "Delete Exception",
      target: existing?.name ?? String(req.params.id),
      details: `Deleted exception ${existing?.exception ?? "unknown"} for character ${existing?.name ?? String(req.params.id)}`,
      category: "delete",
    });
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting exception:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //
// Scanner routes

const { GoogleGenerativeAI } = require("@google/generative-ai");
const { getAllCharacters, isScoreSubmitted, getResetDates } = require("../utility/culvertUtils.js");
const dayjs = require("dayjs");

/**
 * Normalize confusable characters for better name matching (same as scan command).
 */
function normalizeConfusableChars(str) {
  return str
    .replace(/[Il1|]/g, "i")
    .replace(/[O0]/g, "o");
}

// Short-lived cache for scan base data — coalesces concurrent parallel scan requests
// (e.g. 5 images dispatched at once) into a single DB round-trip instead of N duplicates.
let _scanDataCache = null;
let _scanDataCacheTime = 0;
const SCAN_CACHE_TTL_MS = 10_000;

function getScanBaseData() {
  const now = Date.now();
  if (_scanDataCache && now - _scanDataCacheTime < SCAN_CACHE_TTL_MS) {
    return _scanDataCache;
  }
  _scanDataCacheTime = now;
  _scanDataCache = Promise.all([
    culvertSchema.find({}, { characters: 1, _id: 1 }).lean(),
    exceptionSchema.find({}).lean(),
  ]).catch((err) => {
    // On error clear cache so next request retries
    _scanDataCache = null;
    throw err;
  });
  return _scanDataCache;
}

/**
 * POST /admin/scanner/scan
 * Body: { image: { data: base64, mimeType: string }, week: "this_week" | "last_week" }
 * Processes a single image and returns results.
 */
router.post("/admin/scanner/scan", async (req, res) => {
  try {
    const { image, week } = req.body;
    if (!image || !image.data) {
      return res.status(400).json({ error: "No image provided" });
    }

    const { lastReset, reset } = getResetDates();
    const selectedWeek = week === "this_week" ? reset : lastReset;

    // Fetch all character data (with discordIds) and exceptions in parallel.
    // Building in-memory lookup maps eliminates N individual DB queries per scan.
    // getScanBaseData() caches the result briefly to serve all concurrent images from one DB read.
    const [allUsers, exceptions] = await getScanBaseData();

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

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-image-preview" });

    const prompt = `Analyze this MapleStory guild culvert participation screenshot.

Perform a precise horizontal scan of each row to link the 'Character Name' (Leftmost Column) with the 'Culvert Score' (Rightmost Column).

Rules:
- Spatial Mapping: Treat the first text string as 'CharacterName' and the final integer in the row as 'Score'.
- Ignore Context: Skip all middle columns (Class, Level, World, Guild).
- Data Integrity: If a score is missing or obscured, default to 0.
- Character Encoding: Preserve all special characters and symbols (ö, á, etc.) exactly as rendered.
- Formatting: Return ONLY 'CharacterName Score' (space-separated), one per line. No headers, no intro text.
- Ellipsis Truncation: If a character name contains an ellipsis (..), treat the ellipsis as the end of the name.
- Strict Column Separation: Do not include any text that follows an ellipsis (e.g., if you see heatherhah..Dawn, the name is just heatherhah).
- Integer Only Scores: Output the culvert score as a raw integer with no commas or symbols (e.g., 216993 instead of 216,993).

Example output:
PlayerName1 63100
PlayerName2 62918
PlayerName3 0`;

    let entryArray;
    try {
      const result = await model.generateContent([
        { inlineData: { data: image.data, mimeType: image.mimeType || "image/png" } },
        prompt,
      ]);
      const response = await result.response;
      const text = response.text();
      entryArray = text.trim().split(/\r?\n/);
    } catch (error) {
      console.error("Gemini API Error:", error);
      return res.status(502).json({ error: "Failed to analyze image with Gemini AI" });
    }

    // Parse entries
    const validScores = [];
    const NaNScores = [];
    const zeroScores = [];
    const notFoundChars = [];
    let totalSuccess = 0;
    let totalFailure = 0;

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

      if (character && dayjs(character.memberSince).isBefore(dayjs(selectedWeek).add(1, "week"))) {
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
        totalFailure++;
        notFoundChars.push({ name: validCharacter.name, discordId: userDiscordId });
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
      notFound: notFoundChars.map((nf) => ({ name: nf.name })),
      nanScores: NaNScores.map((n) => ({ name: n.name })),
      zeroScores: zeroScores.map((z) => ({ name: z.name })),
      totalSuccess,
      totalFailure,
      totalScanned: validScores.length,
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

    for (const m of matched) {
      if (m.isNaN) {
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

    for (const anomaly of anomalies) {
      parts.push(`${anomaly.name} (Score Anomaly): ${anomaly.score} above previous ${anomaly.previousScore}`);
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
    const selectedWeek = week === "this_week" ? reset : lastReset;

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

    const summaryLine = missedCharacters.length > 0
      ? `${submitted}/${total} scores submitted for week of ${selectedWeek}`
      : `All scores submitted for week of ${selectedWeek}`;

    const weekLabel = week === "this_week" ? `This Week (${selectedWeek})` : `Last Week (${selectedWeek})`;
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
      { week: selectedWeek, finalized: true, override: overrideUsed, submitted, total, scores: scoresSnapshot },
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

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //
// Weeks routes

/**
 * GET /admin/weeks
 * Returns all week records ordered by date descending.
 */
router.get("/admin/weeks", async (req, res) => {
  try {
    const weeks = await weekSchema
      .find({}, "week finalized override submitted total")
      .sort({ week: -1 })
      .lean();
    res.json({ weeks });
  } catch (error) {
    console.error("Weeks list error:", error);
    res.status(500).json({ error: "Failed to list weeks" });
  }
});

/**
 * GET /admin/weeks/:date
 * Returns the full week record including the scores snapshot.
 */
router.get("/admin/weeks/:date(\\d{4}-\\d{2}-\\d{2})", async (req, res) => {
  try {
    const { date } = req.params;
    const weekRecord = await weekSchema.findOne({ week: date }).lean();
    if (!weekRecord) return res.status(404).json({ error: "Week not found" });
    res.json(weekRecord);
  } catch (error) {
    console.error("Week detail error:", error);
    res.status(500).json({ error: "Failed to get week" });
  }
});

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //
// Backups routes

/**
 * GET /admin/backups
 * Returns a list of all saved backup files.
 */
router.get("/admin/backups", (req, res) => {
  try {
    if (!fs.existsSync(BACKUPS_DIR)) return res.json({ backups: [] });

    const backups = fs
      .readdirSync(BACKUPS_DIR)
      .filter((f) => f.endsWith(".json"))
      .map((filename) => {
        const stat = fs.statSync(path.join(BACKUPS_DIR, filename));
        return { filename, createdAt: stat.mtime.toISOString(), size: stat.size };
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json({ backups });
  } catch (error) {
    console.error("Backups list error:", error);
    res.status(500).json({ error: "Failed to list backups" });
  }
});

/**
 * GET /admin/backups/:filename
 * Returns the parsed JSON content of a single backup file.
 */
router.get("/admin/backups/:filename", (req, res) => {
  try {
    const { filename } = req.params;
    if (!/^saku_culvert_[\d-]+_\d+\.json$/.test(filename)) {
      return res.status(400).json({ error: "Invalid filename" });
    }
    const filePath = path.join(BACKUPS_DIR, filename);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: "Backup not found" });
    const content = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    res.json({ filename, content });
  } catch (error) {
    console.error("Backup read error:", error);
    res.status(500).json({ error: "Failed to read backup" });
  }
});

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

module.exports = router;
