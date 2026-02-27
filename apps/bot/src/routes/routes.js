const culvertSchema = require("../schemas/culvertSchema.js");
const exceptionSchema = require("../schemas/exceptionSchema.js");
const express = require("express");
const axios = require("axios");
const mongoose = require("mongoose");

const router = express.Router();

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
    const user = await culvertSchema.findOne(
      {
        "characters.name": { $regex: `^${req.params.name}$`, $options: "i" },
      },
      { "characters.$": 1 }
    );
    res.json(user.characters[0]);
  } catch (error) {
    console.error("Error fetching culverts:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Get character info from MapleStory rankings
router.get("/rankings/:name", async (req, res) => {
  try {
    const response = await axios.get(
      `https://www.nexon.com/api/maplestory/no-auth/ranking/v2/na?type=overall&id=legendary&reboot_index=1&page_index=1&character_name=${req.params.name}`
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

// Users — culvertSchema documents (keyed by Discord user ID)

const BEE_ROLE_ID = process.env.BEE_ROLE_ID;
const MEMBER_ROLE_ID = process.env.MEMBER_ROLE_ID;

router.get("/admin/users", async (req, res) => {
  try {
    const discordClient = req.app.get("client");
    const guild = discordClient?.guilds.cache.get(process.env.SAKU_GUILD_ID)
                  || await discordClient.guilds.fetch(process.env.SAKU_GUILD_ID).catch(() => null);

    if (!guild) return res.status(503).json({ error: "Guild not found" });

    // Fetch all guild members, filter to Member/Bee role holders
    const allMembers = await guild.members.fetch();
    const relevantMembers = allMembers.filter(
      (m) => m.roles.cache.has(MEMBER_ROLE_ID) || m.roles.cache.has(BEE_ROLE_ID)
    );

    // Load all DB records at once and key by Discord ID
    const dbUsers = await culvertSchema.find({}, { _id: 1, characters: 1 });
    const dbMap = new Map(dbUsers.map((u) => [String(u._id), u]));

    const results = relevantMembers.map((member) => {
      const dbUser = dbMap.get(String(member.id));
      const role = member.roles.cache.has(BEE_ROLE_ID) ? "bee" : "member";
      const avatarUrl = member.displayAvatarURL({ extension: "webp", size: 128 });
      return {
        _id: String(member.id),
        graphColor: dbUser?.characters?.[0]?.graphColor ?? "255,189,213",
        characters: dbUser?.characters ?? [],
        username: member.user.username,
        nickname: member.nickname || null,
        joinedAt: member.joinedAt?.toISOString() ?? null,
        role,
        avatarUrl,
      };
    });

    // Sort by username alphabetically
    results.sort((a, b) => (a.username ?? "").localeCompare(b.username ?? ""));
    res.json(results);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.patch("/admin/users/:id", async (req, res) => {
  try {
    const { graphColor } = req.body;
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
    await culvertSchema.findByIdAndDelete(req.params.id);
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

// Characters — sub-documents embedded in culvertSchema

router.post("/admin/characters", async (req, res) => {
  try {
    const { userId, name, memberSince, avatar } = req.body;
    await culvertSchema.findByIdAndUpdate(userId, {
      $push: { characters: { name, memberSince, avatar: avatar || "", graphColor: "255,189,213", scores: [] } },
    });
    res.json({ success: true });
  } catch (error) {
    console.error("Error creating character:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.patch("/admin/characters/:userId/:name", async (req, res) => {
  try {
    const { name, memberSince, avatar } = req.body;
    await culvertSchema.findOneAndUpdate(
      { _id: req.params.userId, "characters.name": { $regex: `^${req.params.name}$`, $options: "i" } },
      {
        $set: {
          "characters.$.name": name,
          "characters.$.memberSince": memberSince,
          "characters.$.avatar": avatar,
        },
      }
    );
    res.json({ success: true });
  } catch (error) {
    console.error("Error updating character:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/admin/characters/transfer", async (req, res) => {
  try {
    const { fromUserId, characterName, toUserId, deleteSource } = req.body;

    // Find the character in the source user's document
    const sourceDoc = await culvertSchema.findOne(
      { _id: fromUserId, "characters.name": { $regex: `^${characterName}$`, $options: "i" } },
      { "characters.$": 1 }
    );
    if (!sourceDoc?.characters?.[0]) {
      return res.status(404).json({ error: "Character not found" });
    }
    const character = sourceDoc.characters[0].toObject();

    // Push the character into the destination user (upsert if they have no DB doc yet)
    await culvertSchema.findByIdAndUpdate(
      toUserId,
      { $addToSet: { characters: character } },
      { upsert: true }
    );

    // Remove the character from the source user
    await culvertSchema.findByIdAndUpdate(fromUserId, {
      $pull: { characters: { name: { $regex: `^${characterName}$`, $options: "i" } } },
    });

    if (deleteSource) {
      // Checkbox checked — delete the source user document regardless of remaining characters
      await culvertSchema.deleteOne({ _id: fromUserId });
    } else {
      // Silently clean up if the source user now has no characters left
      await culvertSchema.deleteOne({ _id: fromUserId, characters: { $size: 0 } });
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Error transferring character:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.delete("/admin/characters/:userId/:name", async (req, res) => {
  try {
    await culvertSchema.findByIdAndUpdate(req.params.userId, {
      $pull: { characters: { name: { $regex: `^${req.params.name}$`, $options: "i" } } },
    });

    // Delete the user document entirely if they have no more characters
    await culvertSchema.deleteOne({ _id: req.params.userId, characters: { $size: 0 } });

    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting character:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Scores — embedded in characters within culvertSchema

router.get("/admin/scores/:character", async (req, res) => {
  try {
    const user = await culvertSchema.findOne(
      { "characters.name": { $regex: `^${req.params.character}$`, $options: "i" } },
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
    const { character, date, score } = req.body;
    await culvertSchema.findOneAndUpdate(
      { "characters.name": { $regex: `^${character}$`, $options: "i" } },
      { $push: { "characters.$.scores": { date, score } } }
    );
    res.json({ success: true });
  } catch (error) {
    console.error("Error adding score:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.patch("/admin/scores/:character/:date", async (req, res) => {
  try {
    const { score } = req.body;
    await culvertSchema.findOneAndUpdate(
      {
        "characters.name": { $regex: `^${req.params.character}$`, $options: "i" },
        "characters.scores.date": req.params.date,
      },
      { $set: { "characters.$[c].scores.$[s].score": score } },
      { arrayFilters: [{ "c.name": req.params.character }, { "s.date": req.params.date }] }
    );
    res.json({ success: true });
  } catch (error) {
    console.error("Error updating score:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.delete("/admin/scores/:character/:date", async (req, res) => {
  try {
    await culvertSchema.findOneAndUpdate(
      { "characters.name": { $regex: `^${req.params.character}$`, $options: "i" } },
      { $pull: { "characters.$.scores": { date: req.params.date } } }
    );
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
    const scoreId = new mongoose.Types.ObjectId(req.params.scoreId);
    const { score } = req.body;
    await culvertSchema.findOneAndUpdate(
      { "characters.scores._id": scoreId },
      { $set: { "characters.$[].scores.$[s].score": score } },
      { arrayFilters: [{ "s._id": scoreId }] }
    );
    res.json({ success: true });
  } catch (error) {
    console.error("Error updating score by id:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.delete("/admin/scores/by-id/:scoreId", async (req, res) => {
  try {
    const scoreId = new mongoose.Types.ObjectId(req.params.scoreId);
    await culvertSchema.findOneAndUpdate(
      { "characters.scores._id": scoreId },
      { $pull: { "characters.$[c].scores": { _id: scoreId } } },
      { arrayFilters: [{ "c.scores._id": scoreId }] }
    );
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
    const { name, exception } = req.body;
    await exceptionSchema.create({ name, exception });
    res.json({ success: true });
  } catch (error) {
    console.error("Error creating exception:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.patch("/admin/exceptions/:id", async (req, res) => {
  try {
    const { name, exception } = req.body;
    await exceptionSchema.findByIdAndUpdate(req.params.id, { $set: { name, exception } });
    res.json({ success: true });
  } catch (error) {
    console.error("Error updating exception:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.delete("/admin/exceptions/:id", async (req, res) => {
  try {
    await exceptionSchema.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting exception:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

module.exports = router;
