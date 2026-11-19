const express = require("express");
const exceptionSchema = require("../schemas/exceptionSchema.js");
const { writeActionLog, fail, objectId } = require("./shared.js");
const { clearScanCache } = require("./scanCache.js");
const { saveMainMapping } = require("../domain/culvert/scanMatch.js");

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //
// OCR misreads and account-group mains mapped to linked character names, used by the scanner.

const router = express.Router();

router.get("/admin/exceptions", async (req, res) => {
  try {
    const exceptions = await exceptionSchema.find();
    res.json(exceptions);
  } catch (error) {
    fail(res, error, "fetching exceptions");
  }
});

router.post("/admin/exceptions", async (req, res) => {
  try {
    const name = String(req.body?.name ?? "").trim();
    const exception = exceptionSchema.toKey(req.body?.exception);
    if (!name) return res.status(400).json({ error: "Name is required" });

    // A main mapping: the bracketed representative → this linked character, one per person.
    if (req.body?.kind === "main") {
      if (!exception) return res.status(400).json({ error: "Main is required" });
      const result = await saveMainMapping({ key: exception, name, source: "manual" });
      if (!result) return res.status(404).json({ error: "Character is not linked" });
      clearScanCache();
      const replaced = result.replaced[0];
      await writeActionLog(req, {
        action: replaced ? "Change Main" : "Link Main",
        target: result.saved.name,
        details: `Main ${exception} → ${result.saved.name}${replaced ? ` | Replaced: ${replaced.exception}` : ""}`,
        category: replaced ? "edit" : "create",
      });
      return res.json({ success: true, id: String(result.saved._id) });
    }

    await exceptionSchema.create({ name, exception });
    clearScanCache();
    await writeActionLog(req, {
      action: "Create Exception",
      target: name,
      details: `Character: ${name} | Exception: ${exception}`,
      category: "create",
    });
    res.json({ success: true });
  } catch (error) {
    fail(res, error, "creating exception");
  }
});

router.patch("/admin/exceptions/:id", async (req, res) => {
  try {
    if (!objectId(req.params.id)) return res.status(400).json({ error: "Invalid exception id" });
    const name = String(req.body?.name ?? "").trim();
    const exception = exceptionSchema.toKey(req.body?.exception);
    if (!name) return res.status(400).json({ error: "Name is required" });
    const existing = await exceptionSchema.findById(req.params.id, { name: 1, exception: 1 }).lean();
    if (!existing) return res.status(404).json({ error: "Exception not found" });
    await exceptionSchema.findByIdAndUpdate(req.params.id, { $set: { name, exception } });
    clearScanCache();

    const nameChanged = existing.name !== name;
    const exceptionChanged = existing.exception !== exception;

    const detailsParts = [];
    if (nameChanged) detailsParts.push(`Character updated from ${existing.name} to ${name}`);
    if (exceptionChanged) detailsParts.push(`Exception updated from ${existing.exception} to ${exception}`);
    const details = detailsParts.join(" | ") || "Exception updated";

    await writeActionLog(req, {
      action: "Edit Exception",
      target: existing.name,
      details,
      category: "edit",
    });
    res.json({ success: true });
  } catch (error) {
    fail(res, error, "updating exception");
  }
});

router.delete("/admin/exceptions/:id", async (req, res) => {
  try {
    if (!objectId(req.params.id)) return res.status(400).json({ error: "Invalid exception id" });
    const existing = await exceptionSchema.findById(req.params.id, { name: 1, exception: 1 }).lean();
    await exceptionSchema.findByIdAndDelete(req.params.id);
    clearScanCache();
    await writeActionLog(req, {
      action: "Delete Exception",
      target: existing?.name ?? String(req.params.id),
      details: `Deleted exception ${existing?.exception ?? "unknown"} for character ${existing?.name ?? String(req.params.id)}`,
      category: "delete",
    });
    res.json({ success: true });
  } catch (error) {
    fail(res, error, "deleting exception");
  }
});

module.exports = router;
