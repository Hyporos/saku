const express = require("express");
const { requireApiSecret } = require("./shared.js");

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //
// Every route lives in a file named after the resource it serves. This was one 1,648 line file.

const router = express.Router();

// EVERY route needs the shared secret, not just the admin ones, so it is applied once here rather
// than remembered per file.
router.use(requireApiSecret);

router.use(require("./public.js"));
router.use(require("./actionLog.js"));
router.use(require("./scheduledTasks.js"));
router.use(require("./users.js"));
router.use(require("./characters.js"));
router.use(require("./scores.js"));
router.use(require("./exceptions.js"));
router.use(require("./scanner.js"));
router.use(require("./weeks.js"));

module.exports = router;
