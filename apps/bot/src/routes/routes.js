const culvertSchema = require("../schemas/culvertSchema.js");
const exceptionSchema = require("../schemas/exceptionSchema.js");
const actionLogSchema = require("../schemas/actionLogSchema.js");
const express = require("express");
const axios = require("axios");
const mongoose = require("mongoose");

const router = express.Router();
const MAX_ACTION_LOG_ENTRIES = 500;
const ACTION_LOG_CATEGORIES = new Set(["create", "edit", "delete", "transfer", "rename"]);
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
        avatarUrl: m.displayAvatarURL({ extension: "webp", size: 64 }),
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
          : undefined,
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
        : undefined,
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
    const characterList = await getAllCharacters();
    const exceptions = await exceptionSchema.find({});

    // Init Gemini AI
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

      if (matchingNames.length > 1) {
        for (const duplicateName of matchingNames) {
          const searchName = isTruncated ? truncatedPrefix.toLowerCase() : validCharacter.name.toLowerCase();
          const normalizedDuplicate = normalizeConfusableChars(duplicateName);
          const normalizedSearch = normalizeConfusableChars(searchName);

          if (isTruncated) {
            if (normalizedDuplicate.startsWith(normalizedSearch)) {
              const user = await culvertSchema.findOne(
                { "characters.name": { $regex: `^${duplicateName}$`, $options: "i" } },
                { "characters.$": 1, _id: 1 }
              );
              character = user?.characters[0];
              userDiscordId = user?._id;
              break;
            }
          } else if (normalizedDuplicate.includes(normalizedSearch)) {
            const user = await culvertSchema.findOne(
              { "characters.name": { $regex: `^${duplicateName}$`, $options: "i" } },
              { "characters.$": 1, _id: 1 }
            );
            character = user?.characters[0];
            userDiscordId = user?._id;
          }
        }
      } else if (matchingNames.length === 1) {
        if (isTruncated) {
          const user = await culvertSchema.findOne(
            { "characters.name": { $regex: `^${matchingNames[0]}$`, $options: "i" } },
            { "characters.$": 1, _id: 1 }
          );
          character = user?.characters[0];
          userDiscordId = user?._id;
        } else {
          const namePattern = `${nameBeginning}|${nameEnd}`;
          const user = await culvertSchema.findOne(
            { "characters.name": { $regex: `^${namePattern}$`, $options: "i" } },
            { "characters.$": 1, _id: 1 }
          );
          character = user?.characters[0];
          userDiscordId = user?._id;
        }
      }

      if (character && dayjs(character.memberSince).isBefore(dayjs(selectedWeek).add(1, "week"))) {
        totalSuccess++;
        const scoreExists = await isScoreSubmitted(character.name, selectedWeek);
        const oldName = validCharacter.name;
        validCharacter.name = character.name;
        validCharacter.discordId = userDiscordId;

        const nanEntry = NaNScores.find((n) => n.name === oldName || n.name === character.name);
        if (nanEntry) { nanEntry.name = character.name; nanEntry.discordId = userDiscordId; }
        const zeroEntry = zeroScores.find((z) => z.name === oldName || z.name === character.name);
        if (zeroEntry) { zeroEntry.name = character.name; zeroEntry.discordId = userDiscordId; }

        if (!scoreExists) {
          await culvertSchema.findOneAndUpdate(
            { "characters.name": validCharacter.name },
            { $addToSet: { "characters.$[nameElem].scores": { score: !isNaN(validCharacter.score) ? validCharacter.score : 0, date: selectedWeek } } },
            { arrayFilters: [{ "nameElem.name": character.name }], new: true }
          );
        } else {
          await culvertSchema.findOneAndUpdate(
            { "characters.name": character.name, "characters.scores.date": selectedWeek },
            { $set: { "characters.$[nameElem].scores.$[dateElem].score": !isNaN(validCharacter.score) ? validCharacter.score : 0 } },
            { arrayFilters: [{ "nameElem.name": character.name }, { "dateElem.date": selectedWeek }], new: true }
          );
        }

        const sortedScores = [...character.scores].sort((a, b) => b.score - a.score);
        const bestScore = sortedScores[0]?.score || 0;
        if (validCharacter.score !== 0 && !isNaN(validCharacter.score) && validCharacter.score < bestScore * 0.85) {
          validCharacter.sandbag = true;
        }
      } else {
        totalFailure++;
        notFoundChars.push({ name: validCharacter.name, discordId: userDiscordId });
      }
    }

    // Build result
    const successEntries = validScores
      .filter((v) => !notFoundChars.some((nf) => nf.name === v.name))
      .map((v) => ({
        name: v.name,
        score: v.score,
        sandbag: v.sandbag,
        isNaN: NaNScores.some((n) => n.name === v.name),
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
    const { week, imageCount, totalSuccess, totalFailure } = req.body;
    await writeActionLog(req, {
      action: "Scan Scores",
      target: `${week}`,
      details: `Scanned ${imageCount} image${imageCount !== 1 ? "s" : ""} | ${totalSuccess} matched | ${totalFailure} not found | Week: ${week}`,
      category: "create",
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
    const backupBase64 = Buffer.from(jsonData, "utf-8").toString("base64");

    await writeActionLog(req, {
      action: "Finalize Scores",
      target: `${selectedWeek}`,
      details: `${missedCharacters.length > 0
        ? `${allCharacters.length - missedCharacters.length}/${allCharacters.length} scores`
        : "All scores"
      } submitted for week of ${selectedWeek}`,
      category: "create",
    });

    res.json({
      success: true,
      missedCharacters,
      total: allCharacters.length,
      submitted: allCharacters.length - missedCharacters.length,
      week: selectedWeek,
      backup: backupBase64,
      backupFilename: `culvert-${selectedWeek}.json`,
    });
  } catch (error) {
    console.error("Finalize error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

module.exports = router;
