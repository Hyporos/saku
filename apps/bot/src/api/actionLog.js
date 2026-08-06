const express = require("express");
const actionLogSchema = require("../schemas/actionLogSchema.js");
const { MAX_ACTION_LOG_ENTRIES, ACTION_LOG_CATEGORIES, getActorId, writeActionLog, fail, isDiscordId } = require("./shared.js");
const { isOwner } = require("../config/ids.js");

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //
// The audit trail: what changed, who changed it, and undo snapshots.

const router = express.Router();

// The secret is already enforced for every route further up; what still matters here is that the
// webapp verified the caller's bee role before forwarding, and passed who they are in x-admin-*.

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
    fail(res, error, "fetching action log");
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
    fail(res, error, "creating action log entry");
  }
});

router.delete("/admin/action-log", async (req, res) => {
  try {
    const actorId = getActorId(req);
    // From the id table rather than the environment: an unset OWNER_ID left ownerId empty, which
    // failed the check below and made this route reachable only via the proxy's own header.
    const isOwnerFromProxy = String(req.headers["x-admin-is-owner"] ?? "").toLowerCase() === "true";
    const isOwnerById = !!actorId && isDiscordId(actorId) && isOwner(actorId);
    if (!isOwnerById && !isOwnerFromProxy) {
      return res.status(403).json({ error: "Forbidden" });
    }
    await actionLogSchema.deleteMany({});
    res.json({ success: true });
  } catch (error) {
    fail(res, error, "clearing action log");
  }
});

module.exports = router;
