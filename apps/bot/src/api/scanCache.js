const culvertSchema = require("../schemas/culvertSchema.js");
const exceptionSchema = require("../schemas/exceptionSchema.js");

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //
// The scanner's short-lived view of characters and exceptions. It lives here rather than in scanner.js
// because editing an exception has to invalidate it, and that route is in another file.

/**
 * Normalize confusable characters for better name matching (same as scan command).
 */
function normalizeConfusableChars(str) {
  return str
    .replace(/[Il1|]/g, "i")
    .replace(/[O0]/g, "o");
}

// Short-lived cache for scan base data — coalesces concurrent parallel scan requests
let _scanDataCache = null;
let _scanDataCacheTime = 0;
const SCAN_CACHE_TTL_MS = 10_000;

function clearScanCache() {
  _scanDataCache = null;
  _scanDataCacheTime = 0;
}

function getScanBaseData() {
  const now = Date.now();
  if (_scanDataCache && now - _scanDataCacheTime < SCAN_CACHE_TTL_MS) {
    return _scanDataCache;
  }
  _scanDataCacheTime = now;
  _scanDataCache = Promise.all([
      culvertSchema.find({}, { characters: 1, _id: 1 }).read("primary").lean(),
      exceptionSchema.find({}).read("primary").lean(),
  ]);
  return _scanDataCache;
}

module.exports = { normalizeConfusableChars, clearScanCache, getScanBaseData };
