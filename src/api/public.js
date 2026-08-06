const express = require("express");
const axios = require("axios");
const culvertSchema = require("../schemas/culvertSchema.js");
const { RANKINGS_URL } = require("../domain/culvert/utils.js");
const { escapeRegex, fail } = require("./shared.js");

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //
// Read-only lookups the webapp uses to render public pages.

const router = express.Router();

// Get all Method
router.get("/getAll", async (req, res) => {
  try {
    const culverts = await culvertSchema.find();
    res.json(culverts);
  } catch (error) {
    fail(res, error, "fetching culverts");
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
    fail(res, error, "fetching culverts");
  }
});

// Get all character names linked to a Discord user ID
router.get("/user/:id", async (req, res) => {
  try {
    const userId = String(req.params.id ?? "").trim();
    if (!userId) return res.status(400).json({ error: "User ID required" });
    const user = await culvertSchema.findById(userId, { "characters.name": 1 }).lean();
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({ characters: (user.characters ?? []).map((c) => c.name) });
  } catch (error) {
    fail(res, error, "fetching user characters");
  }
});

// Get character info from MapleStory rankings
router.get("/rankings/:name", async (req, res) => {
  try {
    const characterName = String(req.params.name ?? "").trim();
    if (!characterName) return res.status(400).json({ error: "Character name is required" });
    const response = await axios.get(RANKINGS_URL(characterName));

    // The API answers 200 with an empty `ranks` for a name that does not exist. Reading [0] straight
    // out of it threw, which the catch below reported as a 500 — a server fault for what is really
    // just a character nobody has ranked.
    const rank = response.data?.ranks?.[0];
    if (!rank) return res.status(404).json({ error: "Character not found on the rankings" });

    res.json({
      characterImgURL: rank.characterImgURL ?? null,
      level: rank.level ?? null,
      characterClassName: rank.characterClassName ?? null,
    });
  } catch (error) {
    fail(res, error, "fetching character");
  }
});

module.exports = router;
