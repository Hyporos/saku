const mongoose = require("mongoose");
const actionLogSchema = require("../schemas/actionLogSchema.js");
const path = require("path");

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //
// Constants, validators and helpers shared by every resource file under this folder. Anything used by
// exactly one of them stays in that file instead.

const MAX_ACTION_LOG_ENTRIES = 500;
// Matches the action log's own TTL: once the entry expires, so does the ability to restore.
const ARCHIVE_WINDOW_DAYS = 90;
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
    details: entry.details ? String(entry.details).trim().slice(0, 8000) : null,
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

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

/**
 * Log an unexpected failure and answer with a 500.
 *
 * This exact three-line catch body was written out thirty times across the resource files, each with
 * its own wording of the same message.
 *
 * @param {Object} res - The Express response.
 * @param {Error} error - What went wrong.
 * @param {string} what - What was being attempted, for the log line: "fetching users".
 */
const fail = (res, error, what) => {
  console.error(`Error ${what}:`, error);
  res.status(500).json({ error: "Internal Server Error" });
};

/**
 * Parse a value into a Mongo ObjectId, or null if it is not one.
 *
 * Anything reaching these routes came off a URL, so it is a string until proven otherwise, and
 * `new ObjectId("nope")` throws rather than returning null.
 *
 * @param {string} value
 * @returns {Object|null}
 */
const objectId = (value) =>
  mongoose.Types.ObjectId.isValid(value) ? new mongoose.Types.ObjectId(value) : null;

/**
 * The one guild the bot serves, from cache when it is there.
 *
 * @param {Object} req - The Express request, which carries the client on the app.
 * @returns {Promise<Object|null>} - The guild, or null if it cannot be reached.
 */
const getGuild = async (req) => {
  const client = req.app.get("client");
  const guildId = process.env.SAKU_GUILD_ID;
  return (
    client?.guilds.cache.get(guildId) ?? (await client?.guilds.fetch(guildId).catch(() => null)) ?? null
  );
};

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //
// EVERY route below needs the shared secret, not just the admin ones.
//
// This port has to be reachable from the internet for the webapp host to call it, and the read
// routes were open: /getAll alone hands back every character and their full score history. No
// browser ever calls this API directly (the webapp proxies all of it server-side through /bot/*),
// so the only legitimate caller is the webapp, and it already holds this secret for admin routes.
// Missing config fails closed, which is the right direction: the panel breaks loudly rather than
// the data quietly staying public.
const requireApiSecret = (req, res, next) => {
  const secret = process.env.ADMIN_API_SECRET;
  if (!secret || req.headers["x-admin-secret"] !== secret) {
    return res.status(403).json({ error: "Forbidden" });
  }
  next();
};

module.exports = {
  MAX_ACTION_LOG_ENTRIES,
  ARCHIVE_WINDOW_DAYS,
  ACTION_LOG_CATEGORIES,
  BACKUPS_DIR,
  escapeRegex,
  isDiscordId,
  isIsoDate,
  isStoredDate,
  graphColorName,
  writeActionLog,
  getActorId,
  requireApiSecret,
  fail,
  objectId,
  getGuild,
};
