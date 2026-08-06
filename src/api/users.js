const express = require("express");
const culvertSchema = require("../schemas/culvertSchema.js");
const { escapeRegex, isDiscordId, writeActionLog } = require("./shared.js");

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //
// Guild members and their linked accounts.

const router = express.Router();

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

module.exports = router;
