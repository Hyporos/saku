const express = require("express");
const culvertSchema = require("../schemas/culvertSchema.js");
const userSchema = require("../schemas/userSchema.js");
const { isDiscordId, writeActionLog, fail, getGuild } = require("./shared.js");
const { ROLES } = require("../config/ids.js");

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //
// Guild members and their linked accounts.

const router = express.Router();

// Users — culvertSchema documents (keyed by Discord user ID)

// Read from the id table rather than the environment: an unset BEE_ROLE_ID made `roles.cache.has`
// take undefined, which is never a hit, so every bee quietly rendered in the panel as a plain member.

router.get("/admin/users", async (req, res) => {
  try {
    const guild = await getGuild(req);

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
        ? (member.roles.cache.has(ROLES.BEE) ? "bee" : (member.roles.cache.has(ROLES.MEMBER) ? "member" : null))
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
    fail(res, error, "fetching users");
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
    fail(res, error, "updating user");
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
    fail(res, error, "deleting user");
  }
});

// Fetch a single guild member by Discord ID — server avatar + nickname, no role filter
router.get("/admin/member/:id", async (req, res) => {
  try {
    const guild = await getGuild(req);

    if (!guild) return res.status(503).json({ error: "Guild not found/unavailable" });

    // 2. Use member.fetch() directly - it's more reliable than the cache check
    const member = await guild.members.fetch(req.params.id).catch(() => null);

    if (!member) return res.status(404).json({ error: "Member not found in this guild" });

    // 3. Robust Avatar Logic: Server Avatar -> Global Avatar -> Default Blurple
    const avatarUrl = member.displayAvatarURL({ extension: "png", size: 256 });

    // Only the month is stored — /birthday never asks for a day, because birthdays are announced
    // together on the 1st and the day was never used for anything.
    const stored = await userSchema.findById(req.params.id, { birthdayMonth: 1 }).lean();

    const role = member.roles.cache.has(ROLES.BEE) ? "bee" : "member";
    res.json({
      _id: req.params.id,
      username: member.user.username,
      nickname: member.nickname || member.user.globalName || member.user.username,
      joinedAt: member.joinedAt?.toISOString() ?? null,
      birthdayMonth: stored?.birthdayMonth ?? null,
      role,
      avatarUrl,
    });
  } catch (error) {
    fail(res, error, "fetching member");
  }
});

// List all guild members (for autocomplete)

router.get("/admin/guild-members", async (req, res) => {
  try {
    const guild = await getGuild(req);

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
    fail(res, error, "fetching guild members");
  }
});

// Characters — sub-documents embedded in culvertSchema

module.exports = router;
