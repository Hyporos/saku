const express = require("express");
const weekSchema = require("../schemas/weekSchema.js");

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //
// Finalized week snapshots.

const router = express.Router();

/**
 * GET /admin/weeks
 * Returns all week records ordered by date descending.
 */
router.get("/admin/weeks", async (req, res) => {
  try {
    const weeks = await weekSchema
      .find({}, "week finalized override submitted total finalizedAt")
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

module.exports = router;
