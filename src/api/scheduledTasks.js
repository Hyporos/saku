const express = require("express");

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //
// Cron job status and the DST toggle.

const router = express.Router();

// Scheduled Tasks

router.get("/admin/scheduled-tasks", (req, res) => {
  const registry = req.app.get("cronRegistry");
  if (!registry) return res.status(503).json({ error: "Cron registry not available" });

  const offset = registry.getDstOffset();
  const tasks = registry.getDefinitions().map((def) => ({
    id:           def.id,
    name:         def.name,
    channelName:  def.channelName,
    category:     def.category,
    description:  def.description,
    baseHour:     def.baseHour,
    baseMinute:   def.baseMinute ?? 0,
    days:         def.days,
    effectiveHour: def.baseHour + offset,
    effectiveMinute: def.baseMinute ?? 0,
    nextRun:      registry.computeNextRun(def),
  }));

  res.json({ dstOffset: offset, tasks });
});

router.patch("/admin/scheduled-tasks/dst", (req, res) => {
  const registry = req.app.get("cronRegistry");
  if (!registry) return res.status(503).json({ error: "Cron registry not available" });

  const { dstOffset } = req.body;
  if (dstOffset !== 0 && dstOffset !== 1) {
    return res.status(400).json({ error: "dstOffset must be 0 or 1" });
  }

  const isOwnerFromProxy = String(req.headers["x-admin-is-owner"] ?? "").toLowerCase() === "true";
  if (!isOwnerFromProxy) return res.status(403).json({ error: "Only the bot owner can change DST settings" });

  registry.setDstOffset(dstOffset);
  res.json({ dstOffset });
});

module.exports = router;
