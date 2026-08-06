const express = require("express");
const axios = require("axios");
const culvertSchema = require("../schemas/culvertSchema.js");
const { escapeRegex } = require("./shared.js");

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //
// Read-only lookups the webapp uses to render public pages.

const router = express.Router();

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

// Get all character names linked to a Discord user ID
router.get("/user/:id", async (req, res) => {
  try {
    const userId = String(req.params.id ?? "").trim();
    if (!userId) return res.status(400).json({ error: "User ID required" });
    const user = await culvertSchema.findById(userId, { "characters.name": 1 }).lean();
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({ characters: (user.characters ?? []).map((c) => c.name) });
  } catch (error) {
    console.error("Error fetching user characters:", error);
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

module.exports = router;
